export const environment = {
  production: false,
  // The base URL must include the `/api/v1` prefix — every service path
  // (e.g. `/auth/login`, `/admin/advertisements`) is appended to this.
  apiBaseUrl: 'https://api.hayaihealthcare.com/api/v1',

  // apiBaseUrl: 'paleturquoise-wolf-589691.hostingersite.com/api/v1',

  // The build's default. The server can override it per deploy with
  // AUTH_MODE, so flipping back is a restart rather than a rebuild.
  // See docs/backend-contract/auth-session-cookie-2026-10-12.md.
  authMode: 'bearer' as 'bearer' | 'cookie'
};
