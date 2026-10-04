import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TOKEN_KEY = 'hayai_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  // The public website is rendered on the server, where there is no
  // localStorage. The server never holds a session (it only renders anonymous
  // public pages), so "no token" is the truthful answer there — and the
  // dashboard routes are client-rendered, so their behaviour is unchanged.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}
