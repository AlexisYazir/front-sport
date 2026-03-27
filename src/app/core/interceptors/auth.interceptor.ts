import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

const AUTH_EXCLUDED_URLS = [
  '/users/login-user',
  '/users/refresh-token',
  '/users/create-user',
  '/users/auth/google-login',
  '/users/verify-email',
  '/users/resend-code',
  '/users/verify-user-email',
  '/users/verify-user-token',
  '/users/reset-psw',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

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
      catchError((error: HttpErrorResponse) => {
        const canRetry = !req.headers.has('X-Auth-Retry');

        if (error.status === 401 && canRetry && authService.isLoggedIn()) {
          return authService.refreshAccessToken().pipe(
            switchMap((newToken) =>
              next(
                cloneWithToken(newToken).clone({
                  setHeaders: { 'X-Auth-Retry': '1' },
                }),
              ),
            ),
            catchError((refreshError) => {
              authService.logout(false);
              router.navigate(['/auth/login']);
              return throwError(() => refreshError);
            }),
          );
        }

        if (error.status === 401 || error.status === 403) {
          toastr.error(
            'Tu sesión ya no es válida. Inicia sesión nuevamente.',
            'Sesión expirada',
          );
          authService.logout(false);
          router.navigate(['/auth/login']);
        }

        if (error.status === 419) {
          toastr.error('La sesión expiró. Inicia sesión nuevamente.', 'Sesión expirada');
          authService.logout(false);
          router.navigate(['/auth/login']);
        }

        return throwError(() => error);
      }),
    );

  const token = tokenService.getAccessToken();
  if (!token && authService.isLoggedIn()) {
    return authService.refreshAccessToken().pipe(
      switchMap((newToken) => sendRequest(newToken)),
      catchError(() => {
        authService.logout(false);
        router.navigate(['/auth/login']);
        return throwError(() => new Error('Unable to restore session'));
      }),
    );
  }

  if (token && authService.shouldRefreshSoon()) {
    return authService.refreshAccessToken().pipe(
      switchMap((newToken) => sendRequest(newToken)),
      catchError(() => {
        authService.logout(false);
        router.navigate(['/auth/login']);
        return throwError(() => new Error('Unable to refresh session'));
      }),
    );
  }

  return sendRequest(token);
};
