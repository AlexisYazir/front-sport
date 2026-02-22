import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

type ErrorAction =
  | { label: string; route: string }
  | { label: string; action: 'back' | 'reload' };

interface QuickLink {
  label: string;
  description: string;
  route: string;
  icon: string;
}

interface ErrorConfig {
  status: number;
  badge: string;
  title: string;
  description: string;
  recommendation: string;
  primaryAction: ErrorAction;
  secondaryAction?: ErrorAction;
  quickLinks: QuickLink[];
}

const baseQuickLinks: QuickLink[] = [
  {
    label: 'Inicio',
    description: 'Vuelve al escaparate principal',
    route: '/home',
    icon: 'home',
  },
  {
    label: 'Catálogo',
    description: 'Explora todos los productos',
    route: '/products',
    icon: 'storefront',
  },
  {
    label: 'Ofertas',
    description: 'Encuentra descuentos activos',
    route: '/ofertas',
    icon: 'local_fire_department',
  },
  {
    label: 'Carrito',
    description: 'Revisa lo que ya agregaste',
    route: '/cart',
    icon: 'shopping_cart',
  },
  {
    label: 'Soporte',
    description: 'Recibe ayuda con tu compra',
    route: '/auth/forgot-password',
    icon: 'support_agent',
  },
];

const defaultConfig: ErrorConfig = {
  status: 404,
  badge: 'Página no encontrada',
  title: 'Lo que buscas no está aquí…',
  description: 'No pudimos encontrar esta sección. Puede que el enlace esté roto o que se haya movido.',
  recommendation: 'Revisa la dirección o usa los accesos rápidos para volver a navegar sin perder tiempo.',
  primaryAction: { label: 'Ir al inicio', route: '/home' },
  secondaryAction: { label: 'Explorar catálogo', route: '/products' },
  quickLinks: baseQuickLinks.slice(0, 3),
};

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './error-page.html',
  styleUrl: './error-page.css',
})
export class ErrorPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  config = signal<ErrorConfig>(defaultConfig);

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const customQuickLinks = (data['quickLinks'] as QuickLink[] | undefined)?.length
        ? (data['quickLinks'] as QuickLink[])
        : defaultConfig.quickLinks;

      this.config.set({
        ...defaultConfig,
        ...data,
        quickLinks: customQuickLinks,
      });
    });
  }

  isRouteAction(action: ErrorAction | undefined): action is Extract<ErrorAction, { route: string }> {
    return !!action && 'route' in action;
  }

  isCallbackAction(action: ErrorAction | undefined): action is Extract<ErrorAction, { action: string }> {
    return !!action && 'action' in action;
  }

  go(action?: ErrorAction): void {
    if (!action) return;

    if ('route' in action) {
      this.router.navigate([action.route]);
      return;
    }

    if (action.action === 'back') {
      this.goBack();
      return;
    }

    if (action.action === 'reload') {
      this.reload();
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/home']);
    }
  }

  reload(): void {
    window.location.reload();
  }
}
