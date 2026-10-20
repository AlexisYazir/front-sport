import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideLucideIcons } from '@lucide/angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { SPORT_CENTER_ICONS } from './shared/icons/sport-center-icons';
import { PublicInfoOfflineService } from './core/services/public-info-offline.service';
import { PwaNotificationsService } from './core/services/pwa-notifications.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
      updateViaCache: 'none',
    }),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAppInitializer(() => {
      // Inicia la descarga pública en segundo plano sin retrasar la apertura de la web.
      inject(PublicInfoOfflineService).start();
      if (!isDevMode()) inject(PwaNotificationsService).start();
    }),
    provideAnimations(),
    provideLucideIcons(...SPORT_CENTER_ICONS),
    provideToastr({
      timeOut: 3200,
      positionClass: 'toast-top-center',
      preventDuplicates: true,
      closeButton: true,
      progressBar: true,
      newestOnTop: true,
      toastClass: 'ngx-toastr sc-toast'
    })
  ]
};
