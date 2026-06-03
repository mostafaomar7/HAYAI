import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TokenService } from './token.service';
import { LoginRequest, LoginResponse, UserModel } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private tokens = inject(TokenService);

  readonly currentUser = signal<UserModel | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  setUser(user: UserModel | null): void {
    this.currentUser.set(user);
  }

  clearUser(): void {
    this.currentUser.set(null);
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', body).pipe(
      tap(res => {
        this.tokens.setToken(res.token);
        this.setUser(res.user);
      })
    );
  }

  logout(): Observable<void> {
    return this.api.post<void>('/auth/logout').pipe(
      tap(() => {
        this.tokens.clearToken();
        this.clearUser();
      })
    );
  }

  refresh(): Observable<{ token: string }> {
    return this.api.post<{ token: string }>('/auth/refresh').pipe(
      tap(res => this.tokens.setToken(res.token))
    );
  }

  me(): Observable<UserModel> {
    return this.api.get<UserModel>('/auth/me').pipe(tap(u => this.setUser(u)));
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
