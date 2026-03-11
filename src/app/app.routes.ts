import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard, empleadoGuard, usuarioGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./shared/components/home/home').then((m) => m.Home),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/product-list/product-list').then((m) => m.ProductList),
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./features/products/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: 'marca/:nombre',
      loadComponent: () => import('./features/products/product-marca/product-marca').then((m) => m.ProductMarca),
    },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart').then((m) => m.Cart),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/products/checkout/checkout').then((m) => m.Checkout),
    canActivate: [authGuard],
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/email-verification',
    loadComponent: () =>
      import('./features/auth/email-verification/email-verification').then(
        (m) => m.EmailVerificationComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/verify-account',
    loadComponent: () =>
      import(
        './features/auth/verify-account/verify-account'
      ).then((m) => m.VerifyAccountComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard/usuario',
    loadComponent: () =>
      import('./features/dashboard/usuario/dashboard-usuario').then((m) => m.DashboardUsuario),
    canActivate: [authGuard, usuarioGuard],
  },
  {
    path: 'dashboard/empleado',
    loadComponent: () =>
      import('./features/dashboard/empleado/dashboard-empleado').then((m) => m.DashboardEmpleado),
    canActivate: [authGuard, empleadoGuard],
  },
  {
    path: 'dashboard/admin',
    loadComponent: () =>
      import('./features/dashboard/admin/dashboard-admin').then((m) => m.DashboardAdmin),
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/products/products').then((m) => m.Products),
      },
       {
        path: 'new-products',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/new-products/new-products').then((m) => m.NewProducts),
      },
      {
        path: 'profile',
          loadComponent: () => import('./features/dashboard/pofile/profile').then((m) => m.Profile),
          canActivate: [authGuard],
        },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/categories/categories').then((m) => m.Categories),
      },
      {
        path: 'marcas',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/marcas/marcas').then((m) => m.Marcas),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/inventario/inventario').then((m) => m.Inventario),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/users/users').then((m) => m.Users),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'backups',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/backups/backups').then((m) => m.Backups),
      },
      {
        path: 'empresa',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/empresa/empresa').then((m) => m.Empresa),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/dashboard/admin/admin-pages/reports/reports').then((m) => m.Reports),
      },
    ],
  },
  {
    path: 'dashboard/usuario/profile',
      loadComponent: () => import('./features/dashboard/pofile/profile').then((m) => m.Profile),
      canActivate: [authGuard],
    },
  {
    path: 'ofertas',
    loadComponent: () => import('./features/offers/offers').then((m) => m.Offers),
  },
   {
    path: 'info/ubicacion',
    loadComponent: () => import('./features/info/ubicacion/ubicacion').then((m) => m.Ubicacion),
  },
  {
    path: 'info/nosotros',
    loadComponent: () => import('./features/info/nosotros/nosotros').then((m) => m.Nosotros),
  },
  {
    path: 'legal/terms',
    loadComponent: () =>
      import('./features/legal/terms/terms').then((m) => m.TermsComponent),
  },
  {
    path: 'legal/privacy',
    loadComponent: () =>
      import('./features/legal/privacy/privacy').then((m) => m.PrivacyComponent),
  },
  {
    path: 'error/400',
    loadComponent: () => import('./features/errors/error-page').then((m) => m.ErrorPage),
    data: {
      status: 400,
      badge: 'Solicitud incorrecta',
      title: 'Algo no cuadra en la solicitud',
      description:
        'El servidor no pudo interpretar la petición. Puede que falte información o que un enlace haya expirado.',
      recommendation:
        'Refresca la página e intenta de nuevo. Si llegaste desde un enlace antiguo, prueba navegar desde el inicio.',
      primaryAction: { label: 'Ir al inicio', route: '/home' },
      secondaryAction: { label: 'Abrir catálogo', route: '/products' },
      quickLinks: [
        { label: 'Catálogo', description: 'Explora todo el catálogo', route: '/products', icon: 'storefront' },
        { label: 'Carrito', description: 'Revisa tu selección', route: '/cart', icon: 'shopping_cart' },
        { label: 'Inicio', description: 'Volver a empezar', route: '/home', icon: 'home' },
      ],
    },
  },
  {
    path: 'error/404',
    loadComponent: () => import('./features/errors/error-page').then((m) => m.ErrorPage),
    data: {
      status: 404,
      badge: 'Página no encontrada',
      title: 'Lo que buscas no está aquí…',
      description:
        'No pudimos encontrar esta sección. Es posible que el enlace haya cambiado o que esté mal escrito.',
      recommendation:
        'Usa los accesos rápidos o la barra de búsqueda para llegar a la sección correcta sin perder tiempo.',
      primaryAction: { label: 'Volver al inicio', route: '/home' },
      secondaryAction: { label: 'Ver ofertas', route: '/ofertas' },
    },
  },
  {
    path: 'error/500',
    loadComponent: () => import('./features/errors/error-page').then((m) => m.ErrorPage),
    data: {
      status: 500,
      badge: 'Error del servidor',
      title: 'Ups, algo falló en nuestro lado',
      description:
        'Tuvimos un problema inesperado al procesar tu solicitud. Tu carrito y sesión siguen protegidos.',
      recommendation:
        'Intenta nuevamente en unos segundos o vuelve al inicio mientras nuestro equipo revisa el incidente.',
      primaryAction: { label: 'Reintentar', action: 'reload' },
      secondaryAction: { label: 'Ir al inicio', route: '/home' },
      quickLinks: [
        { label: 'Inicio', description: 'Volver al comienzo', route: '/home', icon: 'home' },
        { label: 'Catálogo', description: 'Seguir explorando', route: '/products', icon: 'storefront' },
        { label: 'Ofertas', description: 'Ver promociones', route: '/ofertas', icon: 'local_fire_department' },
      ],
    },
  },
  {
    path: 'support/help',
    loadComponent: () => import('./features/support/help/help').then((m) => m.HelpPage),
  },
  {
    path: 'support/contact',
    loadComponent: () => import('./features/support/contact/contact').then((m) => m.ContactPage),
  },
  {  path: 'support/preguntas-frecuentes',
    loadComponent: () => import('./features/support/faqs/faqs').then((m) => m.Faqs),
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/error-page').then((m) => m.ErrorPage),
    data: {
      status: 404,
      badge: 'Página no encontrada',
      title: 'Lo que buscas no está aquí…',
      description:
        'No pudimos encontrar esta sección. Es posible que el enlace haya cambiado o que esté mal escrito.',
      recommendation:
        'Usa los accesos rápidos o la barra de búsqueda para llegar a la sección correcta sin perder tiempo.',
      primaryAction: { label: 'Volver al inicio', route: '/home' },
      secondaryAction: { label: 'Ver ofertas', route: '/ofertas' },
    },
  },
];