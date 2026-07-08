import { Component, inject, OnInit, signal, computed, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, ProductReview, ProductReviewEligibility, ProductReviewSummary } from '../../../core/models/product.model';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';
import { ToastrService } from 'ngx-toastr';
import { Breadcrumbs, BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CartItem } from '../../../core/models/cart.model';

interface Variant {
  id_variante: number;
  sku: string;
  stock: number;
  precio: number;
  imagenes: string[];
  atributos: {
    Color?: string;
    Talla?: string;
    [key: string]: string | undefined;
  };
}

interface LastAddedCartPreview {
  productName: string;
  image: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  price: number;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Breadcrumbs],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);

  // Estado del producto
  product = signal<Product | null>(null);
  isLoading = signal<boolean>(true);
  
  // Selecciones del usuario
  selectedQuantity = signal<number>(1);
  selectedSize = signal<string>('');
  selectedColor = signal<string>('');
  
  // La variante seleccionada (se actualiza automáticamente)
  selectedVariant = signal<Variant | null>(null);
  
  // Imágenes
  thumbnailImages = signal<string[]>([]);
  mainImageIndex = signal<number>(0);
  
  // Opciones disponibles
  availableSizes = signal<string[]>([]);
  availableColors = signal<string[]>([]);
  allVariants = signal<Variant[]>([]);
  
  // UI State
  descriptionExpanded = signal<boolean>(false);
  activeTab = signal<'details' | 'shipping'>('details');
  isAddingToCart = signal<boolean>(false);
  showCartPreview = signal<boolean>(false);
  lastAddedPreview = signal<LastAddedCartPreview | null>(null);
  previewCartItems = this.cartService.cartItems;
  previewCartSummary = this.cartService.summary;

  // Reseñas
  reviews = signal<ProductReview[]>([]);
  reviewSummary = signal<ProductReviewSummary>({ total: 0, promedio: 0 });
  isReviewsLoading = signal<boolean>(false);
  isReviewEligibilityLoading = signal<boolean>(false);
  isSubmittingReview = signal<boolean>(false);
  reviewFormOpen = signal<boolean>(false);
  reviewEligibility = signal<ProductReviewEligibility | null>(null);
  selectedRating = signal<number>(0);
  hoveredRating = signal<number>(0);
  reviewComment = signal<string>('');
  reviewStars = [1, 2, 3, 4, 5];
  private readonly reviewCommentAllowedPattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,;:¡!¿?'"()\-_/]+$/;
  private readonly reviewBlockedPatterns = [
    /<\s*script/i,
    /<\/?[a-z][\s\S]*>/i,
    /\b(select|insert|update|delete|drop|alter|truncate|exec|execute|union)\b/i,
    /(--|\/\*|\*\/|;)/,
    /\b(cmd|powershell|bash|sh|curl|wget|chmod|sudo|rm\s+-rf)\b/i,
  ];
  
  // Precio actual (computado a partir de la variante seleccionada)
  currentPrice = computed(() => {
    const variant = this.selectedVariant();
    if (variant) return variant.precio;
    return this.product()?.precio || 0;
  });

  // Stock actual
  currentStock = computed(() => {
    const variant = this.selectedVariant();
    if (variant) return variant.stock;
    return this.product()?.stock || 0;
  });

  // Disponibilidad
  isProductAvailable = computed(() => this.currentStock() > 0);
  canUseCart = computed(() => {
    const user = this.authService.currentUser();
    return !user || user.rol === UserRole.USUARIO;
  });

  // Precio con descuento
  priceWithDiscount = computed(() => {
    const price = this.currentPrice();
    const product = this.product();
    if (product?.descuento && product.descuento > 0) {
      return price * (1 - product.descuento / 100);
    }
    return price;
  });

  // Total
  totalPrice = computed(() => this.priceWithDiscount() * this.selectedQuantity());

  ratingAverage = computed(() => Number(this.reviewSummary().promedio || 0));
  ratingRounded = computed(() => Math.round(this.ratingAverage()));
  reviewCommentError = computed(() => this.getReviewCommentError(this.reviewComment()));
  canSubmitReview = computed(() =>
    this.selectedRating() > 0 &&
    this.reviewComment().trim().length > 0 &&
    !this.reviewCommentError(),
  );

  // Mensaje de stock
  stockMessage = computed(() => {
    if (!this.isProductAvailable()) return 'Agotado';
    if (this.currentStock() <= 5) return 'Solo quedan algunos productos. ¡Haz tu pedido pronto!';
    return '✓ Disponible para envío inmediato';
  });

  // Breadcrumbs
  breadcrumbs = computed((): BreadcrumbItem[] => {
    const product = this.product();
    if (!product) return [{ label: 'Productos', url: '/products', icon: 'storefront' }];
    return [
      { label: 'Productos', url: '/products', icon: 'storefront' },
      { label: product.categoria || 'Categoría', url: '/products', icon: 'category' },
      { label: product.nombre || product.producto || 'Producto' }
    ];
  });

  async shareCurrentProduct(): Promise<void> {
    const product = this.product();
    if (!product) return;

    const route = this.productService.buildProductDetailRoute(product).join('/');
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

  // Mapeo de colores
  colorMap = new Map<string, { name: string, hex: string, bgClass: string }>([
    ['Negro', { name: 'Negro', hex: '#000000', bgClass: 'bg-black' }],
    ['Blanco', { name: 'Blanco', hex: '#FFFFFF', bgClass: 'bg-white border border-gray-300' }],
    ['Azul', { name: 'Azul', hex: '#3B82F6', bgClass: 'bg-blue-500' }],
    ['Rojo', { name: 'Rojo', hex: '#EF4444', bgClass: 'bg-red-500' }],
    ['Gris', { name: 'Gris', hex: '#6B7280', bgClass: 'bg-gray-500' }],
    ['Verde', { name: 'Verde', hex: '#10B981', bgClass: 'bg-green-500' }],
    ['Cafe', { name: 'Café', hex: '#8B4513', bgClass: 'bg-amber-800' }],
    ['Morado', { name: 'Morado', hex: '#8B5CF6', bgClass: 'bg-purple-500' }],
    ['Amarillo', { name: 'Amarillo', hex: '#EAB308', bgClass: 'bg-yellow-500' }],
    ['Naranja', { name: 'Naranja', hex: '#F97316', bgClass: 'bg-orange-500' }]
  ]);

  // Efecto para actualizar la variante cuando cambian color o talla
  private updateVariant = effect(() => {
    const color = this.selectedColor();
    const size = this.selectedSize();
    const variants = this.allVariants();
    
    if (variants.length > 0 && color && size) {
      const variant = variants.find(v => 
        v.atributos?.['Color'] === color && 
        v.atributos?.['Talla'] === size
      );
      
      if (variant && variant !== this.selectedVariant()) {
        this.selectedVariant.set(variant);
        
        // Actualizar imágenes según la variante seleccionada
        if (variant.imagenes && variant.imagenes.length > 0) {
          this.thumbnailImages.set(variant.imagenes);
          this.mainImageIndex.set(0);
        } else {
          this.loadAllImages();
        }
      }
    }
  });

  ngOnInit() {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const extractedProductId = this.productService.extractRealProductId(params['id']);
      if (extractedProductId === null || !Number.isFinite(extractedProductId) || extractedProductId <= 0) {
        this.toastr.error('ID de producto inválido', 'Error');
        this.router.navigate(['/error/400']);
        return;
      }
      this.resetReviewForm();
      this.loadProduct(extractedProductId);
      this.loadReviews(extractedProductId);
      this.loadReviewEligibility(extractedProductId);
    });
  }

  private loadProduct(id: number) {
    this.isLoading.set(true);
    
    this.productService.getProductById(id).subscribe({
      next: (product) => {
        if (product) {
          this.product.set(product);
          this.allVariants.set(product.variantes || []);
          
          // Extraer opciones únicas
          this.extractUniqueOptions();
          
          // Cargar todas las imágenes
          this.loadAllImages();
          
          // Seleccionar primera combinación disponible
          this.selectFirstAvailableCombination();
          
        } else {
          this.toastr.error('Producto no encontrado', 'Error 404');
          this.router.navigate(['/error/404']);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.toastr.error('Error al cargar el producto', 'Error');
        this.router.navigate(['/error/500']);
        this.isLoading.set(false);
      }
    });
  }

  private loadReviews(id: number) {
    this.isReviewsLoading.set(true);

    this.productService.getProductReviews(id).subscribe({
      next: (response) => {
        this.reviews.set(response.reviews);
        this.reviewSummary.set(response.summary);
        this.isReviewsLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading reviews:', error);
        this.reviews.set([]);
        this.reviewSummary.set({ total: 0, promedio: 0 });
        this.isReviewsLoading.set(false);
      },
    });
  }

  private loadReviewEligibility(id: number) {
    if (!this.isUserLoggedIn()) {
      this.reviewEligibility.set(null);
      return;
    }

    this.isReviewEligibilityLoading.set(true);
    this.productService.getProductReviewEligibility(id).subscribe({
      next: (eligibility) => {
        this.reviewEligibility.set(eligibility);
        this.isReviewEligibilityLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading review eligibility:', error);
        this.reviewEligibility.set(null);
        this.isReviewEligibilityLoading.set(false);
      },
    });
  }

  private resetReviewForm(): void {
    this.reviewFormOpen.set(false);
    this.selectedRating.set(0);
    this.hoveredRating.set(0);
    this.reviewComment.set('');
  }

  private selectFirstAvailableCombination() {
    const variants = this.allVariants();
    const availableVariant = variants.find(v => v.stock > 0) || variants[0];
    
    if (availableVariant) {
      if (availableVariant.atributos?.['Color']) {
        this.selectedColor.set(availableVariant.atributos['Color']);
      }
      if (availableVariant.atributos?.['Talla']) {
        this.selectedSize.set(availableVariant.atributos['Talla']);
      }
      this.selectedVariant.set(availableVariant);
      
      if (availableVariant.imagenes && availableVariant.imagenes.length > 0) {
        this.thumbnailImages.set(availableVariant.imagenes);
        this.mainImageIndex.set(0);
      }
    }
  }

  private loadAllImages() {
    const variants = this.allVariants();
    let images: string[] = [];
    
    if (variants.length > 0) {
      const allImages = variants.flatMap(v => v.imagenes || []);
      images = [...new Set(allImages)];
    }
    
    if (images.length === 0 && this.product()?.imagen) {
      images = [this.product()!.imagen];
    }
    
    if (images.length === 0) {
      images = ['./../../../assets/images/no_imagen.webp'];
    }
    
    this.thumbnailImages.set(images);
    this.mainImageIndex.set(0);
  }

  private extractUniqueOptions() {
    const variants = this.allVariants();
    const sizes: string[] = [];
    const colors: string[] = [];
    
    variants.forEach(variant => {
      const size = variant.atributos?.['Talla'];
      const color = variant.atributos?.['Color'];
      
      if (size && !sizes.includes(size)) {
        sizes.push(size);
      }
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    });
    
    this.availableSizes.set(sizes);
    this.availableColors.set(colors);
  }

  // MÉTODOS DE DISPONIBILIDAD
  isColorAvailable(color: string): boolean {
    const currentSize = this.selectedSize();
    const variants = this.allVariants();
    
    if (!currentSize) {
      return variants.some(v => v.atributos?.['Color'] === color && v.stock > 0);
    }
    
    return variants.some(v => 
      v.atributos?.['Color'] === color && 
      v.atributos?.['Talla'] === currentSize && 
      v.stock > 0
    );
  }

  isSizeAvailable(size: string): boolean {
    const currentColor = this.selectedColor();
    const variants = this.allVariants();
    
    if (!currentColor) {
      return variants.some(v => v.atributos?.['Talla'] === size && v.stock > 0);
    }
    
    return variants.some(v => 
      v.atributos?.['Talla'] === size && 
      v.atributos?.['Color'] === currentColor && 
      v.stock > 0
    );
  }

  getAvailableSizesForCurrentColor(): string[] {
    const currentColor = this.selectedColor();
    const variants = this.allVariants();
    
    if (!currentColor) return this.availableSizes();
    
    const sizes = variants
      .filter(v => v.atributos?.['Color'] === currentColor && v.stock > 0)
      .map(v => v.atributos?.['Talla'])
      .filter((size): size is string => size !== undefined);
    
    return [...new Set(sizes)];
  }

  getAvailableColorsForCurrentSize(): string[] {
    const currentSize = this.selectedSize();
    const variants = this.allVariants();
    
    if (!currentSize) return this.availableColors();
    
    const colors = variants
      .filter(v => v.atributos?.['Talla'] === currentSize && v.stock > 0)
      .map(v => v.atributos?.['Color'])
      .filter((color): color is string => color !== undefined);
    
    return [...new Set(colors)];
  }

  getColorClass(colorName: string): string {
    const color = this.colorMap.get(colorName);
    if (!color) return 'bg-gray-200';
    if (colorName === 'Blanco') return 'bg-white border-2 border-gray-300';
    return color.bgClass;
  }

  getColorStyle(colorName: string): { [key: string]: string } {
    const color = this.colorMap.get(colorName);
    if (!color) return {};
    return { backgroundColor: color.hex };
  }

  getColorDisplayName(colorName: string): string {
    const color = this.colorMap.get(colorName);
    return color ? color.name : colorName;
  }

  // Navegación de imágenes
  nextImage() {
    if (this.mainImageIndex() < this.thumbnailImages().length - 1) {
      this.mainImageIndex.set(this.mainImageIndex() + 1);
    } else {
      this.mainImageIndex.set(0);
    }
  }

  prevImage() {
    if (this.mainImageIndex() > 0) {
      this.mainImageIndex.set(this.mainImageIndex() - 1);
    } else {
      this.mainImageIndex.set(this.thumbnailImages().length - 1);
    }
  }

  selectImage(index: number) {
    if (index >= 0 && index < this.thumbnailImages().length) {
      this.mainImageIndex.set(index);
    }
  }

  // Modifica estos métodos en tu archivo .ts

selectColor(color: string) {
  // 1. Buscamos todas las variantes que tengan este color
  const variantsWithColor = this.allVariants().filter(
    v => v.atributos?.['Color'] === color
  );

  if (variantsWithColor.length > 0) {
    this.selectedColor.set(color);

    // 2. Verificamos si la talla actual existe para el nuevo color
    const currentSize = this.selectedSize();
    const hasCurrentSize = variantsWithColor.some(
      v => v.atributos?.['Talla'] === currentSize
    );

    // 3. Si no existe la talla actual en este color, seleccionamos la primera disponible
    if (!hasCurrentSize) {
      const firstAvailable = variantsWithColor[0];
      this.selectedSize.set(firstAvailable.atributos?.['Talla'] || '');
    }
  }
}

selectSize(size: string) {
  // 1. Buscamos todas las variantes que tengan esta talla
  const variantsWithSize = this.allVariants().filter(
    v => v.atributos?.['Talla'] === size
  );

  if (variantsWithSize.length > 0) {
    this.selectedSize.set(size);

    // 2. Verificamos si el color actual existe para la nueva talla
    const currentColor = this.selectedColor();
    const hasCurrentColor = variantsWithSize.some(
      v => v.atributos?.['Color'] === currentColor
    );

    // 3. Si no existe el color, saltamos al primero disponible de esa talla
    if (!hasCurrentColor) {
      const firstAvailable = variantsWithSize[0];
      this.selectedColor.set(firstAvailable.atributos?.['Color'] || '');
    }
  }
}

// Cambiamos la lógica de "Habilitado": Ahora habilitamos si la combinación EXISTE
// sin importar el stock (el stock solo lo validamos al agregar al carrito)
existsColorForSize(color: string): boolean {
  const currentSize = this.selectedSize();
  if (!currentSize) return true;
  return this.allVariants().some(
    v => v.atributos?.['Color'] === color && v.atributos?.['Talla'] === currentSize
  );
}

existsSizeForColor(size: string): boolean {
  const currentColor = this.selectedColor();
  if (!currentColor) return true;
  return this.allVariants().some(
    v => v.atributos?.['Talla'] === size && v.atributos?.['Color'] === currentColor
  );
}

  increaseQuantity() {
    if (this.selectedQuantity() < this.currentStock()) {
      this.selectedQuantity.set(this.selectedQuantity() + 1);
    }
  }

  decreaseQuantity() {
    if (this.selectedQuantity() > 1) {
      this.selectedQuantity.set(this.selectedQuantity() - 1);
    }
  }

  hasDiscount(): boolean {
    const product = this.product();
    return product ? !!(product.descuento && product.descuento > 0) : false;
  }

  getMainImage(): string {
    const images = this.thumbnailImages();
    return images.length > 0 ? images[this.mainImageIndex()] : './../../../assets/images/no_imagen.webp';
  }

  toggleDescription() {
    this.descriptionExpanded.set(!this.descriptionExpanded());
  }

  setActiveTab(tab: 'details' | 'shipping') {
    this.activeTab.set(tab);
  }

  getAvailableVariantsCount(): number {
    return this.allVariants().filter(v => v.stock > 0).length;
  }

  getAtributosArray(atributos: { Color?: string; Talla?: string; [key: string]: string | undefined } | undefined): {key: string, value: string}[] {
    if (!atributos) return [];
    return Object.entries(atributos)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => ({ key, value: value as string }));
  }

  isUserLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  getReviewCountLabel(): string {
    const total = this.reviewSummary().total;
    if (total === 0) return 'Sin reseñas';
    if (total === 1) return '1 reseña';
    return `${total} reseñas`;
  }

  isStarFilled(star: number, rating = this.ratingRounded()): boolean {
    return star <= rating;
  }

  setRating(rating: number): void {
    this.selectedRating.set(rating);
  }

  setHoveredRating(rating: number): void {
    this.hoveredRating.set(rating);
  }

  clearHoveredRating(): void {
    this.hoveredRating.set(0);
  }

  getActiveReviewRating(): number {
    return this.hoveredRating() || this.selectedRating();
  }

  getReviewRatingLabel(rating = this.getActiveReviewRating()): string {
    switch (rating) {
      case 1:
        return 'Muy malo';
      case 2:
        return 'Malo';
      case 3:
        return 'Regular';
      case 4:
        return 'Bueno';
      case 5:
        return 'Excelente';
      default:
        return 'Haz clic para calificar';
    }
  }

  private getReviewCommentError(comment: string): string {
    const normalized = comment.trim().replace(/\s+/g, ' ');

    if (!normalized) return '';
    if (normalized.length < 10) return 'El comentario debe tener al menos 10 caracteres.';
    if (normalized.length > 800) return 'El comentario no puede exceder 800 caracteres.';
    if (!this.reviewCommentAllowedPattern.test(normalized)) {
      return 'El comentario contiene caracteres no permitidos.';
    }
    if (this.reviewBlockedPatterns.some((pattern) => pattern.test(normalized))) {
      return 'El comentario contiene contenido no permitido.';
    }

    return '';
  }

  goToLoginForReview(): void {
    const returnUrl = `${this.router.url.split('#')[0]}#reviews`;
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
    });
  }

  toggleReviewForm(): void {
    if (!this.isUserLoggedIn()) {
      this.goToLoginForReview();
      return;
    }

    const nextState = !this.reviewFormOpen();
    this.reviewFormOpen.set(nextState);

    if (nextState) {
      const idProducto = this.product()?.id_producto ?? this.product()?.id;
      if (idProducto) {
        this.loadReviewEligibility(idProducto);
      }
    }
  }

  getRelativeReviewDate(dateString: string): string {
    const date = new Date(dateString).getTime();

    if (!Number.isFinite(date)) {
      return '';
    }

    const diffMs = Math.max(0, Date.now() - date);
    const minutes = Math.floor(diffMs / 60_000);

    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) {
      return minutes === 1 ? 'hace un minuto' : `hace ${minutes} minutos`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? 'hace una hora' : `hace ${hours} horas`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
      return days === 1 ? 'hace un día' : `hace ${days} días`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
      return months === 1 ? 'hace un mes' : `hace ${months} meses`;
    }

    const years = Math.floor(months / 12);
    return years === 1 ? 'hace un año' : `hace ${years} años`;
  }

  submitReview(): void {
    const product = this.product();
    if (!product) return;

    if (!this.isUserLoggedIn()) {
      this.goToLoginForReview();
      return;
    }

    if (this.selectedRating() <= 0) {
      this.toastr.warning('Selecciona una calificación para publicar tu reseña', 'Calificación requerida');
      return;
    }

    const eligibility = this.reviewEligibility();
    if (eligibility && !eligibility.canReview) {
      this.toastr.warning(eligibility.reason || 'No puedes publicar reseña de este producto', 'Reseñas');
      return;
    }

    const comentario = this.reviewComment().trim();
    if (!comentario) {
      this.toastr.warning('Escribe un comentario para publicar tu reseña', 'Comentario requerido');
      return;
    }

    const commentError = this.getReviewCommentError(comentario);
    if (commentError) {
      this.toastr.warning(commentError, 'Comentario inválido');
      return;
    }

    const idProducto = product.id_producto ?? product.id;
    this.isSubmittingReview.set(true);

    this.productService.createProductReview({
      id_producto: idProducto,
      calificacion: this.selectedRating(),
      comentario,
    }).subscribe({
      next: () => {
        this.toastr.success('Tu reseña fue publicada', 'Gracias por comentar');
        this.resetReviewForm();
        this.loadReviews(idProducto);
        this.loadReviewEligibility(idProducto);
        this.isSubmittingReview.set(false);
      },
      error: (error) => {
        this.isSubmittingReview.set(false);
        if (error?.status === 401) {
          this.goToLoginForReview();
          return;
        }
        const backendMessage = Array.isArray(error?.error?.message)
          ? error.error.message.join(', ')
          : error?.error?.message;
        this.toastr.error(backendMessage || 'No se pudo publicar la reseña', 'Error');
      },
    });
  }

  addToCart() {
    const product = this.product();
    const variant = this.selectedVariant();
    
    if (!product) return;

    if (!this.isProductAvailable()) {
      this.toastr.error('Este producto no está disponible', 'No disponible');
      return;
    }

    if (this.selectedQuantity() > this.currentStock()) {
      this.toastr.error('No hay suficiente stock disponible', 'Stock limitado');
      return;
    }

    if (this.availableSizes().length > 0 && !this.selectedSize()) {
      this.toastr.error('Por favor selecciona una talla', 'Selección requerida');
      return;
    }

    if (this.availableColors().length > 0 && !this.selectedColor()) {
      this.toastr.error('Por favor selecciona un color', 'Selección requerida');
      return;
    }

    const cartItem = {
      product,
      variant: variant,
      quantity: this.selectedQuantity(),
      selectedSize: this.selectedSize(),
      selectedColor: this.selectedColor(),
      price: this.currentPrice(),
      sku: variant?.sku,
      image: this.getMainImage()
    };

    const shouldShowPreview = this.authService.isLoggedIn() && this.canUseCart();
    this.isAddingToCart.set(true);
    this.lastAddedPreview.set({
      productName: product.nombre || product.producto || 'Producto',
      image: this.getMainImage(),
      quantity: this.selectedQuantity(),
      selectedSize: this.selectedSize(),
      selectedColor: this.selectedColor(),
      price: this.priceWithDiscount(),
    });

    this.cartService.addItem(cartItem);

    window.setTimeout(() => {
      this.isAddingToCart.set(false);
      if (shouldShowPreview) {
        this.showCartPreview.set(true);
      }
    }, 520);
  }

  closeCartPreview(): void {
    this.showCartPreview.set(false);
  }

  goToCart(): void {
    this.showCartPreview.set(false);
    this.router.navigate(['/cart']);
  }

  getPreviewItemTotal(item: CartItem): number {
    return this.cartService.getItemTotal(item);
  }

  formatMoney(value: number | string | null | undefined): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  goBack() {
    this.location.back();
  }
}
