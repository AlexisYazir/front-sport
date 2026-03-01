import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Marca } from '../../../core/models/product.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private toastr = inject(ToastrService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private router = inject(Router);
  
  products: Product[] = [];
  marcas: Marca[] = [];
  
  // Signals para el estado reactivo
  featuredProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  loadingMarcas = signal<boolean>(true);

  // Computed para el contador del carrito
  cartCount = computed(() => this.cartService.cartItems().length);

  ngOnInit() {
    this.loadProducts();
    this.loadMarcas();
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (data: Product[]) => {
        this.products = data;
        this.featuredProducts.set(data.slice(0, 8)); // Tomar primeros 8 como destacados
        console.log('Productos cargados:', data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cargando productos:', error);
        this.toastr.error('Error al cargar los productos', 'Error');
        this.loading.set(false);
      }
    });
  }

  loadMarcas() {
    this.loadingMarcas.set(true);
    this.productService.getMarcas().subscribe({
      next: (data: Marca[]) => {
        this.marcas = data;
        console.log('Marcas cargadas:', data);
        this.loadingMarcas.set(false);
      },
      error: (error) => {
        console.error('Error cargando marcas:', error);
        this.toastr.error('Error al cargar las marcas', 'Error');
        this.loadingMarcas.set(false);
      }
    });
  }

  // Método para obtener URL de imagen de marca
  getMarcaImageUrl(marca: Marca): string {
    if (marca.imagen && marca.imagen !== 'null' && marca.imagen !== '') {
      // Si la URL ya es completa, usarla directamente
      if (marca.imagen.startsWith('http')) {
        return marca.imagen;
      }
      // Si es una ruta relativa, ajustar según tu backend
      return `http://localhost:3000/${marca.imagen}`;
    }
    // Fallback a UI Avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(marca.nombre)}&background=0367A6&color=fff&size=128`;
  }


  // Método para ver detalles del producto
  viewProduct(productId: number) {
    this.router.navigate(['/product', productId]);
  }

  // Método para ver todas las marcas
  viewAllMarcas() {
    this.router.navigate(['/marcas']);
  }

  // Método para ver todos los productos
  viewAllProducts() {
    this.router.navigate(['/product']);
  }
}