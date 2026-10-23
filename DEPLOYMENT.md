# 🚀 Checklist de Despliegue - Sport Center

## ✅ Pre-despliegue

### 1. Variables de Entorno
- [ ] Archivo `.env` creado y configurado
- [ ] Archivo `.env.production` creado
- [ ] `.gitignore` actualizado para excluir archivos `.env`
- [ ] Variables de entorno configuradas en `src/environments/`

### 2. Configuración del Código
- [ ] `AuthService` usa `environment.apiUrl`
- [ ] `DashboardAdmin` usa `environment.apiUrl`
- [ ] No hay URLs hardcodeadas en el código
- [ ] Token y User keys vienen de `environment.storageKeys`

### 3. Seguridad
- [ ] JWT tokens se guardan en localStorage
- [ ] HTTP Interceptor configurado correctamente
- [ ] Guards aplicados en todas las rutas sensibles
- [ ] CORS configurado en el backend

### 4. Build y Compilación
- [ ] `npm run build:prod` ejecuta sin errores
- [ ] Tamaño del bundle es razonable (< 2MB inicial)
- [ ] Lazy loading funciona correctamente
- [ ] No hay errores de TypeScript

---

## 🌐 Despliegue en Vercel

### Configuración Inicial
1. [ ] Crear cuenta en [Vercel](https://vercel.com)
2. [ ] Conectar repositorio de GitHub
3. [ ] Seleccionar el proyecto

### Configuración del Proyecto
```bash
# Framework Preset
Framework: Angular

# Build Command
npm run build:prod

# Output Directory
dist/ecommerce-app/browser

# Install Command
npm install
```

### Variables de Entorno en Vercel
Ir a: `Settings > Environment Variables`

```env
API_URL=https://back-sport-ghxk.onrender.com
NODE_ENV=production
```

### Deploy
- [ ] Push a la rama `main` para deploy automático
- [ ] O usar: `vercel --prod` desde CLI

---

## 🔥 Despliegue en Netlify

### PWA: entregar el HTML sin transformaciones

Netlify añade actualmente un comentario al HTML estático de este sitio, incluso sin snippets configurados. Esto cambia la huella de `index.html` y Angular rechaza su copia offline.

El comando de `netlify.toml` compila Angular y ejecuta `scripts/prepare-netlify-shell.mjs`. Ese script verifica la huella y genera la función `app-shell`, que devuelve exactamente el HTML compilado y las mismas cabeceras globales. Las navegaciones `/`, `/index.html` y las rutas de Angular usan esa función; los archivos existentes siguen sirviéndose como estáticos. No realiza peticiones al backend. Su respuesta pública se conserva en la CDN y se invalida con cada deploy de Netlify.

La función se genera en `dist/ecommerce-app/functions`; no se sube `dist` a Git. Se publican el script y `netlify.toml` mediante el despliegue desde Git. No se modifica el worker oficial ni se desactivan sus huellas. La exclusión de funciones del mecanismo de snippets está documentada en [Netlify](https://docs.netlify.com/build/post-processing/snippet-injection/#limitations); la comprobación definitiva del comentario automático se realiza después del deploy con `npm run verify:pwa -- https://sport-center-sitie.netlify.app`.

Prueba del generador: `node --test scripts/prepare-netlify-shell.spec.mjs`.

### Configuración
1. [ ] Crear cuenta en [Netlify](https://netlify.com)
2. [ ] Nuevo sitio desde Git
3. [ ] Conectar repositorio

### Build Settings
```bash
# Build command
npm run build:prod && node scripts/prepare-netlify-shell.mjs

# Publish directory
dist/ecommerce-app/browser

# Node version
22
```

### ✅ Archivo `netlify.toml` (Ya creado en raíz)
El proyecto ya incluye `netlify.toml` con:
- ✅ Redirects para SPA routing
- ✅ Headers de seguridad
- ✅ Configuración de cache
- ✅ Node version

### Pasos en Netlify:

#### 1. Importar desde Git
- Ir a https://app.netlify.com
- Click en "Add new site" > "Import an existing project"
- Seleccionar GitHub
- Autorizar acceso a tu repositorio
- Seleccionar el repositorio `ecommerce-app`

#### 2. Configurar Build
Netlify **detectará automáticamente** el `netlify.toml`, pero verifica:
- Base directory: (dejar vacío)
- Build command: `npm run build:prod && node scripts/prepare-netlify-shell.mjs`
- Publish directory: `dist/ecommerce-app/browser`

#### 3. Deploy
- Click en "Deploy site"
- Esperar 2-3 minutos
- ✅ Tu sitio estará en: `https://random-name.netlify.app`

#### 4. (Opcional) Configurar dominio personalizado
- Settings > Domain management
- Add custom domain
- Configurar DNS

### Variables de Entorno (No necesarias)
- ❌ NO necesitas configurar variables de entorno
- ✅ La URL de la API ya está en `environment.prod.ts`
- ✅ Se sube a Git porque es configuración pública

### Problemas Comunes

**Error: Page not found (404) al navegar**
- Causa: Falta configuración de redirects para SPA
- Solución: Verificar que existe `netlify.toml` en la raíz

**Error: Build falla**
- Causa: Node version incorrecta
- Solución: Verificar `netlify.toml` tiene `NODE_VERSION = "22"`

**Sesión se pierde al hacer refresh**
- Causa: Cache mal configurado
- Solución: Verificar headers de cache en `netlify.toml`

---

## 🔷 Despliegue en Firebase Hosting

### Setup Inicial
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

### Configuración `firebase.json`
```json
{
  "hosting": {
    "public": "dist/ecommerce-app/browser",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Deploy
```bash
npm run build:prod
firebase deploy
```

---

## 🧪 Testing Post-Despliegue

### Funcionalidades Críticas
- [ ] Login funciona con credenciales válidas
- [ ] Register crea usuarios correctamente
- [ ] Redirección automática según rol funciona
- [ ] Dashboards cargan correctamente
- [ ] Guards protegen rutas correctamente
- [ ] Logout limpia la sesión
- [ ] Navbar muestra usuario logueado
- [ ] Token se guarda en localStorage
- [ ] HTTP Interceptor agrega Authorization header

### Testing por Rol

**Usuario (Rol 1)**
- [ ] Puede acceder a `/dashboard/usuario`
- [ ] NO puede acceder a `/dashboard/empleado`
- [ ] NO puede acceder a `/dashboard/admin`

**Empleado (Rol 2)**
- [ ] Puede acceder a `/dashboard/empleado`
- [ ] NO puede acceder a `/dashboard/admin`

**Admin (Rol 3)**
- [ ] Puede acceder a `/dashboard/admin`
- [ ] CRUD de usuarios funciona
- [ ] Modal de crear/editar usuario funciona
- [ ] Filtros de búsqueda funcionan

### Performance
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 5s
- [ ] Lighthouse Score > 90

---

## 🔍 Troubleshooting

### Error: API no responde
- Verificar que `API_URL` esté correctamente configurado
- Verificar CORS en el backend
- Verificar que el backend esté activo

### Error: Token inválido
- Verificar que el JWT contenga: `id`, `email`, `rol`
- Verificar que el backend devuelva `{ "token": "..." }`

### Error: Rutas 404 en producción
- Agregar rewrite rules para SPA
- Netlify: usar `_redirects` o `netlify.toml`
- Vercel: usar `vercel.json` con rewrites

### Error: Variables de entorno no funcionan
- En Vercel/Netlify: configurar en el panel web
- Re-deploy después de cambiar variables
- NO usar `process.env` en Angular, usar `environment.ts`

---

## 📊 Métricas de Éxito

### Build
- ✅ Bundle size inicial: ~103 KB
- ✅ Lazy chunks: 11 componentes
- ✅ Dashboard Admin: 53 KB
- ✅ Dashboard Empleado: 33 KB
- ✅ Dashboard Usuario: 26 KB

### Performance
- ✅ Time to First Byte < 200ms
- ✅ First Contentful Paint < 1.5s
- ✅ Largest Contentful Paint < 2.5s

---

## 🔒 Post-Despliegue

- [ ] Cambiar credenciales de admin por defecto
- [ ] Configurar SSL/HTTPS (automático en Vercel/Netlify)
- [ ] Configurar dominio personalizado
- [ ] Configurar analytics (Google Analytics, etc.)
- [ ] Configurar monitoreo de errores (Sentry, etc.)
- [ ] Backup de base de datos configurado
- [ ] Documentar APIs y endpoints

---

## 📞 Contacto y Soporte

- **Equipo**: Sport Center Dev Team
- **Email**: soporte@sportcenter.com
- **Docs**: README.md en el repositorio

---

✅ **¡Proyecto listo para producción!**
