import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
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
  private toastr = inject(ToastrService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private router = inject(Router);

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

    this.productService.getOfferProducts().subscribe({
      next: (products: Product[]) => {
        const normalizedOffers = (products || []).map((product) => this.normalizeOfferProduct(product));
        this.offerProducts.set(normalizedOffers);
        this.featuredOffers.set(normalizedOffers.slice(0, 2));
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading real offers:', error);
        this.loadFallbackOffers();
      }
    });
  }

  private loadFallbackOffers() {
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        const productsWithOffers = products
          .filter((product) => product.descuento && product.descuento > 0)
          .map((product) => this.normalizeOfferProduct(product));
        this.offerProducts.set(productsWithOffers);
        this.featuredOffers.set(productsWithOffers.slice(0, 2));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastr.error('Error al cargar ofertas');
      },
    });
  }

  private normalizeOfferProduct(product: Product): Product {
    return {
      ...product,
      id: product.id || product.id_producto || 0,
      imagen:
        product.imagen ||
        (Array.isArray(product.imagenes) ? product.imagenes[0] : '') ||
        'assets/images/no-image.jpg',
      precio: Number(product.precio || 0),
      descuento: Number(product.descuento || 0),
      disponible: product.disponible ?? product.activo === true,
      stock: Number(product.stock || 1),
    };
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
