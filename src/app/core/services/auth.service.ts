import { Injectable, signal } from '@angular/core';
import { UserModel } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<UserModel | null>(null);

  setUser(user: UserModel) {
    this.currentUser.set(user);
  }

  clearUser() {
    this.currentUser.set(null);
  }
}