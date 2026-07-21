import {
  Component,
  OnInit,
  OnDestroy,
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
import { CompanyService, HomeBannerImage } from '../../../core/services/company.service';
import { Product, Marca } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  private toastr = inject(ToastrService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private companyService = inject(CompanyService);
  private router = inject(Router);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private bannerIntervalId: ReturnType<typeof setInterval> | null = null;
  
  products: Product[] = [];
  marcas: Marca[] = [];
  readonly productScroller = viewChild<ElementRef<HTMLDivElement>>('productScroller');
  
  // Signals para el estado reactivo
  featuredProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  loadingMarcas = signal<boolean>(true);
  bannerImages = signal<HomeBannerImage[]>([]);
  currentBannerIndex = signal(0);
  freeShippingThreshold = signal<number | null>(null);
  brandCarouselItems = computed(() => [...this.marcas, ...this.marcas]);
  categoryCarouselItems = computed(() => [...this.staticCategories, ...this.staticCategories]);
  freeShippingLabel = computed(() => {
    const threshold = this.freeShippingThreshold();
    return threshold && threshold > 0
      ? `Envío gratis +${this.formatPromoCurrency(threshold)}`
      : 'Envío gratis disponible';
  });

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
    this.loadBannerImages();
    this.loadShippingPromo();
    this.loadProducts();
    this.loadMarcas();
  }

  ngOnDestroy(): void {
    this.stopBannerCarousel();
  }

  loadBannerImages() {
    this.companyService.getActiveBannerImages().subscribe({
      next: (images) => {
        const activeImages = (images || []).filter((image) => image.activo && image.url_imagen);
        this.bannerImages.set(activeImages);
        this.currentBannerIndex.set(0);
        this.startBannerCarousel();
      },
      error: () => {
        this.bannerImages.set([]);
        this.currentBannerIndex.set(0);
        this.startBannerCarousel();
      },
    });
  }

  loadShippingPromo() {
    this.productService.getActiveShippingMethods().subscribe({
      next: (methods) => {
        const thresholds = (methods || [])
          .filter((method) => method.activo && Number(method.envio_gratis_desde) > 0)
          .map((method) => Number(method.envio_gratis_desde));

        this.freeShippingThreshold.set(thresholds.length ? Math.min(...thresholds) : null);
      },
      error: () => {
        this.freeShippingThreshold.set(null);
      },
    });
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (data: Product[]) => {
        this.products = data;
        this.featuredProducts.set(data.slice(0, 8));
        this.loading.set(false);
      },
      error: (error) => {
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
        this.loadingMarcas.set(false);
      },
      error: (error) => {
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

  formatPromoCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(value);
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

  async shareProduct(product: Product, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();

    const route = this.getProductLink(product).join('/');
    const url = `${window.location.origin}${route}`;
    const title = product.nombre || product.producto || 'Producto Sport Center';
    const text = `Mira este producto en Sport Center: ${title}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      this.toastr.success('Link copiado al portapapeles', 'Compartir');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        this.toastr.error('No se pudo compartir el producto', 'Compartir');
      }
    }
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

  setBanner(index: number): void {
    const images = this.bannerImages();
    if (!images.length) return;
    this.currentBannerIndex.set(Math.min(Math.max(index, 0), images.length - 1));
    this.startBannerCarousel();
  }

  private startBannerCarousel(): void {
    this.stopBannerCarousel();
    if (this.bannerImages().length <= 1) return;

    this.bannerIntervalId = setInterval(() => {
      const total = this.bannerImages().length;
      this.currentBannerIndex.set((this.currentBannerIndex() + 1) % total);
    }, 6000);
  }

  private stopBannerCarousel(): void {
    if (this.bannerIntervalId) {
      clearInterval(this.bannerIntervalId);
      this.bannerIntervalId = null;
    }
  }
}
