import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Guard que verifica roles de usuario para rutas protegidas
 * Uso en rutas:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [roleGuard([UserRole.ADMIN])]
 * }
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const currentUser = authService.currentUser();

    // Verificar si el usuario está autenticado
    if (!currentUser) {
      router.navigate(['/auth/login']);
      return false;
    }

    // Verificar si el usuario tiene el rol requerido
    if (allowedRoles && allowedRoles.length > 0) {
      const hasRole = allowedRoles.includes(currentUser.rol);

      if (!hasRole) {
        console.warn(`Usuario ${currentUser.email} sin permisos para acceder a ${state.url}`);
        router.navigate(['/home']);
        return false;
      }
    }

    return true;
  };
};

/**
 * Guard que solo verifica autenticación (sin verificar roles)
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  if (!currentUser) {
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  return true;
};
