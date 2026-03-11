import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { getDashboardRoute } from '../models/user.model';

/**
 * Interceptor para:
 * 1. Agregar token JWT en todas las peticiones HTTP
 * 2. Agregar token CSRF para peticiones de modificación
 * 3. Manejar errores de autenticación (401, 403)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  // URLs que no requieren autenticación
  const excludedUrls = ['/auth/login', '/auth/register', '/health', '/public/'];
  const isExcluded = excludedUrls.some(url => req.url.includes(url));

  if (isExcluded) {
    return next(req);
  }

  // Obtener token
  const token = tokenService.getAccessToken();

  // Clonar request y agregar token
  let authReq = req.clone({
    setHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (token) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Para peticiones de modificación (POST, PUT, DELETE), agregar CSRF token
  const isModificationRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (isModificationRequest) {
    const csrfToken = tokenService.getCsrfToken();
    if (csrfToken) {
      authReq = authReq.clone({
        setHeaders: {
          'X-CSRF-Token': csrfToken
        }
      });
    }
  }

  // Manejar errores de autenticación
  return next(authReq).pipe(
    catchError((error) => {
      // Error 401 - No autorizado
      if (error.status === 401) {
        toastr.error('No tienes permisos para acceder a esta sección. Inicia sesión nuevamente', 'Acceso Denegado');
        tokenService.clearTokens();
        authService.logout();
        authService.clearAuthState();
        router.navigate(['/auth/login']);
      }

      // Error 403 - Prohibido (sin permisos o CSRF inválido)
      // Error 403 - Prohibido (sin permisos o token manipulado)
      if (error.status === 403) {

        toastr.error('No tienes permisos para acceder a esta sección. Inicia sesión nuevamente', 'Acceso Denegado');

        // limpiar tokens
        tokenService.clearTokens();

        // limpiar estado auth
        authService.logout();

        // redirigir
        router.navigate(['/auth/login']);
      }

      // Error 419 - Token de sesión expirado
      if (error.status === 419) {
        toastr.error('Token de seguridad expirado. Por favor, inicia sesión nuevamente.', 'CSRF Token Inválido');
        tokenService.clearTokens();
        authService.logout();
        router.navigate(['/auth/login']);
      }

      // Error 500 - Error del servidor
      if (error.status === 500) {
        toastr.error('Error en el servidor. Intenta nuevamente más tarde.', 'Error del Servidor');
      }

      return throwError(() => error);
    })
  );
};
