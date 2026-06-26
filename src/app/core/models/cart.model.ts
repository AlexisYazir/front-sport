import { Product } from './product.model';

export interface CartItem {
  product: Product;
  variant?: {
    id_variante: number;
    id_producto?: number;
    sku?: string;
    precio?: number;
    stock?: number;
    imagenes?: string[];
    atributos?: Record<string, string | undefined>;
  };
  id_variante?: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  price?: number;
  sku?: string;
  image?: string;
  addedAt: Date;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

export interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
}

export interface OrderSummary {
  items: CartItem[];
  summary: CartSummary;
  shippingInfo: ShippingInfo;
  orderDate: Date;
  orderId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

export interface CheckoutAddress {
  id_direccion?: number;
  id_usuario?: number;
  alias?: string;
  calle: string;
  numero?: string;
  colonia?: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais?: string;
  principal?: boolean;
  fecha_creacion?: string;
}

export interface CheckoutShippingMethod {
  id_metodo_envio: number | null;
  nombre: string;
  descripcion?: string;
  costo_base: number;
  envio_gratis_desde?: number | null;
  dias_min: number;
  dias_max: number;
}

export interface CheckoutPromotion {
  id_promocion: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  valor: number;
  descuento: number;
  envioGratis: boolean;
}

export interface CheckoutPostalCodeResponse {
  codigo_postal: string;
  estado: string;
  municipio?: string;
  ciudad?: string;
  zona?: string;
  colonias: Array<{
    nombre: string;
    tipo?: string;
  }>;
}

export interface CheckoutCardInput {
  alias?: string;
  titular: string;
  numero: string;
  exp_mes: number;
  exp_anio: number;
  cvv: string;
  principal?: boolean;
}

export interface UserPaymentMethod {
  id_metodo_pago: number;
  id_usuario: number;
  alias?: string;
  tipo: string;
  marca: string;
  titular: string;
  ultimos4: string;
  exp_mes: number;
  exp_anio: number;
  principal: boolean;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface CheckoutCartItem {
  id_carrito: number;
  id_variante: number;
  id_producto: number;
  id_marca?: number | null;
  id_categoria?: number | null;
  cantidad: number;
  sku: string;
  nombre: string;
  descripcion?: string;
  marca?: string;
  categoria?: string;
  precio_unitario: number;
  stock: number;
  imagen?: string | null;
  imagenes?: string[];
  atributos?: Record<string, string>;
}

export interface CheckoutTotals extends CartSummary {
  freeShippingRemaining: number;
}

export interface CheckoutSummaryResponse {
  cart: {
    id_carrito: number | null;
    items: CheckoutCartItem[];
  };
  addresses: CheckoutAddress[];
  shippingMethods: CheckoutShippingMethod[];
  paymentMethods: UserPaymentMethod[];
  selectedShippingMethod: CheckoutShippingMethod;
  appliedPromotion: CheckoutPromotion | null;
  totals: CheckoutTotals;
}

export interface ConfirmCheckoutRequest {
  id_direccion_envio?: number;
  direccion?: CheckoutAddress;
  id_metodo_envio?: number | null;
  metodo_pago: 'mercado_pago';
  id_metodo_pago_usuario?: number;
  guardar_tarjeta?: boolean;
  tarjeta?: CheckoutCardInput;
  codigo_promocion?: string;
  referencia_pago?: string;
}

export interface ConfirmCheckoutResponse {
  message: string;
  order: {
    id_orden: number;
    id_usuario: number;
    id_direccion_envio: number;
    estado: string;
    subtotal: number;
    descuento: number;
    total: number;
    metodo_pago: string;
    fecha_pago: string | null;
    fecha_creacion: string;
  };
  totals: CheckoutTotals;
  checkout?: {
    provider: string;
    preference_id?: string;
    external_reference?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
}
