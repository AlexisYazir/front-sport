import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { frontendLogger } from './app/core/services/frontend-logger.service';

bootstrapApplication(App, appConfig)
  .catch((error) => frontendLogger.critical('Error bootstrapping app', error));
