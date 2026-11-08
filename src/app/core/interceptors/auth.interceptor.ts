import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, map, switchMap, throwError } from 'rxjs';
import { AuthService, AuthSessionChangedError } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { SKIP_AUTH_RETRY } from './auth-request-context';

const AUTH_EXCLUDED_URLS = [
  '/users/login-user',
  '/users/refresh-token',
  '/users/session',
  '/users/create-user',
  '/users/auth/google-login',
  '/users/verify-email',
  '/users/resend-code',
  '/users/verify-user-email',
  '/users/verify-user-token',
  '/users/reset-psw',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isExcluded = AUTH_EXCLUDED_URLS.some((url) => req.url.includes(url));
  if (isExcluded) {
    return next(
      req.clone({
        withCredentials: true,
        setHeaders: {
          Accept: 'application/json',
        },
      }),
    );
  }

  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const snapshot = authService.captureSession();
  const isCurrent = () => !!snapshot && authService.isCurrentSession(snapshot);

  const cloneWithToken = (token: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return req.clone({ setHeaders: headers, withCredentials: true });
  };

  const sendRequest = (token: string | null) =>
    next(cloneWithToken(token)).pipe(
      map(event => {
        if (snapshot && !isCurrent()) throw new AuthSessionChangedError();
        return event;
      }),
      catchError((error: HttpErrorResponse) => {
        if ((snapshot && !isCurrent()) || error instanceof AuthSessionChangedError) return throwError(() => error);
        const canRetry = !req.context.get(SKIP_AUTH_RETRY) && !req.headers.has('X-Auth-Retry');

        if (error.status === 401 && canRetry && isCurrent() && authService.isLoggedIn()) {
          return authService.refreshAccessToken().pipe(
            switchMap((newToken) => {
              if (!isCurrent()) return throwError(() => new AuthSessionChangedError());
              return next(
                cloneWithToken(newToken).clone({
                  setHeaders: { 'X-Auth-Retry': '1' },
                }),
              ).pipe(map(event => {
                if (!isCurrent()) throw new AuthSessionChangedError();
                return event;
              }));
            }),
            catchError((refreshError) => {
              if (isCurrent()) {
                authService.logout(false);
                router.navigate(['/auth/login']);
              }
              return throwError(() => refreshError);
            }),
          );
        }

        if (error.status === 403) {
          return throwError(() => error);
        }

        if (error.status === 401 && isCurrent()) {
          toastr.error(
            'Tu sesión ya no es válida. Inicia sesión nuevamente.',
            'Sesión expirada',
          );
          authService.logout(false);
          router.navigate(['/auth/login']);
        }

        if (error.status === 419 && isCurrent()) {
          toastr.error('La sesión expiró. Inicia sesión nuevamente.', 'Sesión expirada');
          authService.logout(false);
          router.navigate(['/auth/login']);
        }

        return throwError(() => error);
      }),
    );

  const token = tokenService.getAccessToken();
  if (snapshot && !isCurrent()) return throwError(() => new AuthSessionChangedError());
  if (token && isCurrent() && authService.shouldRefreshSoon()) {
    return authService.refreshAccessToken().pipe(
      catchError(() => {
        if (isCurrent()) {
          authService.logout(false);
          router.navigate(['/auth/login']);
        }
        return throwError(() => new Error('Unable to refresh session'));
      }),
      switchMap((newToken) => isCurrent() ? sendRequest(newToken) : throwError(() => new AuthSessionChangedError())),
    );
  }

  return sendRequest(token);
};
