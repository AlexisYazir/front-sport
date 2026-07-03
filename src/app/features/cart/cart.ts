import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CartItem } from '../../core/models/cart.model';
import { ProductService } from '../../core/services/product.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class Cart implements OnInit {
  private cartService = inject(CartService);
  private router = inject(Router);
  private productService = inject(ProductService);

  // Signals del servicio
  cartItems = this.cartService.cartItems;
  cartSummary = this.cartService.summary;
  freeShippingRemaining = this.cartService.freeShippingRemaining;
  
  // Estado local
  isProcessing = signal<boolean>(false);
  clearingCart = signal<boolean>(false);
  showClearCartModal = signal<boolean>(false);
  animatingItemKey = signal<string | null>(null);
  removingItemKeys = signal<Set<string>>(new Set());

  // Computed properties
  isEmpty = computed(() => this.cartItems().length === 0);
  canCheckout = computed(() => {
    if (this.isEmpty()) return false;
    const validation = this.cartService.validateCartStock();
    return validation.isValid;
  });
  ngOnInit(): void {
    this.cartService.loadCart().subscribe();
  }

  updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }

    const itemKey = this.getItemKey(item);
    this.animatingItemKey.set(itemKey);
    window.setTimeout(() => {
      if (this.animatingItemKey() === itemKey) {
        this.animatingItemKey.set(null);
      }
    }, 360);
    
    this.cartService.updateQuantity(
      item.product.id, 
      newQuantity, 
      item.selectedSize, 
      item.selectedColor
    );
  }

  removeItem(item: CartItem) {
    const itemKey = this.getItemKey(item);
    this.removingItemKeys.update((current) => {
      const next = new Set(current);
      next.add(itemKey);
      return next;
    });

    window.setTimeout(() => {
      this.cartService.removeItem(
        item.product.id, 
        item.selectedSize, 
        item.selectedColor
      );
      this.removingItemKeys.update((current) => {
        const next = new Set(current);
        next.delete(itemKey);
        return next;
      });
    }, 260);
  }

  clearCart() {
    this.showClearCartModal.set(true);
  }

  closeClearCartModal() {
    if (!this.clearingCart()) {
      this.showClearCartModal.set(false);
    }
  }

  confirmClearCart() {
    this.clearingCart.set(true);
    window.setTimeout(() => {
      this.cartService.clearCart();
      this.clearingCart.set(false);
      this.showClearCartModal.set(false);
    }, 280);
  }

  continueShopping() {
    this.router.navigate(['/products']);
  }

  proceedToCheckout() {
    if (!this.canCheckout()) {
      return;
    }
    
    this.isProcessing.set(true);
    
    // Simular validación final
    setTimeout(() => {
      this.router.navigate(['/checkout']);
      this.isProcessing.set(false);
    }, 1000);
  }

  getItemTotal(item: CartItem): number {
    return this.cartService.getItemTotal(item);
  }

  getItemInfo(item: CartItem): string {
    return this.cartService.getItemInfo(item);
  }

  getItemPrice(item: CartItem): number {
    return this.cartService.getItemPrice(item);
  }

  hasDiscount(item: CartItem): boolean {
    return !!(item.product.descuento && item.product.descuento > 0);
  }

  getOriginalPrice(item: CartItem): number {
    return item.product.precio;
  }

  getDiscountPercentage(item: CartItem): number {
    return item.product.descuento || 0;
  }

  getStockWarning(item: CartItem): string | null {
    if (!item.product.disponible) {
      return 'Producto no disponible';
    }
    
    if (item.quantity > item.product.stock) {
      return `Solo hay ${item.product.stock} unidades disponibles`;
    }
    
    if (item.product.stock <= 5) {
      return `Últimas ${item.product.stock} unidades`;
    }
    
    return null;
  }

  hasStockWarning(item: CartItem): boolean {
    return this.getStockWarning(item) !== null;
  }

  getProductLink(item: CartItem): string[] {
    return this.productService.buildProductDetailRoute(item.product);
  }

  getItemKey(item: CartItem): string {
    const variantId = item.id_variante ?? item.variant?.id_variante ?? item.product.id;
    return `${variantId}-${item.selectedSize || ''}-${item.selectedColor || ''}`;
  }

  isItemAnimating(item: CartItem): boolean {
    return this.animatingItemKey() === this.getItemKey(item);
  }

  isItemRemoving(item: CartItem): boolean {
    return this.removingItemKeys().has(this.getItemKey(item));
  }

  isStockCritical(item: CartItem): boolean {
    return !item.product.disponible || item.quantity > item.product.stock;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
