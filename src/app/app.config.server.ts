import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { FetchBackend, HttpBackend } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SiteServerBackend } from './features/site/server/site-server-backend';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Server-side API calls go through fetch (Node 20 has it natively) and a
    // backend that adds the website key, can point at an internal API host and
    // micro-caches public GETs. Overriding the backend (not adding an
    // interceptor) keeps the browser-side HTTP stack exactly as it was.
    FetchBackend,
    { provide: HttpBackend, useClass: SiteServerBackend }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
