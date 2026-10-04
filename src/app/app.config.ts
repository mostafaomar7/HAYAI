import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions
} from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { langInterceptor } from './core/interceptors/lang.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, langInterceptor, errorInterceptor])),
    // Public pages are server-rendered and hydrated. The transfer cache hands
    // the browser every GET the server already made, so hydration does not
    // refetch the page payload. Auth-header requests are included because a
    // signed-in admin's browser still stamps its bearer token on the public
    // (anonymous) API calls; the responses are the same as the server's.
    // Dashboard routes are client-rendered, so there is nothing to hydrate.
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: true })
    )
  ]
};
