import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Marca } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';

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
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  
  products: Product[] = [];
  marcas: Marca[] = [];
  readonly productScroller = viewChild<ElementRef<HTMLDivElement>>('productScroller');
  
  // Signals para el estado reactivo
  featuredProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  loadingMarcas = signal<boolean>(true);
  brandCarouselItems = computed(() => [...this.marcas, ...this.marcas]);

  consumptionPillars = [
    {
      icon: 'local_shipping',
      title: 'Entrega confiable',
      description: 'Preparamos pedidos con control y seguimiento para que tu equipo llegue listo para jugar.',
    },
    {
      icon: 'workspace_premium',
      title: 'Calidad deportiva',
      description: 'Seleccionamos marcas y productos pensados para rendimiento, entrenamiento y competencia.',
    },
    {
      icon: 'support_agent',
      title: 'Atención cercana',
      description: 'Te ayudamos a elegir talla, categoría y equipo con una experiencia simple y rápida.',
    },
  ];

  // Categorías estáticas decorativas para la sección de navegación
  staticCategories = [
    { icon: 'directions_run', label: 'Running', route: '/deporte/running' },
    { icon: 'sports_soccer', label: 'Fútbol', route: '/deporte/futbol' },
    { icon: 'fitness_center', label: 'Gym', route: '/deporte/gym' },
    { icon: 'sports_basketball', label: 'Basketball', route: '/deporte/basketball' },
    { icon: 'pool', label: 'Natación', route: '/deporte/natacion' },
  ];

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
        this.featuredProducts.set(data.slice(0, 8));
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

  getMarcaImageUrl(marca: Marca): string {
    if (marca.imagen && marca.imagen !== 'null' && marca.imagen !== '') {
      if (marca.imagen.startsWith('http')) {
        return marca.imagen;
      }
      return `${this.apiUrl}/${marca.imagen.replace(/^\/+/, '')}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(marca.nombre)}&background=0367A6&color=fff&size=128`;
  }

  viewProduct(product: Product) {
    this.router.navigate(this.productService.buildProductDetailRoute(product));
  }

  viewAllMarcas() {
    this.router.navigate(['/marcas']);
  }

  viewAllProducts() {
    this.router.navigate(['/products']);
  }

  getProductLink(product: Product): string[] {
    return this.productService.buildProductDetailRoute(product);
  }

  scrollProducts(direction: 'left' | 'right') {
    const scroller = this.productScroller()?.nativeElement;
    if (!scroller) return;

    const amount = Math.max(scroller.clientWidth * 0.75, 280);
    scroller.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth',
    });
  }
}
