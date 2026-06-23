import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {
  CreatePromotionRequest,
  Promotion,
  ShippingMethodAdmin,
} from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class Promotions implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);

  promotions = signal<Promotion[]>([]);
  shippingMethods = signal<ShippingMethodAdmin[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);

  activePromotions = computed(() => this.promotions().filter((item) => item.activo).length);

  form: CreatePromotionRequest = {
    nombre: '',
    descripcion: '',
    codigo: '',
    tipo: 'porcentaje',
    valor: 10,
    compra_minima: 0,
    descuento_maximo: null,
    uso_maximo: null,
    uso_por_usuario: 1,
    inicia_en: this.toDateTimeLocal(new Date()),
    termina_en: this.toDateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    activo: true,
  };

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.productService.getAdminPromotions().subscribe({
      next: (promotions) => {
        this.promotions.set(promotions || []);
        this.loadShippingMethods();
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar promociones', 'Promociones');
      },
    });
  }

  loadShippingMethods(): void {
    this.productService.getAdminShippingMethods().subscribe({
      next: (methods) => {
        this.shippingMethods.set(methods || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.shippingMethods.set([]);
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar métodos de envío', 'Envíos');
      },
    });
  }

  createPromotion(): void {
    if (!this.form.nombre.trim()) {
      this.toastr.warning('El nombre es obligatorio', 'Promociones');
      return;
    }

    this.isSaving.set(true);
    this.productService.createPromotion({
      ...this.form,
      inicia_en: new Date(this.form.inicia_en).toISOString(),
      termina_en: new Date(this.form.termina_en).toISOString(),
    }).subscribe({
      next: (promotion) => {
        this.promotions.set([promotion, ...this.promotions()]);
        this.isSaving.set(false);
        this.toastr.success('Promoción creada correctamente', 'Promociones');
        this.resetForm();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toastr.error(error?.error?.message || 'No fue posible crear promoción', 'Promociones');
      },
    });
  }

  togglePromotion(promotion: Promotion): void {
    this.productService.updatePromotion(promotion.id_promocion, { activo: !promotion.activo }).subscribe({
      next: (updated) => {
        this.promotions.set(
          this.promotions().map((item) =>
            item.id_promocion === updated.id_promocion ? updated : item,
          ),
        );
      },
      error: () => this.toastr.error('No fue posible actualizar promoción', 'Promociones'),
    });
  }

  updateShipping(method: ShippingMethodAdmin): void {
    this.productService.updateShippingMethod(method.id_metodo_envio, {
      nombre: method.nombre,
      descripcion: method.descripcion,
      costo_base: Number(method.costo_base),
      envio_gratis_desde:
        method.envio_gratis_desde === null || method.envio_gratis_desde === undefined
          ? null
          : Number(method.envio_gratis_desde),
      dias_min: Number(method.dias_min),
      dias_max: Number(method.dias_max),
      activo: method.activo,
    }).subscribe({
      next: (updated) => {
        this.shippingMethods.set(
          this.shippingMethods().map((item) =>
            item.id_metodo_envio === updated.id_metodo_envio ? updated : item,
          ),
        );
        this.toastr.success('Método de envío actualizado', 'Envíos');
      },
      error: () => this.toastr.error('No fue posible actualizar método', 'Envíos'),
    });
  }

  resetForm(): void {
    this.form = {
      nombre: '',
      descripcion: '',
      codigo: '',
      tipo: 'porcentaje',
      valor: 10,
      compra_minima: 0,
      descuento_maximo: null,
      uso_maximo: null,
      uso_por_usuario: 1,
      inicia_en: this.toDateTimeLocal(new Date()),
      termina_en: this.toDateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      activo: true,
    };
  }

  formatCurrency(value: number | string | null | undefined): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  formatDate(date: string): string {
    return formatMexicoDateTime(date);
  }

  private toDateTimeLocal(date: Date): string {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  }
}
