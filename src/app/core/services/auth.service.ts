import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { LoginRequest, LoginResponse, UserModel } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private tokens = inject(TokenService);
  private session = inject(SessionService);

  readonly currentUser = signal<UserModel | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  setUser(user: UserModel | null): void {
    this.currentUser.set(user);
  }

  clearUser(): void {
    this.currentUser.set(null);
  }

  /**
   * In cookie mode the response still carries `token` — the API keeps it there
   * through the transition — and it is deliberately ignored. Storing it would
   * put the session back in `localStorage`, which is the whole thing this was
   * meant to end, and the interceptor would then send a header the API
   * prefers over the cookie.
   */
  login(body: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', body).pipe(
      tap(res => {
        if (!this.session.isCookieMode) this.tokens.setToken(res.token);
        this.setUser(res.user);
      })
    );
  }

  logout(): Observable<void> {
    return this.api.post<void>('/auth/logout').pipe(
      tap(() => {
        this.session.clear();
        this.clearUser();
      })
    );
  }

  /**
   * Rotates the current token — it does **not** recover an expired session.
   * Sanctum tokens here have no expiry, and the endpoint itself needs a valid
   * bearer token, so it can never resolve a 401. Do not wire this into the
   * error interceptor; a 401 means the session is gone for good.
   */
  refresh(): Observable<UserModel & { token: string }> {
    return this.api.post<UserModel & { token: string }>('/auth/refresh').pipe(
      tap(res => {
        if (!this.session.isCookieMode) this.tokens.setToken(res.token);
        this.setUser(res);
      })
    );
  }

  /**
   * Two callers ask for the session on a cold dashboard load — `App`, so the
   * name in the header is right, and `dashboardShellGuard`, so a non-admin
   * never reaches the shell. Neither can drop its call: the guard must have an
   * answer before the route opens, and `App` runs first with nothing to wait
   * on. They fired about twenty milliseconds apart, which was two requests
   * where one would do, and each one cross-origin with its own preflight.
   *
   * Only the in-flight request is shared, never the result. `me()` is also how
   * the profile page re-reads the account after saving it, and a cached answer
   * there would show the old name back to whoever just changed it.
   */
  private pendingMe: Observable<UserModel> | null = null;

  me(): Observable<UserModel> {
    if (this.pendingMe) return this.pendingMe;
    this.pendingMe = this.api.get<UserModel>('/auth/me').pipe(
      tap(u => this.setUser(u)),
      finalize(() => { this.pendingMe = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.pendingMe;
  }

  updateProfile(body: Partial<UserModel>): Observable<UserModel> {
    return this.api.patch<UserModel>('/auth/me', body).pipe(tap(u => this.setUser(u)));
  }

  updateProfileMultipart(form: FormData): Observable<UserModel> {
    return this.api.postMultipart<UserModel>('/auth/me', form).pipe(tap(u => this.setUser(u)));
  }

  changePassword(body: {
    current_password: string;
    new_password: string;
    new_password_confirmation: string;
  }): Observable<void> {
    return this.api.post<void>('/auth/change-password', body);
  }
}
