import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product } from '../../../core/models/product.model';


@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private toastr = Inject(ToastrService);
  private productService = Inject(ProductService);
  private cartService = Inject(CartService);
  private router = Inject(Router);

  // Signals para el estado reactivo
  featuredProducts = signal<Product[]>([]);
  loading = signal(true);

  // Computed para el contador del carrito
  cartCount = computed(() => this.cartService.cartItems().length);

  // Categorías destacadas
  featuredCategories = [
    {
      id: 'running',
      name: 'Running',
      description: 'Zapatillas, ropa técnica y accesorios para corredores',
      icon: 'directions_run',
      gradient: 'from-[#0367A6] to-[#035A91]'
    },
    {
      id: 'football',
      name: 'Fútbol',
      description: 'Balones, botas y equipamiento completo',
      icon: 'sports_soccer',
      gradient: 'from-[#FF7A00] to-[#E56E00]'
    },
    {
      id: 'fitness',
      name: 'Fitness',
      description: 'Equipo para gym y entrenamiento en casa',
      icon: 'fitness_center',
      gradient: 'from-[#22C55E] to-[#16A34A]'
    }
  ];

  // Breadcrumbs para la página home
  breadcrumbs = [
    { label: 'Inicio', url: '/home', active: true }
  ];

  ngOnInit() {
    this.loadFeaturedProducts();
  }

  loadFeaturedProducts() {
    this.loading.set(true);
    
    // Cargar productos destacados (los primeros 4)
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        this.featuredProducts.set(products.slice(0, 4));
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading featured products:', error);
        this.loading.set(false);
        this.toastr.error('Error al cargar productos destacados');
      }
    });
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product);
    this.toastr.success(`${product.nombre} agregado al carrito`, 'Producto agregado');
  }

  navigateToCategory(categoryId: string) {
    this.router.navigate(['/products'], { 
      queryParams: { category: categoryId }
    });
  }

  navigateToProduct(productId: number) {
    this.router.navigate(['/products', productId]);
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  testNotification() {
    this.toastr.success('¡Bienvenido a Sport Center!', 'Éxito');
  }
}
