import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);

  const isErrorRoute = router.url.startsWith('/error/');
  const isAsset = req.url.includes('/assets/');
  if (isAsset || isErrorRoute) return next(req);

  const method = req.method.toUpperCase();
  const isNavigationGet = method === 'GET'; // regla simple; si usas resolvers/guards, casi siempre es GET

  const hasValidationDetails =
    !!(req && (false)) || // placeholder
    false;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const hasBackendValidation =
        !!(error?.error?.errors || error?.error?.validationErrors || Array.isArray(error?.error?.message));

      // 500 o sin red: siempre global
      if (error.status >= 500 || error.status === 0) {
        router.navigate(['/error/500']);
        toastr.error(
          'Tuvimos un problema inesperado. Nuestro equipo ya lo está revisando.',
          'Ups… algo falló'
        );
        return throwError(() => error);
      }

      // 404: SOLO si es carga de página (GET). Acciones -> toast
      if (error.status === 404) {
        if (isNavigationGet) {
          router.navigate(['/error/404'], { state: { from: req.url } });
        } else {
          toastr.warning('El recurso no existe o ya fue eliminado.', 'No encontrado');
        }
        return throwError(() => error);
      }

      // 400: por defecto NO página. Solo si es GET y quieres "URL inválida"
      if (error.status === 400) {
        if (isNavigationGet && !hasBackendValidation) {
          router.navigate(['/error/400'], { state: { from: req.url } });
        } else {
          // formulario/acción: deja que el componente lo maneje o muestra toast genérico
          toastr.info('Revisa los datos enviados e inténtalo de nuevo.', 'Solicitud inválida');
        }
        return throwError(() => error);
      }

      // otros códigos: no navegar
      return throwError(() => error);
    })
  );
};
