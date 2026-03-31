// Environment configuration for PRODUCTION
// Este archivo se usa cuando se construye para producción

export const environment = {
  production: true,
  apiUrl: 'https://back-sport-ghxk.onrender.com',
  appName: 'Sport Center',
  appVersion: '1.0.0',
  maptilerApiKey: 'AfCJS7SbygYGLEQE04zm',
  storageKeys: {
    token: 'auth_token',
    user: 'current_user'
  },
  // Configuración de timeouts
  httpTimeout: 30000, // 30 segundos
  
  // Configuración de tokens
  tokenExpirationBuffer: 300, // 5 minutos antes de expirar
};
