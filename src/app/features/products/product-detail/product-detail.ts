import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product } from '../../../core/models/product.model';
import { ToastrService } from 'ngx-toastr';
import { Breadcrumbs, BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { Location } from '@angular/common'; // IMPORTAR Location

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, Breadcrumbs],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private toastr = inject(ToastrService);
  private location = inject(Location); // INYECTAR Location

  product = signal<Product | null>(null);
  isLoading = signal<boolean>(true);
  selectedQuantity = signal<number>(1);
  selectedSize = signal<string>('');
  selectedColor = signal<string>('');
  mainImageIndex = signal<number>(0);
  productImages = signal<string[]>([]); // Array de todas las imágenes

  // Breadcrumbs dinámicos - Modificados para no causar problemas
  breadcrumbs = computed((): BreadcrumbItem[] => {
    const product = this.product();
    if (!product) return [
      { label: 'Productos', url: '/products', icon: 'storefront' }
    ];

    return [
      { label: 'Productos', url: '/products', icon: 'storefront' },
      { 
        label: product.categoria || 'Categoría', 
        url: '/products', // Volver a productos sin filtros específicos
        icon: 'category' 
      },
      { label: product.nombre || product.producto || 'Producto' }
    ];
  });

  ngOnInit() {
    this.route.params.subscribe(params => {
      const productId = Number(params['id']);
      if (!Number.isFinite(productId) || productId <= 0) {
        this.toastr.error('ID de producto inválido', 'Solicitud incorrecta');
        this.router.navigate(['/error/400']);
        return;
      }
      this.loadProduct(productId);
    });
  }

  private loadProduct(id: number) {
    this.isLoading.set(true);
    this.productService.getProductById(id).subscribe({
      next: (product) => {
        if (product) {
          this.product.set(product);
          
          // Cargar imágenes: usar array si existe, sino usar imagen principal
          const images = product.imagenes && product.imagenes.length > 0 
            ? product.imagenes 
            : [product.imagen];
          this.productImages.set(images);
          this.mainImageIndex.set(0);
          
          // Seleccionar primera talla y color por defecto
          if (product.talla && product.talla.length > 0) {
            this.selectedSize.set(product.talla[0]);
          }
          if (product.color && product.color.length > 0) {
            this.selectedColor.set(product.color[0]);
          }
        } else {
          this.toastr.error('Producto no encontrado', 'Error 404');
          this.router.navigate(['/error/404']);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.toastr.error('Error al cargar el producto', 'Error 500');
        this.router.navigate(['/error/500']);
        this.isLoading.set(false);
      }
    });
  }

  // NUEVO MÉTODO: Volver a la página anterior
  goBack() {
    this.location.back();
  }

  addToCart() {
    const product = this.product();
    if (!product) return;

    if (!product.disponible || product.stock === 0) {
      this.toastr.error('Este producto no está disponible', 'No disponible');
      return;
    }

    if (this.selectedQuantity() > product.stock) {
      this.toastr.error(`Solo hay ${product.stock} unidades disponibles`, 'Stock insuficiente');
      return;
    }

    // Validar selecciones requeridas
    if (product.talla && product.talla.length > 0 && !this.selectedSize()) {
      this.toastr.error('Por favor selecciona una talla', 'Selección requerida');
      return;
    }

    if (product.color && product.color.length > 0 && !this.selectedColor()) {
      this.toastr.error('Por favor selecciona un color', 'Selección requerida');
      return;
    }

    const cartItem = {
      product,
      quantity: this.selectedQuantity(),
      selectedSize: this.selectedSize(),
      selectedColor: this.selectedColor()
    };

    this.cartService.addItem(cartItem);
    this.toastr.success('Producto agregado al carrito', 'Éxito');
  }

  increaseQuantity() {
    const product = this.product();
    if (product && this.selectedQuantity() < this.getMaxStock()) {
      this.selectedQuantity.set(this.selectedQuantity() + 1);
    }
  }

  decreaseQuantity() {
    if (this.selectedQuantity() > 1) {
      this.selectedQuantity.set(this.selectedQuantity() - 1);
    }
  }

  selectSize(size: string) {
    this.selectedSize.set(size);
  }

  selectColor(color: string) {
    this.selectedColor.set(color);
  }

  getPriceWithDiscount(): number {
    const product = this.product();
    if (!product) return 0;
    
    // Si tiene variantes, mostrar el precio mínimo
    if (product.variantes && product.variantes.length > 0) {
      const minPrice = Math.min(...product.variantes.map(v => v.precio));
      if (product.descuento && product.descuento > 0) {
        return minPrice * (1 - product.descuento / 100);
      }
      return minPrice;
    }
    
    return this.productService.getPriceWithDiscount(product);
  }

  hasDiscount(): boolean {
    const product = this.product();
    return product ? !!(product.descuento && product.descuento > 0) : false;
  }

  getTotalPrice(): number {
    return this.getPriceWithDiscount() * this.selectedQuantity();
  }

  // Cambiar imagen principal al hacer click en thumbnail
  selectImage(index: number) {
    if (index >= 0 && index < this.productImages().length) {
      this.mainImageIndex.set(index);
    }
  }

  // Obtener imagen principal actual
  getMainImage(): string {
    const images = this.productImages();
    return images.length > 0 ? images[this.mainImageIndex()] : './../../../assets/images/no_imagen.webp';
  }

  getStockClass(): string {
    const product = this.product();
    if (!product) return '';
    
    const stock = this.getMaxStock();
    
    if (stock === 0) return 'text-red-600';
    if (stock <= 5) return 'text-yellow-600';
    return 'text-green-600';
  }

  getStockText(): string {
    const product = this.product();
    if (!product) return '';
    
    if (!this.isProductAvailable()) return 'Agotado';
    
    const stock = this.getMaxStock();
    if (stock <= 5) return `Solo ${stock} disponibles`;
    return 'Disponible';
  }

  getAtributosArray(atributos: Record<string, string>): {key: string, value: string}[] {
    if (!atributos) return [];
    return Object.entries(atributos).map(([key, value]) => ({ key, value }));
  }

  isProductAvailable(): boolean {
    const product = this.product();
    if (!product) return false;
    
    if (product.variantes && product.variantes.length > 0) {
      return product.variantes.some(v => v.stock > 0);
    }
    
    return product.disponible && product.stock > 0;
  }

  getMaxStock(): number {
    const product = this.product();
    if (!product) return 0;
    
    if (product.variantes && product.variantes.length > 0) {
      return product.variantes.reduce((sum, v) => sum + v.stock, 0);
    }
    
    return product.stock || 0;
  }
}