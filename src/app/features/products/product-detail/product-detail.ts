import { Component, inject, OnInit, signal, computed, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product } from '../../../core/models/product.model';
import { ToastrService } from 'ngx-toastr';
import { Breadcrumbs, BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
      this.loadProduct(extractedProductId);
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

    this.cartService.addItem(cartItem);
    this.toastr.success('Agregado al carrito', '¡Listo!');
  }

  goBack() {
    this.location.back();
  }
}
