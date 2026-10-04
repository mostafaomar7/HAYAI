import { Component, Injector, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { TokenService } from './core/services/token.service';
import { I18nService } from './core/i18n/i18n.service';
import { isPublicSitePath } from './features/site/site-paths';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('BAREEQ');

  constructor() {
    // The public website (/en, /ar, /preview) is rendered on the server and
    // takes its language from the URL. The dashboard boot work below must not
    // run there: on the server there is no storage or session, and in the
    // browser the I18nService would overwrite the page's `<html lang dir>`
    // with the language stored for the dashboard.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    if (isPublicSitePath(location.pathname)) return;

    const injector = inject(Injector);
    // Eagerly construct I18nService so initial language + dir are applied on boot.
    injector.get(I18nService);
    const tokens = injector.get(TokenService);
    const auth = injector.get(AuthService);
    if (tokens.hasToken() && !auth.currentUser()) {
      auth.me().subscribe({ error: () => {} });
    }
  }
}
