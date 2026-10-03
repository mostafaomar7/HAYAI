import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { WebsiteApiService } from './website-api.service';
import { BlockDefinition, WebsiteEnums, WebsiteMe, WebsitePermission } from './website.models';

/**
 * Session-wide Website CMS context: who the admin is on the website side
 * (roles + granular permissions), the dropdown enums and the block catalogue.
 *
 * All three are fetched once and shared. Permissions are fail-closed on the
 * backend (403 `WEBSITE_PERMISSION_DENIED`), so the UI only uses them to hide
 * what would fail anyway — never as the security boundary.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteContextService {
  private api = inject(WebsiteApiService);

  readonly me = signal<WebsiteMe | null>(null);
  /** True once `/me` answered (or failed), so the menu can stop waiting. */
  readonly loaded = signal(false);
  private readonly perms = computed(() => new Set<string>(this.me()?.permissions ?? []));

  private me$?: Observable<WebsiteMe | null>;
  private enums$?: Observable<WebsiteEnums>;
  private blocks$?: Observable<BlockDefinition[]>;

  /** Loads (once) the admin's website roles and permissions. */
  load(): Observable<WebsiteMe | null> {
    if (!this.me$) {
      this.me$ = this.api.me().pipe(
        tap(me => {
          this.me.set(me);
          this.loaded.set(true);
        }),
        catchError(() => {
          this.me.set(null);
          this.loaded.set(true);
          return of(null);
        }),
        shareReplay(1)
      );
    }
    return this.me$;
  }

  /** Forget the cached identity — e.g. after the admin edits their own roles. */
  reset(): void {
    this.me$ = undefined;
    this.me.set(null);
    this.loaded.set(false);
  }

  can(permission: WebsitePermission | string | null | undefined): boolean {
    if (!permission) return true;
    return this.perms().has(permission);
  }

  canAny(...permissions: (WebsitePermission | string)[]): boolean {
    return permissions.some(p => this.perms().has(p));
  }

  enums(): Observable<WebsiteEnums> {
    if (!this.enums$) {
      this.enums$ = this.api.enums().pipe(
        catchError(err => {
          this.enums$ = undefined;
          throw err;
        }),
        shareReplay(1)
      );
    }
    return this.enums$;
  }

  blocks(): Observable<BlockDefinition[]> {
    if (!this.blocks$) {
      this.blocks$ = this.api.blocks().pipe(
        catchError(err => {
          this.blocks$ = undefined;
          throw err;
        }),
        shareReplay(1)
      );
    }
    return this.blocks$;
  }

  /** `GET /me` resolved to a yes/no for one permission (used by the route guard). */
  allows(permission: string | undefined): Observable<boolean> {
    return this.load().pipe(map(() => this.can(permission)));
  }
}
