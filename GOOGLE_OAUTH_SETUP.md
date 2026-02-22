# 🔐 Google OAuth2 - Setup Frontend

## ✅ Frontend Implementado Exitosamente

El frontend ya está completamente configurado para usar Google Identity Services (GIS). Se implementaron:

- ✅ Script de Google en `index.html`
- ✅ Servicio `GoogleAuthService` en `src/app/core/services/google-auth.service.ts`
- ✅ Integración en componente de **Login** (`src/app/features/auth/login/`)
- ✅ Integración en componente de **Registro** (`src/app/features/auth/register/`)

---

## 📋 Pasos para Habilitar Google OAuth

### PASO 1: Obtener Google Client ID

1. Ir a: **https://console.cloud.google.com**
2. **Crear nuevo proyecto**:
   - Nombre: "Sport Center"
   - Click en "Crear"

3. **Habilitar Google+ API**:
   - Ir a: `APIs & Services > Library`
   - Buscar: "Google+ API"
   - Click en "Habilitar"

4. **Crear credenciales OAuth**:
   - Ir a: `APIs & Services > Credenciales`
   - Click en "Crear credenciales" → "OAuth client ID"

5. **Configurar OAuth Consent Screen** (si lo pide):
   - Tipo de usuario: "Externo"
   - Nombre de la app: "Sport Center"
   - Email de soporte: `tu@email.com`
   - Scopes: `openid`, `email`, `profile`
   - Usuarios de prueba: Tu email
   - Guardar y continuar

6. **Crear OAuth 2.0 Client ID**:
   - Application type: "Web application"
   - Name: "Sport Center Web"
   - Authorized JavaScript origins:
     ```
     http://localhost:4200
     http://localhost:3443
     https://tudominio.com  (producción)
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:4200
     https://tudominio.com
     ```
   - Click en "Crear"

7. **Copiar tu Client ID** (lo necesitarás en el siguiente paso)

---

### PASO 2: Agregar Google Client ID al Frontend

Reemplaza `TU_GOOGLE_CLIENT_ID_AQUI` con tu Client ID real en:

**Opción A: En el archivo de configuración (Recomendado)**

Crea o actualiza `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleClientId: 'TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com',
  storageKeys: {
    token: 'auth_token',
    user: 'auth_user'
  }
};
```

Luego actualiza `src/app/features/auth/login/login.ts`:

```typescript
ngOnInit() {
  this.initializeGoogle();
}

private initializeGoogle(): void {
  const googleClientId = environment.googleClientId;
  
  if (googleClientId && googleClientId !== 'TU_GOOGLE_CLIENT_ID_AQUI') {
    this.googleAuthService.initializeGoogle(googleClientId);
    setTimeout(() => {
      this.googleAuthService.renderGoogleButton('google-signin-button');
    }, 300);
  }
}
```

Y lo mismo en `src/app/features/auth/register/register.ts`.

---

**Opción B: Directamente en los componentes (Rápido)**

En `login.ts` y `register.ts`, reemplaza:

```typescript
const googleClientId = 'TU_GOOGLE_CLIENT_ID_AQUI';
```

Con tu Client ID real:

```typescript
const googleClientId = '123456789-abcdefg.apps.googleusercontent.com';
```

---

### PASO 3: Verificar que Funciona

1. Ejecuta el proyecto:
   ```bash
   npm start
   ```

2. Accede a:
   - **Login**: `http://localhost:4200/auth/login`
   - **Registro**: `http://localhost:4200/auth/register`

3. Deberías ver el **botón de Google** renderizado

4. Click en el botón de Google:
   - Se abrirá un popup de Google
   - Selecciona tu cuenta de prueba
   - Google enviará el ID Token al backend

---

## 🔄 Flujo Completo

```
1. Usuario click en botón de Google
   ↓
2. Google abre popup de autenticación
   ↓
3. Usuario autenticado en Google
   ↓
4. Google retorna ID Token (JWT)
   ↓
5. Frontend envía ID Token a: POST /auth/google-login
   ↓
6. Backend verifica token con Google
   ↓
7. Backend busca/crea usuario en BD
   ↓
8. Backend retorna Access Token
   ↓
9. Frontend guarda token en localStorage
   ↓
10. Frontend redirige a /dashboard
```

---

## 📝 Estructura Implementada

### GoogleAuthService
**Ubicación**: `src/app/core/services/google-auth.service.ts`

**Métodos principales**:
- `initializeGoogle(clientId)` - Inicializa GIS
- `renderGoogleButton(elementId)` - Renderiza botón de Google
- `loginWithGoogle(idToken)` - Envía token al backend
- `logout()` - Cierra sesión
- `isGoogleAvailable()` - Verifica si Google está disponible

### Login Component
**Ubicación**: `src/app/features/auth/login/login.ts`

- Inicializa Google en `ngOnInit()`
- Renderiza botón en elemento `#google-signin-button`
- Reutiliza la lógica de login existente del `AuthService`

### Register Component
**Ubicación**: `src/app/features/auth/register/register.ts`

- Inicializa Google en `ngOnInit()`
- Renderiza botón en elemento `#google-signup-button`
- Permite registro social directo

---

## ✅ Verificación sin Backend

Si aún no tienes el backend implementado:

1. El botón de Google se mostrará correctamente ✅
2. Click en el botón abrirá el popup de Google ✅
3. Después de autenticarse, el frontend intentará contactar `/auth/google-login` ❌ (faltará backend)

**Para completar**: Implementa el endpoint `POST /auth/google-login` en NestJS siguiendo los pasos del documento principal de Google OAuth2.

---

## 🐛 Troubleshooting

### "Google no está definido"
- Verifica que el script de Google esté en `index.html` ✅ (Ya está)
- Abre DevTools → Console y busca errores de CORS

### El botón no aparece
- Verifica que `googleClientId` sea válido
- Comprueba que el elemento con `id="google-signin-button"` exista en el HTML
- Abre Console y busca logs de error

### Error: "Invalid origin"
- Verifica que `localhost:4200` esté autorizado en Google Console
- Revisa "Authorized JavaScript origins"

### Error: "Invalid audience"
- El `GOOGLE_CLIENT_ID` en el backend no coincide con el del frontend
- Verifica que ambos usen el mismo Client ID

---

## 📚 Documentación Oficial

- [Google Identity Services Docs](https://developers.google.com/identity/gsi/web)
- [Google Cloud Console](https://console.cloud.google.com)

---

## 🎯 Próximos Pasos

1. ✅ Configurar Google OAuth en Google Cloud Console
2. ✅ Agregar Client ID al frontend
3. ⏳ Implementar backend endpoint `/auth/google-login` en NestJS
4. ⏳ Conectar con tu base de datos

---

**Estado**: Frontend 100% implementado y compilado exitosamente ✅
