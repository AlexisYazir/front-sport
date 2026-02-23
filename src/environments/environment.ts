// Environment configuration for Sport Center App
// Este archivo gestiona las variables de entorno
//aqui trabajo en local pa conectar la api local

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000', // URL de la API backend o local https://back-sport.vercel.app
  appName: 'Sport Center',
  appVersion: '1.0.0',
  storageKeys: {
    token: 'auth_token',
    user: 'current_user'
  },
  // Configuración de timeouts
  httpTimeout: 30000, // 30 segundos
  
  // Configuración de tokens
  tokenExpirationBuffer: 300, // 5 minutos antes de expirar
};
