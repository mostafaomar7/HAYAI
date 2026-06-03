import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { UserModel } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  me(): Observable<UserModel> {
    return this.api.get<UserModel>('/auth/me');
  }

  updateMe(body: Partial<UserModel>): Observable<UserModel> {
    return this.api.patch<UserModel>('/auth/me', body);
  }

  updateMeMultipart(form: FormData): Observable<UserModel> {
    return this.api.postMultipart<UserModel>('/auth/me', form);
  }

  changePassword(body: {
    current_password: string;
    new_password: string;
    new_password_confirmation: string;
  }): Observable<void> {
    return this.api.post<void>('/auth/change-password', body);
  }
}
