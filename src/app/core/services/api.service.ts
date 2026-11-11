import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPagination, ApiResponse } from '../models/api-response.model';

/** One step of an upload: `data` is set only on the last one. */
export interface UploadEvent<T> {
  progress: number;
  data?: T;
}

export interface PagedResult<T> {
  items: T[];
  pagination: ApiPagination;
  /** Whatever else the list put in `meta`; see `ApiMeta`. Usually unused. */
  meta?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  // Strip any trailing slash so we always join with a single '/'.
  readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: this.buildParams(params) })
      .pipe(map(r => r.data));
  }

  /**
   * Same as `get`, but keeps `meta`. `get` throws the envelope away, which is
   * fine for most endpoints — but some carry ordering/labelling data there
   * (the plan module catalog returns its group order in `meta.groups`) and
   * that must not be hardcoded on the client.
   */
  getWithMeta<T, M = Record<string, unknown>>(
    path: string,
    params?: Record<string, any>
  ): Observable<{ data: T; meta: M | undefined }> {
    return this.http
      .get<ApiResponse<T> & { meta?: M }>(this.url(path), { params: this.buildParams(params) })
      .pipe(map(r => ({ data: r.data, meta: r.meta })));
  }

  getPaged<T>(path: string, params?: Record<string, any>): Observable<PagedResult<T>> {
    return this.http
      .get<ApiResponse<T[]>>(this.url(path), { params: this.buildParams(params) })
      .pipe(
        map(r => ({
          items: r.data ?? [],
          meta: r.meta as Record<string, unknown> | undefined,
          pagination: r.meta?.pagination ?? {
            current_page: 1,
            per_page: (r.data ?? []).length,
            total: (r.data ?? []).length,
            last_page: 1,
            from: (r.data ?? []).length ? 1 : 0,
            to: (r.data ?? []).length
          }
        }))
      );
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(path), body ?? {}).pipe(map(r => r.data));
  }

  postMultipart<T>(path: string, form: FormData): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(path), form).pipe(map(r => r.data));
  }

  /**
   * A multipart POST that reports how much has been sent, for uploads big
   * enough to take minutes (a 100 MB video). Emits `{ progress }` from 0 to
   * 100 while sending, then `{ data }` once the server answers. No timeout is
   * applied here or by any interceptor, so a slow connection is not cut off.
   */
  postMultipartWithProgress<T>(path: string, form: FormData): Observable<UploadEvent<T>> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), form, { reportProgress: true, observe: 'events' })
      .pipe(
        filter(e => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
        map(e => e.type === HttpEventType.UploadProgress
          ? { progress: e.total ? Math.min(100, Math.round((e.loaded / e.total) * 100)) : 0 }
          : { progress: 100, data: (e as { body: ApiResponse<T> | null }).body?.data as T })
      );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.url(path), body).pipe(map(r => r.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(this.url(path), body).pipe(map(r => r.data));
  }

  /**
   * `opts.body` is for the few endpoints that require one on a DELETE — the
   * account deletes want `{confirm: 'DELETE'}`, and refuse the request
   * without it. Angular only sends a DELETE body when it is passed this way.
   */
  delete<T>(path: string, opts?: { body?: unknown }): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(this.url(path), opts?.body === undefined ? {} : { body: opts.body })
      .pipe(map(r => r.data));
  }

  private url(path: string): string {
    return path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  private buildParams(params?: Record<string, any>): HttpParams {
    let p = new HttpParams();
    if (!params) return p;
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === '') continue;
      if (Array.isArray(v)) {
        for (const item of v) p = p.append(k + '[]', String(item));
      } else {
        p = p.set(k, String(v));
      }
    }
    return p;
  }
}
