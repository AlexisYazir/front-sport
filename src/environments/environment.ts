// Environment configuration for Sport Center App
// Este archivo gestiona las variables de entorno
//aqui trabajo en local pa conectar la api local

export const environment = {
  production: false,
  apiUrl: 'https://back-sport-ghxk.onrender.com',
  // apiUrl: 'http://localhost:3000', // URL de la API backend o local https://back-sport-ghxk.onrender.com  http://localhost:3000
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
