import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
import { ToastrService } from 'ngx-toastr';

/**
 * Guard factory para proteger rutas por rol
 * Uso: canActivate: [roleGuard([UserRole.ADMIN])]
 */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const toastr = inject(ToastrService);

    // Verificar autenticación
    if (!authService.isLoggedIn()) {
      toastr.warning('Debes iniciar sesión para acceder', 'Acceso Denegado');
      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
      return false;
    }

    // Verificar rol
    if (!authService.hasAnyRole(allowedRoles)) {
      const user = authService.getCurrentUser();
      toastr.error('No tienes permisos para acceder a esta sección', 'Acceso Denegado');
      
      // Redirigir a su dashboard correspondiente
      if (user) {
        const dashboardRoute = getDashboardRoute(user.rol);
        router.navigate([dashboardRoute]);
      } else {
        router.navigate(['/home']);
      }
      return false;
    }

    return true;
  };
}

/**
 * Guards específicos para cada rol
 */
export const adminGuard: CanActivateFn = roleGuard([UserRole.ADMIN]);
export const empleadoGuard: CanActivateFn = roleGuard([UserRole.EMPLEADO]);
export const usuarioGuard: CanActivateFn = roleGuard([UserRole.USUARIO]);

// Import helper
import { getDashboardRoute } from '../models/user.model';
