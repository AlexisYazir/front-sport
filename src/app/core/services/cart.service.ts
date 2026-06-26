import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { CartItem, CartSummary } from '../models/cart.model';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.model';

export interface AddToCartRequest {
  product: Product;
  variant?: {
    id_variante: number;
    sku?: string;
    stock?: number;
    precio?: number;
    imagenes?: string[];
    atributos?: Record<string, string | undefined>;
  } | null;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  price?: number;
  sku?: string;
  image?: string;
}

interface ApiCartItem {
  id_carrito: number;
  id_variante: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  precio: number;
  sku: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  categoria: string;
  marca?: string;
  imagen_marca?: string;
  stock: number;
  imagenes: string[];
  imagen?: string;
  atributos: Record<string, string>;
}

interface ApiCartResponse {
  id_carrito: number;
  id_usuario: number;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  items: ApiCartItem[];
}

interface PendingCartAdd {
  id_variante: number;
  cantidad: number;
  requestedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly authService = inject(AuthService);

  private readonly API_URL = environment.apiUrl;
  private readonly PENDING_CART_KEY = 'sport-center-pending-cart-add';
  private readonly LEGACY_CART_KEY = 'sport-center-cart';
  private readonly PENDING_MAX_AGE_MS = 30 * 60 * 1000;

  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();

  cartItems = signal<CartItem[]>([]);
  isLoading = signal<boolean>(false);

  private lastLoadedUserId: number | null = null;
  private pendingCartProcessing = false;

  private authSync = effect(() => {
    const user = this.authService.currentUser();
    const userId = user?.id ? Number(user.id) : null;

    setTimeout(() => {
      if (!userId || !this.canUseCart()) {
        this.lastLoadedUserId = null;
        this.clearPendingCartAdd();
        this.setCartItems([]);
        return;
      }

      const pending = this.getPendingCartAdd();
      if (pending) {
        this.processPendingCartAdd();
        return;
      }

      if (this.lastLoadedUserId !== userId) {
        this.lastLoadedUserId = userId;
        this.loadCart().subscribe();
      }
    }, 0);
  });

  itemCount = computed(() =>
    this.cartItems().reduce((count, item) => count + item.quantity, 0),
  );

  subtotal = computed(() =>
    this.cartItems().reduce((total, item) => {
      return total + this.getItemPrice(item) * item.quantity;
    }, 0),
  );

  discount = computed(() => 0);

  shipping = computed(() => {
    const subtotal = this.subtotal();
    if (subtotal === 0) return 0;
    if (subtotal >= 200) return 0;
    return 130;
  });

  tax = computed(() => 0);

  total = computed(() => this.subtotal() - this.discount() + this.shipping());

  summary = computed((): CartSummary => ({
    subtotal: this.subtotal(),
    discount: this.discount(),
    shipping: this.shipping(),
    tax: this.tax(),
    total: this.total(),
    itemCount: this.itemCount(),
  }));

  constructor() {
    localStorage.removeItem(this.LEGACY_CART_KEY);
  }

  loadCart(): Observable<ApiCartResponse | null> {
    if (!this.authService.isLoggedIn() || !this.canUseCart()) {
      this.setCartItems([]);
      return of(null);
    }

    this.isLoading.set(true);

    return this.http.get<ApiCartResponse>(`${this.API_URL}/products/cart`).pipe(
      tap((response) => this.applyCartResponse(response)),
      catchError((error) => {
        console.error('Error loading cart:', error);
        this.setCartItems([]);
        return of(null);
      }),
      finalize(() => this.isLoading.set(false)),
    );
  }

  addToCart(product: Product, quantity = 1): void {
    const variant =
      product.variantes?.find((item) => Number(item.stock || 0) > 0) ??
      product.variantes?.[0] ??
      null;

    this.addItem({
      product,
      variant,
      quantity,
      selectedSize: variant?.atributos?.['Talla'],
      selectedColor: variant?.atributos?.['Color'],
      image: variant?.imagenes?.[0] ?? product.imagen,
    });
  }

  addItem(request: AddToCartRequest): void {
    if (!this.canUseCart()) {
      this.clearPendingCartAdd();
      this.toastr.info('El carrito solo está disponible para usuarios compradores.', 'Carrito');
      return;
    }

    const idVariante = this.resolveVariantId(request);
    const quantity = Number(request.quantity || 0);

    if (!Number.isInteger(idVariante) || idVariante <= 0) {
      this.toastr.warning('Selecciona una variante válida del producto', 'Carrito');
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      this.toastr.warning('La cantidad debe estar entre 1 y 99', 'Carrito');
      return;
    }

    const stock = Number(request.variant?.stock ?? request.product.stock ?? 0);
    if (stock > 0 && quantity > stock) {
      this.toastr.error(`Solo hay ${stock} unidades disponibles`, 'Stock insuficiente');
      return;
    }

    if (!this.authService.isLoggedIn()) {
      this.savePendingCartAdd({ id_variante: idVariante, cantidad: quantity });
      this.toastr.info('Inicia sesión para agregar este producto al carrito', 'Carrito');
      this.goToLoginForCart();
      return;
    }

    this.persistAddItem(idVariante, quantity).subscribe({
      next: () => {
        this.toastr.success('Producto agregado al carrito', 'Carrito');
      },
      error: (error) => {
        this.toastr.error(
          this.getBackendMessage(error, 'No fue posible agregar el producto al carrito'),
          'Carrito',
        );
      },
    });
  }

