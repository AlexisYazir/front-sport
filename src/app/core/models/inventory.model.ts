export interface InventoryMovements {
  id_producto: number;
  producto: string;
  activo: boolean;
  precio: number | null;
  stock: number | null;
  marca?: string;
  imagen: string;
  fecha_creacion: string;

}