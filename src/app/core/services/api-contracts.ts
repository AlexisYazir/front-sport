import type { InventoryProduct, Orders, ShipmentEvent, ShippingAddressSnapshot, Variante } from '../models/product.model';
import type { UserRole } from '../models/user.model';

export interface MessageResponse { message: string }
export interface RegistrationReceipt { id_usuario: number; email: string }
export interface UploadImageResponse { public_id: string; secure_url: string; url: string }
export interface UserProfile {
  nombre: string; aPaterno: string; aMaterno: string; email: string | null;
  telefono: string | null; rol: UserRole; ubicacion: number | null; fecha_creacion: string;
}
export interface ApiProduct {
  id_producto: number; producto: string; descripcion: string; marca: string; categoria: string;
  imagen_marca?: string; activo: boolean; fecha_creacion: string; categoria_padre?: string;
  deportes?: string[]; variantes?: Variante[];
}
export type ApiInventoryProduct = Omit<InventoryProduct, 'imagen'> & { imagen?: string; imagen_producto?: string };
export interface ProductEntityResponse {
  id_producto: number; nombre: string; descripcion: string; id_marca: number; id_categoria: number;
  activo: boolean; fecha_creacion: string;
}
export interface VariantAttributeValueResponse { id_variante: number; id_atributo: number; valor: string }
export interface ProductSportsResponse { id_producto: number; deportes_asignados: number }
export interface InventoryMovementInput {
  id_variante: number; tipo: string; cantidad: number; costo_unitario: number;
  referencia_tipo: string; referencia_id: number;
}
export interface InventoryMovementSkuInput {
  sku: string; tipo: string; cantidad: number; costo_unitario?: number;
  referencia_tipo?: string; referencia_id?: number;
}
export interface InventoryMovement extends InventoryMovementInput {
  id_movimiento: number; fecha: string; sku?: string; producto?: string; marca?: string;
  imagenes_variante?: string[]; imagen_variante?: string;
}
export interface BulkInventoryResponse {
  success: number; errors: { row: number; sku: string; error: string; data: InventoryMovementSkuInput }[];
}
export interface InventoryMovementVariant {
  id_variante: number; id_producto: number; sku: string; producto: string; marca: string;
  stock_actual: number; stock?: number; precio: number; imagenes: string[]; imagen: string; atributos?: Record<string, string>;
}
export interface MenuCategory { id_categoria: number; nombre: string; id_padre?: number | null }
export interface CompleteMenu { clothing: MenuCategory[]; accessories: MenuCategory[]; sports: { id_deporte: number; nombre: string }[]; brands: {id_marca: number; nombre: string; imagen?: string}[] }
export interface OrderDetailRow extends Orders {
  id_variante: number; sku: string; cantidad: number; precio_unitario: number;
  producto?: string; nombre_producto?: string; imagenes?: string[];
}
export interface OrderTracking {
  id_orden: number; estado_pedido: string; total: number; fecha_creacion: string;
  fecha_envio: string | null; fecha_entrega: string | null; id_envio: number | null;
  estado_envio: string | null; tracking_number: string | null; paqueteria: string | null;
  costo_envio: number | string | null; fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null; codigo_confirmacion_entrega?: string | null;
  codigo_confirmacion_generado_en: string | null; entrega_confirmada_por_usuario: boolean;
  entrega_confirmada_en: string | null; entrega_validada_por_empleado: boolean;
  entrega_validada_en: string | null; metodo_envio: string | null; descripcion_envio: string | null;
  direccion_envio: ShippingAddressSnapshot; eventos_envio: ShipmentEvent[];
}
export interface ContactInput { nombre: string; email: string; telefono?: string; asunto?: string; mensaje: string }
export interface ContactMessage extends Omit<ContactInput, 'telefono' | 'asunto'> {
  telefono?: string | null; asunto?: string | null;
  id_mensaje: number; leido: boolean; respondido: boolean; fecha_lectura: string | null;
  id_usuario_responde: number | null; created_at: string;
}
export interface ContactUpdate { leido?: boolean; respondido?: boolean }
export interface BackupOperationResponse {
  success: boolean; error?: string; folder?: string; dumpFile?: string; logFile?: string;
  logKey?: string; source?: string; deletedOlderThanDays?: number; deletedCount?: number; type?: string;
}
export interface DbConnection {
  pid: number; usename: string | null; datname: string | null; application_name: string;
  client_addr: string | null; state: string | null; query: string; backend_start: string;
  xact_start: string | null; query_start: string | null;
}
export interface DbLock { pid: number; usename: string | null; datname: string | null; locktype: string; tabla: string | null; mode: string; granted: boolean }
export interface DbBlockingLock { blocked_pid: number; blocked_user: string; blocking_pid: number; blocking_user: string; blocked_query: string; blocking_query: string; wait_event_type: string | null; wait_event: string | null }
export interface DbInterval { years?: number; months?: number; days?: number; hours?: number; minutes?: number; seconds?: number; milliseconds?: number }
export interface DbLongQuery { pid: number; usename: string; query: string; state: string; duration: DbInterval }
export type PgCount = number | string;
export interface DbQueryStats {
  schemaname: string; tablename: string; total_escaneos_secuenciales: PgCount;
  filas_leidas_secuencial: PgCount; total_escaneos_indice: PgCount; filas_leidas_indice: PgCount;
  inserts: PgCount; updates: PgCount; deletes: PgCount; filas_vivas: PgCount; filas_muertas: PgCount;
  total_consultas: PgCount; porcentaje_uso_indices: PgCount;
}
export interface DbTableSize { schemaname: string; tablename: string; total_size_humano: string; total_size_bytes: PgCount; tabla_size_humano: string; indices_size_humano: string; indices_size_bytes: PgCount; filas_aproximadas: PgCount }
export interface DbIndex { schemaname: string; tablename: string; indexname: string; indexdef: string; index_size_humano: string; index_size_bytes: PgCount; veces_usado: PgCount; filas_leidas: PgCount; filas_obtenidas: PgCount }
export interface DbTableLock { tabla: string; mode: string; cantidad_locks: PgCount; concedidos: PgCount; esperando: PgCount }
export interface DbScanStats { schemaname: string; tablename: string; seq_scan: PgCount; idx_scan: PgCount; total_accesos: PgCount; porcentaje_escaneo_secuencial: PgCount }

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!object(error) || !object(error['error'])) return fallback;
  const body = error['error'];
  const message = body['message'];
  if (typeof message === 'string' && message) return message;
  if (Array.isArray(message) && message.every((value: unknown) => typeof value === 'string')) return message.join(', ');
  return typeof body['error'] === 'string' && body['error'] ? body['error'] : fallback;
}
