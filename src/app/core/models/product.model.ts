// Modelo de Variante
export interface Variante {
  id_variante: number;
  sku: string;
  stock: number;
  precio: number;
  imagenes: string[];
  atributos: Record<string, string>;
}

// Modelo de Producto actualizado
export interface Product {
  // Campos originales
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  imagenes?: string[];
  categoria: string;
  stock: number;
  disponible: boolean;
  marca?: string;
  imagen_marca?: string;
  talla?: string[];
  color?: string[];
  descuento?: number;
  fechaCreacion?: string;
  
  // Nuevos campos del API
  id_producto?: number;
  producto?: string;
  activo?: boolean;
  fecha_creacion?: string;
  categoria_padre?: string;
  deportes?: string[];
  variantes?: Variante[];
}

// Categorías disponibles
export interface Category {
  id: string;
  nombre: string;
  icono: string;
}

// Filtros de búsqueda
export interface ProductFilters {
  categoria?: string;
  categoriaPadre?: string;
  subcategoria?: string;
  marca?: string;
  deporte?: string;
  genero?: string;
  precioMin?: number;
  precioMax?: number;
  disponible?: boolean;
  ordenarPor?: 'precio-asc' | 'precio-desc' | 'nombre' | 'fecha';
}

// Respuesta de búsqueda
export interface ProductSearchResult {
  products: Product[];
  total: number;
  hasResults: boolean;
}

export interface Categorie {
  id_categoria: number;
  nombre: string;
  id_padre: number;
}

export interface Marca {
  id_marca: number;
  nombre: string; 
  imagen?: string;
}

export interface Attibute {
  id_atributo: number;
  nombre: string;
  id_padre: number | null;
}

export interface Sport {
  id_deporte: number;
  nombre: string;
}

// product.model.ts - Agrega esta interfaz

export interface CreateProductDto {
  nombre: string;
  descripcion: string;
  id_marca: number;
  id_categoria: number;
}

export interface InventoryProduct {
  id_producto: number;
  producto: string;
  activo: boolean;
  precio: number | null;
  stock: number | null;
  marca?: string;
  imagen: string;
  imagen_marca?: string;
  fecha_creacion: string;

}

export interface RecientProduct {
  id_producto: number;
  nombre: string;
  activo: boolean;
  descripcion?: string;
  fecha_creacion: string;

}

export interface ProductVariant {
  id_variante: number;
  id_producto: number;
  sku: string;
  precio: number;
  stock: number;
  imagenes: string[];
  atributos: Record<string, any>; // ← Esto es un objeto, no un array
}

export interface Orders {
  id_orden: number;
  id_usuario: number;
  id_direccion_envio: number;
  estado: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  fecha_pago: string;
  fecha_envio: string;
  fecha_entrega: string;
  fecha_creacion:string;
}
