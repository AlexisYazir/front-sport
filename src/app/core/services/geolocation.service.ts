import { Injectable, InjectionToken, inject } from '@angular/core';

type GeolocationBrowser = Pick<Window, 'isSecureContext' | 'navigator' | 'document'>;
type LocationPolicyDocument = Document & {
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
};

export const GEOLOCATION_WINDOW = new InjectionToken<GeolocationBrowser>('Geolocation browser', {
  providedIn: 'root', factory: () => window,
});

class GeolocationRequestError extends Error {}

/** Se solicita una sola posición después de una acción del usuario; no se guarda ni se rastrea. */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly browser = inject(GEOLOCATION_WINDOW);

  async getCurrentPosition(): Promise<GeolocationPosition> {
    if (!this.browser.isSecureContext) {
      throw new GeolocationRequestError('La ubicación requiere una conexión segura. Abre el sitio mediante HTTPS.');
    }
    if (!this.browser.navigator.geolocation) {
      throw new GeolocationRequestError('Este navegador no permite consultar tu ubicación.');
    }
    const document = this.browser.document as LocationPolicyDocument;
    const policy = document.permissionsPolicy ?? document.featurePolicy;
    if (policy && !policy.allowsFeature('geolocation')) {
      throw new GeolocationRequestError('La ubicación está bloqueada por la configuración de este sitio.');
    }
    return new Promise((resolve, reject) => {
      this.browser.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000,
      });
    });
  }
}

export function getGeolocationErrorMessage(error: unknown): string {
  if (error instanceof GeolocationRequestError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  switch (code) {
    case 1:
      return 'El acceso a tu ubicación está bloqueado. Permítelo en los ajustes del sitio y revisa que la ubicación esté activada en tu dispositivo.';
    case 2:
      return 'Tu dispositivo no pudo determinar la ubicación. Activa la ubicación e inténtalo de nuevo.';
    case 3:
      return 'La ubicación tardó demasiado en responder. Inténtalo de nuevo.';
    default:
      return 'No fue posible obtener tu ubicación. Inténtalo de nuevo.';
  }
}