  removeItem(productId: number, selectedSize?: string, selectedColor?: string): void {
    const item = this.findItem(productId, selectedSize, selectedColor);
    const idVariante = item?.id_variante ?? item?.variant?.id_variante;

    if (!idVariante) {
      return;
    }

    this.isLoading.set(true);
    this.http
      .delete<ApiCartResponse>(`${this.API_URL}/products/cart/items/${idVariante}`)
      .pipe(
        tap((response) => this.applyCartResponse(response)),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: () => this.toastr.info('Producto eliminado del carrito', 'Carrito actualizado'),
        error: (error) => {
          this.toastr.error(
            this.getBackendMessage(error, 'No fue posible eliminar el producto'),
            'Carrito',
          );
        },
      });
  }

  updateQuantity(
    productId: number,
    newQuantity: number,
    selectedSize?: string,
    selectedColor?: string,
  ): void {
    const quantity = Number(newQuantity);
    const item = this.findItem(productId, selectedSize, selectedColor);
    const idVariante = item?.id_variante ?? item?.variant?.id_variante;

    if (!idVariante || !item) {
      return;
    }

    if (quantity <= 0) {
      this.removeItem(productId, selectedSize, selectedColor);
      return;
    }

    if (!Number.isInteger(quantity) || quantity > 99) {
      this.toastr.warning('La cantidad debe estar entre 1 y 99', 'Carrito');
      return;
    }

    if (quantity > item.product.stock) {
      this.toastr.error(`Solo hay ${item.product.stock} unidades disponibles`, 'Stock insuficiente');
      return;
    }

    this.isLoading.set(true);
    this.http
      .put<ApiCartResponse>(`${this.API_URL}/products/cart/items/${idVariante}`, {
        cantidad: quantity,
      })
      .pipe(
        tap((response) => this.applyCartResponse(response)),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        error: (error) => {
          this.toastr.error(
            this.getBackendMessage(error, 'No fue posible actualizar el carrito'),
            'Carrito',
          );
        },
      });
  }

  clearCart(): void {
    if (!this.authService.isLoggedIn() || !this.canUseCart()) {
      this.setCartItems([]);
      return;
    }

    this.isLoading.set(true);
    this.http
      .delete<ApiCartResponse>(`${this.API_URL}/products/cart`)
      .pipe(
        tap((response) => this.applyCartResponse(response)),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: () => this.toastr.info('Carrito vaciado', 'Carrito'),
        error: (error) => {
          this.toastr.error(
            this.getBackendMessage(error, 'No fue posible vaciar el carrito'),
            'Carrito',
          );
        },
      });
  }

  getItemPrice(item: CartItem): number {
    if (Number.isFinite(Number(item.price))) {
      return Number(item.price);
    }

    if (item.product.descuento && item.product.descuento > 0) {
      return item.product.precio * (1 - item.product.descuento / 100);
    }

    return Number(item.product.precio || 0);
  }

  getItemTotal(item: CartItem): number {
    return this.getItemPrice(item) * item.quantity;
  }

  getItemInfo(item: CartItem): string {
    const parts = [item.product.nombre];

    if (item.selectedSize) {
      parts.push(`Talla: ${item.selectedSize}`);
    }

    if (item.selectedColor) {
      parts.push(`Color: ${item.selectedColor}`);
    }

    return parts.join(' - ');
  }

  validateCartStock(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const item of this.cartItems()) {
      if (!item.product.disponible) {
        issues.push(`${item.product.nombre} ya no está disponible`);
      } else if (item.quantity > item.product.stock) {
        issues.push(`${item.product.nombre}: solo hay ${item.product.stock} unidades disponibles`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private persistAddItem(idVariante: number, cantidad: number): Observable<ApiCartResponse> {
    this.isLoading.set(true);

    return this.http
      .post<ApiCartResponse>(`${this.API_URL}/products/cart/items`, {
        id_variante: idVariante,
        cantidad,
      })
      .pipe(
        tap((response) => this.applyCartResponse(response)),
        finalize(() => this.isLoading.set(false)),
      );
  }

  private processPendingCartAdd(): void {
    if (this.pendingCartProcessing || !this.authService.isLoggedIn() || !this.canUseCart()) {
      if (!this.canUseCart()) {
        this.clearPendingCartAdd();
        this.setCartItems([]);
      }
      return;
    }

    const pending = this.getPendingCartAdd();
    if (!pending) {
      return;
    }

    if (Date.now() - pending.requestedAt > this.PENDING_MAX_AGE_MS) {
      this.clearPendingCartAdd();
      this.loadCart().subscribe();
      return;
    }

    this.pendingCartProcessing = true;
    this.persistAddItem(pending.id_variante, pending.cantidad)
      .pipe(finalize(() => (this.pendingCartProcessing = false)))
      .subscribe({
        next: () => {
          this.clearPendingCartAdd();
          this.toastr.success('Producto agregado al carrito', 'Carrito');
        },
        error: (error) => {
          this.clearPendingCartAdd();
          this.toastr.error(
            this.getBackendMessage(error, 'No fue posible agregar el producto al carrito'),
            'Carrito',
          );
          this.loadCart().subscribe();
        },
      });
  }

  private applyCartResponse(response: ApiCartResponse): void {
    const items = Array.isArray(response?.items)
      ? response.items.map((item) => this.mapCartItemFromApi(item))
      : [];

    this.setCartItems(items);
  }

  private mapCartItemFromApi(item: ApiCartItem): CartItem {
    const atributos = item.atributos || {};
    const image =
      item.imagen ||
      (Array.isArray(item.imagenes) && item.imagenes.length > 0
        ? item.imagenes[0]
        : 'assets/images/no-image.jpg');
    const stock = Number(item.stock || 0);
    const price = Number(item.precio_unitario || item.precio || 0);

    const product: Product = {
      id: Number(item.id_producto),
      id_producto: Number(item.id_producto),
      nombre: item.nombre,
      producto: item.nombre,
      descripcion: item.descripcion || '',
      precio: price,
      imagen: image,
      imagenes: item.imagenes || [],
      categoria: item.categoria || '',
      stock,
      disponible: item.activo === true && stock > 0,
      marca: item.marca,
      imagen_marca: item.imagen_marca,
      descuento: 0,
      activo: item.activo,
      variantes: [
        {
          id_variante: Number(item.id_variante),
          sku: item.sku,
          stock,
          precio: Number(item.precio || price),
          imagenes: item.imagenes || [],
          atributos,
        },
      ],
    };

    return {
      product,
      variant: {
        id_variante: Number(item.id_variante),
        id_producto: Number(item.id_producto),
        sku: item.sku,
        stock,
        precio: Number(item.precio || price),
        imagenes: item.imagenes || [],
        atributos,
      },
      id_variante: Number(item.id_variante),
      quantity: Number(item.cantidad || 0),
      selectedSize: atributos['Talla'],
      selectedColor: atributos['Color'],
      price,
      sku: item.sku,
      image,
      addedAt: new Date(),
    };
  }

  private setCartItems(items: CartItem[]): void {
    this.cartItems.set(items);
    this.cartItemsSubject.next(items);
  }

  private resolveVariantId(request: AddToCartRequest): number {
    const selectedVariant =
      request.variant ??
      request.product.variantes?.find((variant) => {
        const attrs = variant.atributos || {};
        return (
          (!request.selectedSize || attrs['Talla'] === request.selectedSize) &&
          (!request.selectedColor || attrs['Color'] === request.selectedColor)
        );
      }) ??
      request.product.variantes?.find((variant) => Number(variant.stock || 0) > 0) ??
      request.product.variantes?.[0];

    return Number(selectedVariant?.id_variante || 0);
  }

  private findItem(
    productId: number,
    selectedSize?: string,
    selectedColor?: string,
  ): CartItem | undefined {
    return this.cartItems().find(
      (item) =>
        Number(item.product.id) === Number(productId) &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor,
    );
  }

  private savePendingCartAdd(pending: Omit<PendingCartAdd, 'requestedAt'>): void {
    localStorage.setItem(
      this.PENDING_CART_KEY,
      JSON.stringify({
        ...pending,
        requestedAt: Date.now(),
      }),
    );
  }

  private getPendingCartAdd(): PendingCartAdd | null {
    try {
      const raw = localStorage.getItem(this.PENDING_CART_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as PendingCartAdd;
      const idVariante = Number(parsed.id_variante);
      const cantidad = Number(parsed.cantidad);
      const requestedAt = Number(parsed.requestedAt);

      if (
        !Number.isInteger(idVariante) ||
        idVariante <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0 ||
        !Number.isFinite(requestedAt)
      ) {
        this.clearPendingCartAdd();
        return null;
      }

      return {
        id_variante: idVariante,
        cantidad,
        requestedAt,
      };
    } catch {
      this.clearPendingCartAdd();
      return null;
    }
  }

  private clearPendingCartAdd(): void {
    localStorage.removeItem(this.PENDING_CART_KEY);
  }

  private goToLoginForCart(): void {
    const currentUrl = this.router.url && !this.router.url.startsWith('/auth/login')
      ? this.router.url
      : '/cart';

    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: currentUrl },
    });
  }

  private canUseCart(): boolean {
    const user = this.authService.currentUser();
    return !user || user.rol === UserRole.USUARIO;
  }

  private getBackendMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return message || error?.error?.error || fallback;
  }
}
