import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SiteLocale } from '../site-paths';
import {
  ApiEnvelope,
  Dict,
  FormDefinition,
  PagePayload,
  ResolveResult,
  SiteData
} from '../models/site.models';

const API_BASE = environment.apiBaseUrl.replace(/\/+$/, '');
const PUBLIC = `${API_BASE}/public`;
/** Endpoints in payloads (`submit_endpoint`, `purchase.endpoint`) are paths
 *  on the API host, e.g. `/api/v1/public/en/purchases`. */
const API_ORIGIN = new URL(API_BASE).origin;

export function apiUrl(endpoint: string): string {
  return /^https?:\/\//i.test(endpoint) ? endpoint : API_ORIGIN + (endpoint.startsWith('/') ? '' : '/') + endpoint;
}

/**
 * Every call the public website makes. URLs are assembled as plain strings
 * (no HttpParams) so the server and the browser produce byte-identical URLs —
 * that string is the HTTP transfer-cache key that lets hydration reuse the
 * server's responses instead of calling the API again.
 */
@Injectable({ providedIn: 'root' })
export class SiteApiService {
  private http = inject(HttpClient);

  site(locale: SiteLocale): Observable<SiteData | null> {
    return this.http.get<ApiEnvelope<SiteData>>(`${PUBLIC}/${locale}/site`).pipe(
      map(r => r.data),
      catchError(() => of(null))
    );
  }

  resolve(locale: SiteLocale, path: string, qs: string): Observable<ResolveResult> {
    const q = `path=${encodeURIComponent(path)}` + (qs ? `&qs=${encodeURIComponent(qs)}` : '');
    return this.http.get<ApiEnvelope<ResolveResult>>(`${PUBLIC}/${locale}/resolve?${q}`).pipe(
      map(r => r.data ?? errorResult()),
      catchError(() => of(errorResult()))
    );
  }

  /** Listing endpoints (`products`, `articles`, `search`, `doctors`, `hospitals`). */
  listing(locale: SiteLocale, endpoint: string, qs: string): Observable<ApiEnvelope<any> | null> {
    return this.http
      .get<ApiEnvelope<any>>(`${PUBLIC}/${locale}/${endpoint}${qs ? `?${qs}` : ''}`)
      .pipe(catchError(() => of(null)));
  }

  preview(token: string, locale: SiteLocale): Observable<PagePayload | null> {
    // `transferCache: false`: a draft must never be serialised into the page
    // state twice, and the token is single-purpose.
    return this.http
      .get<ApiEnvelope<PagePayload>>(
        `${PUBLIC}/preview/${encodeURIComponent(token)}?locale=${locale}`,
        { transferCache: false }
      )
      .pipe(
        map(r => r.data),
        catchError(() => of(null))
      );
  }

  form(locale: SiteLocale, key: string): Observable<FormDefinition | null> {
    return this.http.get<ApiEnvelope<FormDefinition>>(`${PUBLIC}/${locale}/forms/${encodeURIComponent(key)}`).pipe(
      map(r => r.data),
      catchError(() => of(null))
    );
  }

  submitForm(endpoint: string, body: Dict | FormData): Observable<ApiEnvelope<Dict> | Dict> {
    return this.http.post<ApiEnvelope<Dict>>(apiUrl(endpoint), body);
  }

  purchase(endpoint: string, body: Dict, idempotencyKey: string): Observable<ApiEnvelope<Dict>> {
    return this.http.post<ApiEnvelope<Dict>>(apiUrl(endpoint), body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
    });
  }

  trackPurchase(reference: string, token: string): Observable<ApiEnvelope<Dict>> {
    return this.http.get<ApiEnvelope<Dict>>(
      `${PUBLIC}/purchases/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`,
      { transferCache: false }
    );
  }

  cancelPurchase(reference: string, token: string, reason: string): Observable<ApiEnvelope<Dict>> {
    return this.http.post<ApiEnvelope<Dict>>(`${PUBLIC}/purchases/${encodeURIComponent(reference)}/cancel`, {
      token,
      reason
    });
  }
}

function errorResult(): ResolveResult {
  return { kind: 'error', status: 503, data: null, redirect: null };
}
