import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenService).getToken();

  const accept = req.headers.has('Accept') ? req.headers : req.headers.set('Accept', 'application/json');
  const headers = token ? accept.set('Authorization', `Bearer ${token}`) : accept;

  return next(req.clone({ headers }));
};
