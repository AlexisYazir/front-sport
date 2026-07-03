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

export type EmployeeOrderStatus = 'pendiente_pago' | 'pendiente' | 'en proceso' | 'entregado';

export interface EmployeeOrderItem {
  id_variante: number;
  sku: string;
  cantidad: number;
  precio_unitario?: number | string;
  total: number;
  id_producto?: number;
  producto?: string;
  imagen?: string;
  atributos?: Record<string, any>;
  marca?: string;
  categoria?: string;
}

export interface ShipmentEvent {
  id_evento: number;
  estado: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha_evento: string;
}

export interface ShippingAddressSnapshot {
  calle?: string;
  numero?: string;
  colonia?: string;
  ciudad?: string;
  estado?: string;
  codigo_postal?: string;
  pais?: string;
}

export interface EmployeeOrder {
  id_orden: number;
  id_usuario: number;
  id_direccion_envio: number;
  estado: EmployeeOrderStatus | string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  fecha_pago: string | null;
  fecha_envio: string | null;
  fecha_entrega: string | null;
  fecha_creacion: string;
  cliente?: string;
  email?: string;
  total_productos: number;
  total_items: number;
  items: EmployeeOrderItem[];
  id_envio?: number | null;
  estado_envio?: string | null;
  tracking_number?: string | null;
  paqueteria?: string | null;
  costo_envio?: number | string | null;
  fecha_entrega_estimada?: string | null;
  fecha_entrega_real?: string | null;
  codigo_confirmacion_entrega?: string | null;
  codigo_confirmacion_generado_en?: string | null;
  entrega_confirmada_por_usuario?: boolean;
  entrega_confirmada_en?: string | null;
  entrega_validada_por_empleado?: boolean;
  entrega_validada_en?: string | null;
  eventos_envio?: ShipmentEvent[];
  direccion_envio?: ShippingAddressSnapshot;
}

export type UserOrderStatus = EmployeeOrderStatus | string;

export interface UserOrderItem extends EmployeeOrderItem {}

export interface UserOrder {
  id_orden: number;
  id_usuario: number;
  id_direccion_envio: number;
  estado: UserOrderStatus;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  fecha_pago: string | null;
  fecha_envio: string | null;
  fecha_entrega: string | null;
  fecha_creacion: string;
  total_productos: number;
  total_items: number;
  items: UserOrderItem[];
  id_envio?: number | null;
  estado_envio?: string | null;
  tracking_number?: string | null;
  paqueteria?: string | null;
  costo_envio?: number | string | null;
  fecha_entrega_estimada?: string | null;
  fecha_entrega_real?: string | null;
  codigo_confirmacion_generado_en?: string | null;
  entrega_confirmada_por_usuario?: boolean;
  entrega_confirmada_en?: string | null;
  entrega_validada_por_empleado?: boolean;
  entrega_validada_en?: string | null;
  eventos_envio?: ShipmentEvent[];
  direccion_envio?: ShippingAddressSnapshot;
}

export interface UpdateShipmentRequest {
  estado: 'pendiente' | 'preparando' | 'enviado' | 'en transito' | 'en_transito' | 'entregado' | 'incidencia';
  tracking_number?: string;
  paqueteria?: string;
  ubicacion?: string;
  comentario?: string;
  fecha_entrega_estimada?: string;
}

export interface ReturnRequestItem {
  id_variante: number;
  cantidad: number;
  motivo?: string;
}

export interface CreateReturnRequest {
  id_orden: number;
  motivo: string;
  comentario?: string;
  items: ReturnRequestItem[];
}

export interface ProductReturn {
  id_devolucion: number;
  id_orden: number;
  id_usuario: number;
  estado: string;
  motivo: string;
  comentario?: string;
  resolucion?: string;
  fecha_solicitud: string;
  fecha_actualizacion: string;
  fecha_resolucion?: string | null;
  cliente?: string;
  email?: string;
  total_pedido?: number | string;
  items: Array<ReturnRequestItem & {
    sku?: string;
    producto?: string;
    imagen?: string;
  }>;
  eventos: ShipmentEvent[];
}

export interface UpdateReturnStatusRequest {
  estado: 'solicitada' | 'aprobada' | 'rechazada' | 'recibida' | 'reembolsada' | 'cerrada';
  comentario?: string;
}

export interface Promotion {
  id_promocion: number;
  nombre: string;
  descripcion?: string;
  codigo?: string | null;
  tipo: 'porcentaje' | 'monto_fijo' | 'envio_gratis';
  valor: number;
  descuento_maximo?: number | null;
  compra_minima?: number;
  uso_maximo?: number | null;
  uso_por_usuario?: number | null;
  inicia_en: string;
  termina_en: string;
  activo: boolean;
  usos?: number;
}

export interface CreatePromotionRequest {
  nombre: string;
  descripcion?: string;
  codigo?: string;
  tipo: 'porcentaje' | 'monto_fijo' | 'envio_gratis';
  valor: number;
  descuento_maximo?: number | null;
  compra_minima?: number;
  uso_maximo?: number | null;
  uso_por_usuario?: number | null;
  inicia_en: string;
  termina_en: string;
  activo?: boolean;
}

export interface ShippingMethodAdmin {
  id_metodo_envio: number;
  nombre: string;
  descripcion?: string;
  costo_base: number;
  envio_gratis_desde?: number | null;
  dias_min: number;
  dias_max: number;
  activo: boolean;
}

export interface UpdateShippingMethodRequest {
  nombre?: string;
  descripcion?: string;
  costo_base?: number;
  envio_gratis_desde?: number | null;
  dias_min?: number;
  dias_max?: number;
  activo?: boolean;
}

export interface ProductReview {
  id_review: number;
  id_producto: number;
  id_usuario: number;
  calificacion: number;
  comentario: string;
  fecha: string;
  usuario?: string;
}

export interface ProductReviewAdmin extends ProductReview {
  producto?: string;
  email?: string;
}

export interface ProductReviewSummary {
  total: number;
  promedio: number;
}

export interface ProductReviewsResponse {
  reviews: ProductReview[];
  summary: ProductReviewSummary;
}

export interface ProductReviewEligibility {
  canReview: boolean;
  hasDeliveredPurchase: boolean;
  hasReview: boolean;
  reason: string | null;
}

export interface CreateProductReviewRequest {
  id_producto: number;
  calificacion: number;
  comentario: string;
}
