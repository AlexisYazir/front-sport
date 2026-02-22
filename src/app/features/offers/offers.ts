import { Component, Inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { Product } from '../../core/models/product.model';
import { BreadcrumbItem } from '../../shared/components/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-offers',
  imports: [CommonModule, RouterModule],
  templateUrl: './offers.html',
  styleUrl: './offers.css',
})
export class Offers implements OnInit, OnDestroy {
  private toastr = Inject(ToastrService);
  private productService = Inject(ProductService);
  private cartService = Inject(CartService);
  private router = Inject(Router);

  // Signals para el estado reactivo
  offerProducts = signal<Product[]>([]);
  featuredOffers = signal<Product[]>([]);
  loading = signal(true);
  
  // Countdown timer
  timeRemaining = signal({
    days: 2,
    hours: 14,
    minutes: 45,
    seconds: 32
  });

  private countdownInterval?: number;

  // Computed para el contador del carrito
  cartCount = computed(() => this.cartService.cartItems().length);

  // Breadcrumbs
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/home' },
    { label: 'Ofertas', url: '/offers' }
  ];

  ngOnInit() {
    this.loadOfferProducts();
    this.startCountdown();
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  loadOfferProducts() {
    this.loading.set(true);
    
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        // Filtrar productos con descuento
        const productsWithOffers = products.filter(p => 
          p.descuento && p.descuento > 0
        );
        
        // Si no hay productos con descuento, usar los primeros productos como ofertas simuladas
        if (productsWithOffers.length === 0) {
          const simulatedOffers = products.slice(0, 8).map(product => ({
            ...product,
            descuento: Math.floor(Math.random() * 50) + 10 // 10-60% descuento
          }));
          this.offerProducts.set(simulatedOffers);
          this.featuredOffers.set(simulatedOffers.slice(0, 2));
        } else {
          this.offerProducts.set(productsWithOffers);
          this.featuredOffers.set(productsWithOffers.slice(0, 2));
        }
        
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading offer products:', error);
        this.loading.set(false);
        this.toastr.error('Error al cargar ofertas');
      }
    });
  }

  startCountdown() {
    this.countdownInterval = window.setInterval(() => {
      const current = this.timeRemaining();
      let { days, hours, minutes, seconds } = current;
      
      seconds--;
      
      if (seconds < 0) {
        seconds = 59;
        minutes--;
        
        if (minutes < 0) {
          minutes = 59;
          hours--;
          
          if (hours < 0) {
            hours = 23;
            days--;
            
            if (days < 0) {
              // Reiniciar countdown
              days = 2;
              hours = 14;
              minutes = 45;
              seconds = 0;
            }
          }
        }
      }
      
      this.timeRemaining.set({ days, hours, minutes, seconds });
    }, 1000);
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product);
    this.toastr.success(`${product.nombre} agregado al carrito`, 'Producto agregado');
  }

  navigateToProduct(productId: number) {
    this.router.navigate(['/products', productId]);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  calculateDiscountPrice(price: number, discount: number): number {
    return price * (1 - discount / 100);
  }
}
