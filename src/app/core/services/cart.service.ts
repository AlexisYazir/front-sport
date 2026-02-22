import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, CartSummary } from '../models/cart.model';
import { Product } from '../models/product.model';
import { ToastrService } from 'ngx-toastr';

export interface AddToCartRequest {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();
  
  // Signals para estado reactivo
  cartItems = signal<CartItem[]>([]);
  
  // Computed properties
  itemCount = computed(() => 
    this.cartItems().reduce((count, item) => count + item.quantity, 0)
  );
  
  subtotal = computed(() => 
    this.cartItems().reduce((total, item) => {
      const itemPrice = this.getItemPrice(item.product);
      return total + (itemPrice * item.quantity);
    }, 0)
  );
  
  discount = computed(() => {
    return this.cartItems().reduce((totalDiscount, item) => {
      if (item.product.descuento && item.product.descuento > 0) {
        const originalPrice = item.product.precio;
        const discountAmount = originalPrice * (item.product.descuento / 100);
        return totalDiscount + (discountAmount * item.quantity);
      }
      return totalDiscount;
    }, 0);
  });
  
  shipping = computed(() => {
    const subtotal = this.subtotal();
    if (subtotal === 0) return 0;
    if (subtotal >= 2000) return 0; // Envío gratis por compras sobre $50,000
    return 200; // Costo fijo de envío
  });
  
  tax = computed(() => {
    const subtotal = this.subtotal() - this.discount();
    return subtotal * 0.19; // IVA 19%
  });
  
  total = computed(() => {
    return this.subtotal() - this.discount() + this.shipping() + this.tax();
  });
  
  summary = computed((): CartSummary => ({
    subtotal: this.subtotal(),
    discount: this.discount(),
    shipping: this.shipping(),
    tax: this.tax(),
    total: this.total(),
    itemCount: this.itemCount()
  }));

  constructor(private toastr: ToastrService) {
    // Cargar carrito desde localStorage al inicializar
    this.loadCartFromStorage();
  }

  addItem(request: AddToCartRequest): void {
    const { product, quantity, selectedSize, selectedColor } = request;
    
    // Validar disponibilidad
    if (!product.disponible || product.stock === 0) {
      this.toastr.error('Este producto no está disponible', 'No disponible');
      return;
    }

    if (quantity > product.stock) {
      this.toastr.error(`Solo hay ${product.stock} unidades disponibles`, 'Stock insuficiente');
      return;
    }

    const currentItems = this.cartItems();
    
    // Buscar si el producto ya existe en el carrito con las mismas características
    const existingItemIndex = currentItems.findIndex(item => 
      item.product.id === product.id &&
      item.selectedSize === selectedSize &&
      item.selectedColor === selectedColor
    );

    if (existingItemIndex >= 0) {
      // Si existe, actualizar cantidad
      const existingItem = currentItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      if (newQuantity > product.stock) {
        this.toastr.error(`Solo puedes agregar ${product.stock - existingItem.quantity} unidades más`, 'Stock insuficiente');
        return;
      }
      
      const updatedItems = [...currentItems];
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity
      };
      
      this.cartItems.set(updatedItems);
      this.toastr.success(`Cantidad actualizada: ${newQuantity} ${product.nombre}`, 'Carrito actualizado');
    } else {
      // Si no existe, agregar nuevo item
      const newItem: CartItem = {
        product,
        quantity,
        selectedSize,
        selectedColor,
        addedAt: new Date()
      };
      
      this.cartItems.set([...currentItems, newItem]);
      this.toastr.success(`${product.nombre} agregado al carrito`, 'Producto agregado');
    }
    
    this.saveCartToStorage();
    this.cartItemsSubject.next(this.cartItems());
  }

  removeItem(productId: number, selectedSize?: string, selectedColor?: string): void {
    const currentItems = this.cartItems();
    const updatedItems = currentItems.filter(item => 
      !(item.product.id === productId &&
        item.selectedSize === selectedSize &&
        item.selectedColor === selectedColor)
    );
    
    this.cartItems.set(updatedItems);
    this.saveCartToStorage();
    this.cartItemsSubject.next(this.cartItems());
    this.toastr.info('Producto eliminado del carrito', 'Carrito actualizado');
  }

  updateQuantity(productId: number, newQuantity: number, selectedSize?: string, selectedColor?: string): void {
    if (newQuantity <= 0) {
      this.removeItem(productId, selectedSize, selectedColor);
      return;
    }

    const currentItems = this.cartItems();
    const itemIndex = currentItems.findIndex(item => 
      item.product.id === productId &&
      item.selectedSize === selectedSize &&
      item.selectedColor === selectedColor
    );

    if (itemIndex >= 0) {
      const item = currentItems[itemIndex];
      
      if (newQuantity > item.product.stock) {
        this.toastr.error(`Solo hay ${item.product.stock} unidades disponibles`, 'Stock insuficiente');
        return;
      }

      const updatedItems = [...currentItems];
      updatedItems[itemIndex] = {
        ...item,
        quantity: newQuantity
      };
      
      this.cartItems.set(updatedItems);
      this.saveCartToStorage();
      this.cartItemsSubject.next(this.cartItems());
    }
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.saveCartToStorage();
    this.cartItemsSubject.next([]);
    this.toastr.info('Carrito vaciado', 'Carrito');
  }

  getItemPrice(product: Product): number {
    if (product.descuento && product.descuento > 0) {
      return product.precio * (1 - product.descuento / 100);
    }
    return product.precio;
  }

  getItemTotal(item: CartItem): number {
    return this.getItemPrice(item.product) * item.quantity;
  }

  private saveCartToStorage(): void {
    try {
      localStorage.setItem('sport-center-cart', JSON.stringify(this.cartItems()));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }

  private loadCartFromStorage(): void {
    try {
      const savedCart = localStorage.getItem('sport-center-cart');
      if (savedCart) {
        const cartItems = JSON.parse(savedCart) as CartItem[];
        
        // Validar y limpiar items que puedan estar corruptos
        const validItems = cartItems.filter(item => 
          item.product && 
          item.product.id && 
          item.quantity > 0
        ).map(item => ({
          ...item,
          addedAt: new Date(item.addedAt)
        }));
        
        this.cartItems.set(validItems);
        this.cartItemsSubject.next(validItems);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      this.cartItems.set([]);
    }
  }

  // Método para obtener información detallada de un item
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

  // Verificar si hay stock suficiente para todos los items del carrito
  validateCartStock(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    const currentItems = this.cartItems();
    
    for (const item of currentItems) {
      if (!item.product.disponible) {
        issues.push(`${item.product.nombre} ya no está disponible`);
      } else if (item.quantity > item.product.stock) {
        issues.push(`${item.product.nombre}: solo hay ${item.product.stock} unidades disponibles`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}