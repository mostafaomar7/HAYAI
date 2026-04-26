import { Component } from '@angular/core';

@Component({
  selector: 'app-login', // عدلت الاسم لـ app-login عشان يكون Standard
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}