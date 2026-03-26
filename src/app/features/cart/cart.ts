import { Component, inject, signal, computed } from '@angular/core';
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
export class Cart {
  private cartService = inject(CartService);
  private router = inject(Router);
  private productService = inject(ProductService);

  // Signals del servicio
  cartItems = this.cartService.cartItems;
  cartSummary = this.cartService.summary;
  
  // Estado local
  isProcessing = signal<boolean>(false);

  // Computed properties
  isEmpty = computed(() => this.cartItems().length === 0);
  canCheckout = computed(() => {
    if (this.isEmpty()) return false;
    const validation = this.cartService.validateCartStock();
    return validation.isValid;
  });

  updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }
    
    this.cartService.updateQuantity(
      item.product.id, 
      newQuantity, 
      item.selectedSize, 
      item.selectedColor
    );
  }

  removeItem(item: CartItem) {
    this.cartService.removeItem(
      item.product.id, 
      item.selectedSize, 
      item.selectedColor
    );
  }

  clearCart() {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
      this.cartService.clearCart();
    }
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
    return this.cartService.getItemPrice(item.product);
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

  isStockCritical(item: CartItem): boolean {
    return !item.product.disponible || item.quantity > item.product.stock;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}
