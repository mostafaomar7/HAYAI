import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Hybrid rendering. Only the public website is rendered on the server — that
 * is what crawlers (Googlebot, and AI crawlers that never run JavaScript) must
 * receive as complete HTML. The admin SPA depends on localStorage and a
 * signed-in session, so its routes are served as the plain client shell, the
 * same as the static hosting has always done.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'dashboard/**', renderMode: RenderMode.Client },
  // Shareable draft previews: rendered on the server so the page looks exactly
  // like the live one, but never cached and always noindex (set by the page).
  { path: 'preview', renderMode: RenderMode.Server },
  { path: ':locale', renderMode: RenderMode.Server },
  { path: ':locale/**', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client }
];
