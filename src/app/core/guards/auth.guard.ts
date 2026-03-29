import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastrService } from 'ngx-toastr';

/**
 * Guard para proteger rutas que requieren autenticación
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  if (authService.isLoggedIn()) {
    // Verificar si el usuario está activo
    if (!authService.isUserActive()) {
      toastr.warning('Tu cuenta está pendiente de activación', 'Cuenta Inactiva');
      authService.logout();
      return false;
    }
    return true;
  }

  toastr.warning('Debes iniciar sesión para acceder a esta página', 'Acceso Denegado');
  router.navigate(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};

/**
 * Guard para redirigir usuarios autenticados fuera de páginas de auth
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si hay autenticación en progreso (ej: Google OAuth), permitir navegación sin redirigir
  if (authService.isAuthenticationInProgress()) {
    // console.log('🔐 Google OAuth en progreso - permitiendo navegación sin redirigir');
    return true;
  }

  // Si AuthService ya está navegando (login normal), permitir sin redirigir
  if (authService.isNavigationInProgress()) {
    // console.log('🚀 AuthService ya está redirigiendo - permitiendo navegación');
    return true;
  }

  const isLoggedIn = authService.isLoggedIn();

  if (!isLoggedIn) {
    return true;
  }

  const user = authService.getCurrentUser();
  if (user) {
    const dashboardRoute = getDashboardRoute(user.rol);
    router.navigate([dashboardRoute]);
  }
  return false;
};

// Import helper
import { getDashboardRoute } from '../models/user.model';
