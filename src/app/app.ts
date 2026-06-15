import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { TokenService } from './core/services/token.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('BAREEQ');
  private auth = inject(AuthService);
  private tokens = inject(TokenService);
  // Eagerly construct I18nService so initial language + dir are applied on boot.
  private i18n = inject(I18nService);

  constructor() {
    if (this.tokens.hasToken() && !this.auth.currentUser()) {
      this.auth.me().subscribe({ error: () => {} });
    }
  }
}
