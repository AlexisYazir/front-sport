import { inject, isDevMode } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { PublicHomeOfflineService } from '../services/public-home-offline.service';

export const publicHomeOfflineInterceptor: HttpInterceptorFn = (req, next) => {
  if (isDevMode()) return next(req);
  const offline = inject(PublicHomeOfflineService);
  return offline.handles(req) ? offline.intercept(req) : next(req);
};
