import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { TokenService } from './core/services/token.service';

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

  constructor() {
    if (this.tokens.hasToken() && !this.auth.currentUser()) {
      this.auth.me().subscribe({ error: () => {} });
    }
  }
}
