# 🔐 Guía de Persistencia de Sesión - Sport Center

## ⚠️ Problema Común: Sesión se Pierde en Producción

### Causas Típicas:

1. **localStorage se limpia en navegadores privados/incógnito**
2. **Cache de Service Workers** (si están habilitados)
3. **Hard refresh** (Ctrl + F5) puede limpiar storage
4. **Configuración de cookies/storage del navegador**
5. **Errores de CORS** que impiden guardar datos

---

## ✅ Soluciones Implementadas

### 1. **Verificación de Expiración del Token**

El `AuthService` ahora:
- ✅ Verifica si el token JWT está expirado al cargar
- ✅ Limpia automáticamente tokens expirados
- ✅ Previene errores 401 por tokens vencidos

```typescript
// Antes de usar el token, verificamos si está expirado
if (this.isTokenExpired(token)) {
  this.clearAuthState();
  return;
}
```

### 2. **Logging Mejorado**

Ahora puedes debuggear fácilmente:
```typescript
// Console logs en cada acción
✅ Sesión guardada correctamente
🔐 Sesión limpiada
⚠️ Token expirado
```

### 3. **Timestamp de Sesión**

Se guarda `auth_timestamp` para saber cuándo se creó la sesión:
```javascript
localStorage.getItem('auth_timestamp')
// "2025-10-31T23:15:30.123Z"
```

---

## 🧪 Cómo Probar Persistencia

### Test 1: Refresh Normal
```bash
1. Hacer login
2. Presionar F5 (refresh)
3. ✅ Debe mantener la sesión
```

### Test 2: Hard Refresh
```bash
1. Hacer login
2. Presionar Ctrl + F5 (hard refresh)
3. ✅ Debe mantener la sesión
```

### Test 3: Cerrar y Abrir Tab
```bash
1. Hacer login
2. Cerrar pestaña
3. Abrir nueva pestaña con la misma URL
4. ✅ Debe mantener la sesión
```

### Test 4: Cerrar y Abrir Navegador
```bash
1. Hacer login
2. Cerrar navegador completamente
3. Abrir navegador y visitar la URL
4. ✅ Debe mantener la sesión
```

---

## 🚨 Casos donde SÍ se Pierde la Sesión (Esperado)

### 1. **Modo Incógnito/Privado**
- ❌ localStorage se borra al cerrar
- **Solución:** Usar navegador normal

### 2. **Token Expirado**
- ❌ Si el JWT tiene `exp` y ya expiró
- **Solución:** El backend debe dar tokens con vida útil razonable (ej: 24h)

### 3. **Logout Manual**
- ✅ Esperado - el usuario cerró sesión

### 4. **Limpieza Manual de Storage**
- ❌ Si el usuario limpia manualmente desde DevTools
- **Solución:** N/A - es acción del usuario

---

## 🔧 Debugging en Producción

### Abrir DevTools en Netlify:

```javascript
// 1. Presiona F12
// 2. Ve a Console
// 3. Verifica localStorage:

// Ver token
localStorage.getItem('auth_token')

// Ver usuario
JSON.parse(localStorage.getItem('current_user'))

// Ver timestamp
localStorage.getItem('auth_timestamp')

// Verificar si hay datos
console.log('Token:', !!localStorage.getItem('auth_token'))
console.log('User:', !!localStorage.getItem('current_user'))
```

---

## 📋 Checklist para Netlify

### Antes de Desplegar:

- [x] `netlify.toml` configurado con redirects
- [x] Headers de seguridad configurados
- [x] Cache configurado correctamente
- [x] `index.html` con `Cache-Control: no-cache`

### Configuración en Netlify Dashboard:

1. **Build Settings:**
   - Build command: `npm run build:prod`
   - Publish directory: `dist/ecommerce-app/browser`

2. **Deploy Settings:**
   - Branch: `main` (o tu rama principal)
   - Auto publishing: Enabled

3. **Environment Variables (opcional):**
   - No es necesario configurar nada
   - La URL de la API ya está en `environment.prod.ts`

---

## 🛡️ Seguridad de localStorage

### ¿Es Seguro localStorage para Tokens?

**Pros:**
- ✅ Persiste entre sesiones
- ✅ No se envía automáticamente en cada request (vs cookies)
- ✅ Fácil de usar

**Contras:**
- ⚠️ Vulnerable a XSS (Cross-Site Scripting)
- ⚠️ Accesible desde JavaScript

**Mitigaciones Implementadas:**
- ✅ Angular sanitiza HTML automáticamente (previene XSS)
- ✅ CSP headers configurados en Netlify
- ✅ Token solo se usa en HTTP headers
- ✅ HTTPS obligatorio en producción

---

## 🔄 Alternativa: httpOnly Cookies (Futuro)

Si quieres máxima seguridad, el backend podría enviar cookies httpOnly:

```javascript
// Backend (Node.js/Express)
res.cookie('auth_token', token, {
  httpOnly: true,    // No accesible desde JavaScript
  secure: true,      // Solo HTTPS
  sameSite: 'strict',
  maxAge: 86400000   // 24 horas
})
```

Pero requeriría cambios en el backend.

---

## 📊 Monitoreo de Sesión

### Para debuggear problemas de sesión en producción:

```typescript
// En AuthService, agregar logs específicos
constructor() {
  this.loadAuthState();
  
  // Log estado inicial
  console.log('🔐 Auth State:', {
    hasToken: !!localStorage.getItem(this.TOKEN_KEY),
    hasUser: !!localStorage.getItem(this.USER_KEY),
    timestamp: localStorage.getItem('auth_timestamp')
  });
}
```

---

## ✅ Resultado Final

Con estas mejoras:

1. ✅ **Token expirado se detecta automáticamente**
2. ✅ **Logs claros en consola para debugging**
3. ✅ **Timestamp para tracking de sesión**
4. ✅ **Manejo robusto de errores**
5. ✅ **Cache configurado correctamente en Netlify**

**La sesión ahora se mantiene de forma confiable en producción** 🎉

---

## 🆘 Si la Sesión se Pierde en Producción

1. Abrir DevTools (F12)
2. Ver consola, buscar mensajes de auth
3. Verificar localStorage en Application tab
4. Revisar Network tab para errores de API
5. Verificar que no estés en modo incógnito

---

## 📞 Soporte

Si persisten problemas, verificar:
- CORS en el backend
- Tiempo de expiración del token JWT
- Configuración de Netlify
