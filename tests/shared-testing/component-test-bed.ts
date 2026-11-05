import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Params, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideLucideIcons } from '@lucide/angular';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AuthService } from '../../src/app/core/services/auth.service';
import { User, UserRole } from '../../src/app/core/models/user.model';
import { CheckoutSummaryResponse } from '../../src/app/core/models/cart.model';
import { DemandReport } from '../../src/app/core/services/data-mining.service';
import { SPORT_CENTER_ICONS } from '../../src/app/shared/icons/sport-center-icons';
import { environment } from '../../src/environments/environment';

export const qaUser: User = { id: 77, nombre: 'Administración QA', aPaterno: 'Prueba', aMaterno: 'Local', email: 'admin@example.invalid', telefono: '0000000000', rol: UserRole.ADMIN, activo: 1 };

// El helper prepara dependencias, no sustituye el componente ni sus servicios de datos.
export function componentTestProviders(params: Params = {}): (Provider | EnvironmentProviders)[] {
  const auth = jasmine.createSpyObj<AuthService>('AuthService QA', ['isLoggedIn', 'getCurrentUser', 'currentUser$', 'hasRole', 'hasAnyRole', 'getUsers', 'getRoles', 'getProfile', 'logout'], {
    currentUser: signal<User | null>(qaUser), isAuthenticated: signal(true), isLoading: signal(false),
  });
  auth.isLoggedIn.and.returnValue(true); auth.getCurrentUser.and.returnValue(qaUser);
  auth.currentUser$.and.returnValue(of(qaUser));
  auth.hasRole.and.callFake(role => role === UserRole.ADMIN);
  auth.hasAnyRole.and.callFake(roles => roles.includes(UserRole.ADMIN));
  auth.getUsers.and.returnValue(of([])); auth.getRoles.and.returnValue(of([]));
  auth.getProfile.and.returnValue(of({
    nombre: qaUser.nombre, aPaterno: qaUser.aPaterno, aMaterno: qaUser.aMaterno,
    email: qaUser.email, telefono: qaUser.telefono, rol: qaUser.rol,
    ubicacion: null, fecha_creacion: '2026-01-01T00:00:00Z',
  }));
  return [
    provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
    provideLucideIcons(...SPORT_CENTER_ICONS),
    { provide: AuthService, useValue: auth },
    { provide: ToastrService, useValue: jasmine.createSpyObj<ToastrService>('Toastr QA', ['success', 'error', 'info', 'warning', 'clear']) },
    { provide: ActivatedRoute, useValue: {
      snapshot: { params, paramMap: convertToParamMap(params), queryParamMap: convertToParamMap({}) },
      params: of(params), paramMap: of(convertToParamMap(params)), queryParams: of({}),
      queryParamMap: of(convertToParamMap({})), url: of([]), data: of({}), fragment: of(null),
    } },
  ];
}

const emptySummary: CheckoutSummaryResponse = {
  cart: { id_carrito: null, items: [] }, addresses: [], shippingMethods: [], paymentMethods: [], appliedPromotion: null,
  selectedShippingMethod: { id_metodo_envio: 1, nombre: 'Envío QA', costo_base: 0, dias_min: 1, dias_max: 2 },
  totals: { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0, itemCount: 0, freeShippingRemaining: 0 },
};
const emptyDemand: DemandReport = {
  meta: { source: 'fixture', resultSource: 'fixture', model: 'QA', generatedAt: '2026-01-01T00:00:00Z', projectedMonth: null, historicalRecords: 0 },
  summary: { variants: 0, projectedDemand: 0, lastDemand: 0, variation: 0, variationPercent: 0, growing: 0, stable: 0, declining: 0 },
  trend: [], products: [], methodology: { objective: 'Prueba aislada', features: [], note: 'Sin datos productivos' },
};
const emptyLists = new Set([
  '/products/get-all-products', '/products/get-all-marcas', '/products/get-all-categories', '/products/get-all-attributes',
  '/products/get-inventory-products', '/products/get-recient-products', '/products/get-products-without-variants-attributes',
  '/products/get-all-orders', '/products/inventory-movements', '/products/inventory-movements/variants',
  '/products/menu/sports', '/products/shipping-methods', '/products/payment-methods',
  '/company/banner', '/company/banner/admin', '/company/faqs',
]);

function responseFor(path: string): object {
  if (emptyLists.has(path)) return [];
  if (path === '/company/info') return { nombre: 'Sport Center QA', mision: 'Misión QA', vision: 'Visión QA', valores: [] };
  if (path === '/products/menu/complete-menu') return { clothing: [], accessories: [], sports: [], brands: [] };
  if (path === '/products/checkout/summary') return emptySummary;
  if (path === '/reports/data-mining/demand') return emptyDemand;
  if (path === '/products/recommendations/7') return { productId: 7, model: 'QA', recommendations: [] };
  if (path === '/products/get-product-details/7') return [{ id_producto: 7, producto: 'Balón QA', descripcion: 'Producto de prueba', activo: true, categoria: 'Balones', marca: 'Marca QA', deportes: [], variantes: [{ id_variante: 71, sku: 'QA-71', precio: 100, stock: 8, imagenes: [], atributos: {} }] }];
  if (path === '/products/reviews/product/7') return { reviews: [], summary: { total: 0, promedio: 0 } };
  if (path === '/products/reviews/product/7/eligibility') return { canReview: false, hasDeliveredPurchase: false, hasReview: false, reason: 'Sin compra QA entregada' };
  throw Error('Lectura no preparada en el fixture: ' + path);
}

export function flushComponentReads(http: HttpTestingController): void {
  for (let pass = 0; pass < 5; pass++) {
    const requests = http.match(() => true);
    if (!requests.length) return;
    for (const request of requests) {
      expect(request.request.method).withContext('El montaje no debe escribir datos').toBe('GET');
      if (request.request.method !== 'GET') throw Error('Escritura inesperada en la prueba de montaje');
      expect(request.request.url.startsWith(environment.apiUrl + '/')).toBeTrue();
      request.flush(responseFor(new URL(request.request.url).pathname));
    }
  }
  throw Error('La carga no terminó dentro del número de lecturas esperado');
}
