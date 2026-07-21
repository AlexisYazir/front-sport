import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  EmployeeOrder,
  EmployeeOrderStatus,
  UpdateShipmentRequest,
} from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

type StatusFilter = EmployeeOrderStatus | 'all';

@Component({
  selector: 'app-employee-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-orders.html',
  styleUrl: './employee-orders.css',
})
export class EmployeeOrders implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  orders = signal<EmployeeOrder[]>([]);
  isLoading = signal(false);
  updatingOrderId = signal<number | null>(null);

  searchTerm = signal('');
  selectedStatus = signal<StatusFilter>('all');
  currentPage = signal(1);
  expandedOrderId = signal<number | null>(null);
  selectedOrderId = signal<number | null>(null);
  shipmentModal = signal<{ order: EmployeeOrder; status: UpdateShipmentRequest['estado'] } | null>(null);
  shipmentTracking = signal('');
  shipmentCarrier = signal('');
  generatingCodeOrderId = signal<number | null>(null);

  readonly pageSize = 10;
  readonly statuses: Array<{ value: EmployeeOrderStatus; label: string }> = [
    { value: 'pendiente_pago', label: 'Pago pendiente' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en proceso', label: 'En proceso' },
    { value: 'entregado', label: 'Entregado' },
  ];
  readonly shipmentActions: Array<{
    value: UpdateShipmentRequest['estado'];
    label: string;
    icon: string;
  }> = [
    { value: 'preparando', label: 'Preparar', icon: 'inventory_2' },
    { value: 'enviado', label: 'Enviar', icon: 'local_shipping' },
    { value: 'en_transito', label: 'En tránsito', icon: 'route' },
    { value: 'entregado', label: 'Entregar', icon: 'task_alt' },
  ];

  filteredOrders = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();

    return this.orders().filter((order) => {
      const orderStatus = this.normalizeStatus(order.estado);
      const matchesStatus = status === 'all' || orderStatus === status;

      const matchesSearch =
        !search ||
        [
          String(order.id_orden),
          order.cliente,
          order.email,
          order.estado,
          order.metodo_pago,
          ...(order.items || []).flatMap((item) => [item.sku, item.producto]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    }).sort(
      (a, b) => new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime(),
    );
  });

  selectedOrder = computed(() => {
    const id = this.selectedOrderId();
    if (!id) return null;
    return this.orders().find((order) => Number(order.id_orden) === Number(id)) ?? null;
  });

  paginatedOrders = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize)),
  );

  pendingCount = computed(() => this.statusCount('pendiente'));
  inProcessCount = computed(() => this.statusCount('en proceso'));
  deliveredCount = computed(() => this.statusCount('entregado'));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.selectedOrderId.set(Number.isFinite(id) && id > 0 ? id : null);
    });
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.productService.getEmployeeOrdersList().subscribe({
      next: (orders) => {
        this.orders.set(orders || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar los pedidos', 'Pedidos');
      },
    });
  }

  refresh(): void {
    this.productService.clearRequestCache();
    this.loadOrders();
    this.toastr.success('Datos actualizados correctamente', 'Actualización');
  }

  onFiltersChange(): void {
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
    this.currentPage.set(1);
  }

  onStatusChange(order: EmployeeOrder, status: string): void {
    const newStatus = this.normalizeStatus(status);
    const currentStatus = this.normalizeStatus(order.estado);

    if (currentStatus === 'entregado') {
      this.toastr.info('Los pedidos entregados ya están finalizados', 'Pedidos');
      return;
    }

    if (currentStatus === 'pendiente_pago' || newStatus === 'pendiente_pago') {
      this.toastr.info('Espera a que Mercado Pago confirme el pago', 'Pedidos');
      return;
    }

    if (newStatus === currentStatus) {
      return;
    }

    this.updatingOrderId.set(order.id_orden);
    this.productService
      .updateEmployeeOrderStatus(order.id_orden, newStatus)
      .subscribe({
        next: (response) => {
          const updated = response.order;
          this.orders.set(
            this.orders().map((item) =>
              item.id_orden === order.id_orden
                ? {
                    ...item,
                    estado: updated.estado,
                    fecha_envio: String(updated.fecha_envio ?? item.fecha_envio ?? ''),
                    fecha_entrega: String(updated.fecha_entrega ?? item.fecha_entrega ?? ''),
                  }
                : item,
            ),
          );
          this.updatingOrderId.set(null);
          this.toastr.success(response.message, 'Pedidos');
        },
        error: (error) => {
          this.updatingOrderId.set(null);
          const message = error?.error?.message || 'No fue posible actualizar el pedido';
          this.toastr.error(message, 'Pedidos');
        },
      });
  }

  quickShipmentUpdate(
    order: EmployeeOrder,
    status: UpdateShipmentRequest['estado'],
  ): void {
    if (!this.isShipmentActionAllowed(order, status)) {
      this.toastr.info(this.getShipmentActionBlockedMessage(order, status), 'Envíos');
      return;
    }

    if (this.isDelivered(order)) {
      this.toastr.info('Los pedidos entregados ya están finalizados', 'Envíos');
      return;
    }

    if (this.isPaymentPending(order)) {
      this.toastr.info('Espera a que Mercado Pago confirme el pago', 'Envíos');
      return;
    }

    this.shipmentTracking.set(order.tracking_number || '');
    this.shipmentCarrier.set(order.paqueteria || '');
    this.shipmentModal.set({ order, status });
  }

  closeShipmentModal(): void {
    if (!this.updatingOrderId()) {
      this.shipmentModal.set(null);
      this.shipmentTracking.set('');
      this.shipmentCarrier.set('');
    }
  }

  confirmShipmentUpdate(): void {
    const modal = this.shipmentModal();
    if (!modal) return;

    const { order, status } = modal;
    const payload: UpdateShipmentRequest = {
      estado: status,
      comentario: `Actualización de envío: ${this.getShipmentStatusLabel(status)}`,
    };

    if (status === 'enviado') {
      payload.tracking_number = this.shipmentTracking().trim() || order.tracking_number || undefined;
      payload.paqueteria = this.shipmentCarrier().trim() || order.paqueteria || undefined;
    }

    this.updatingOrderId.set(order.id_orden);
    this.productService.updateOrderShipment(order.id_orden, payload).subscribe({
      next: (response) => {
        const tracking = response.tracking;
        this.orders.set(
          this.orders().map((item) =>
            item.id_orden === order.id_orden
              ? {
                  ...item,
                  estado: tracking.estado_pedido || item.estado,
                  estado_envio: tracking.estado_envio,
                  tracking_number: tracking.tracking_number,
                  paqueteria: tracking.paqueteria,
                  fecha_envio: tracking.fecha_envio || item.fecha_envio,
                  fecha_entrega: tracking.fecha_entrega || item.fecha_entrega,
                  fecha_entrega_estimada: tracking.fecha_entrega_estimada,
                  fecha_entrega_real: tracking.fecha_entrega_real,
                  codigo_confirmacion_entrega: tracking.codigo_confirmacion_entrega ?? item.codigo_confirmacion_entrega,
                  codigo_confirmacion_generado_en: tracking.codigo_confirmacion_generado_en,
                  entrega_confirmada_por_usuario: tracking.entrega_confirmada_por_usuario,
                  entrega_confirmada_en: tracking.entrega_confirmada_en,
                  entrega_validada_por_empleado: tracking.entrega_validada_por_empleado,
                  entrega_validada_en: tracking.entrega_validada_en,
                  eventos_envio: tracking.eventos_envio || item.eventos_envio,
                }
              : item,
          ),
        );
        this.updatingOrderId.set(null);
        this.closeShipmentModal();
        this.toastr.success(response.message, 'Envíos');
      },
      error: (error) => {
        this.updatingOrderId.set(null);
        const message = error?.error?.message || 'No fue posible actualizar el envío';
        this.toastr.error(message, 'Envíos');
      },
    });
  }

  generateDeliveryCode(order: EmployeeOrder): void {
    if (this.isPaymentPending(order) || this.isDelivered(order)) {
      this.toastr.info('Este pedido no permite generar código de entrega', 'Entrega');
      return;
    }

    if (this.normalizeShipmentStatus(order.estado_envio) === 'pendiente') {
      this.toastr.info('Primero marca el pedido como preparado', 'Entrega');
      return;
    }

    if (order.entrega_confirmada_por_usuario) {
      this.toastr.info('El cliente ya confirmó este pedido', 'Entrega');
      return;
    }

    if (order.codigo_confirmacion_entrega) {
      this.toastr.info('Código listo para imprimir', 'Entrega');
      this.openDeliveryCodePdf(order, order.codigo_confirmacion_entrega);
      return;
    }

    this.generatingCodeOrderId.set(order.id_orden);
    this.productService.generateDeliveryConfirmationCode(order.id_orden).subscribe({
      next: (response) => {
        const tracking = response.tracking;
        this.orders.set(
          this.orders().map((item) =>
            item.id_orden === order.id_orden
              ? {
                  ...item,
                  codigo_confirmacion_entrega: response.code,
                  codigo_confirmacion_generado_en: tracking.codigo_confirmacion_generado_en,
                  entrega_confirmada_por_usuario: tracking.entrega_confirmada_por_usuario,
                  entrega_confirmada_en: tracking.entrega_confirmada_en,
                  entrega_validada_por_empleado: tracking.entrega_validada_por_empleado,
                  entrega_validada_en: tracking.entrega_validada_en,
                  eventos_envio: tracking.eventos_envio || item.eventos_envio,
                }
              : item,
          ),
        );
        this.generatingCodeOrderId.set(null);
        this.toastr.success(response.message, 'Entrega');
        this.openDeliveryCodePdf(
          {
            ...order,
            codigo_confirmacion_entrega: response.code,
            codigo_confirmacion_generado_en: tracking.codigo_confirmacion_generado_en,
          },
          response.code,
        );
      },
      error: (error) => {
        this.generatingCodeOrderId.set(null);
        const message = error?.error?.message || 'No fue posible generar el código';
        this.toastr.error(message, 'Entrega');
      },
    });
  }

  viewOrder(order: EmployeeOrder): void {
    this.router.navigate(['/dashboard/empleado/orders', order.id_orden]);
  }

  backToOrders(): void {
    this.router.navigate(['/dashboard/empleado/orders']);
  }

  getOrderImage(order: EmployeeOrder): string {
    return this.getPrimaryOrderItem(order)?.imagen || 'assets/images/no-image.jpg';
  }

  getPrimaryOrderItem(order: EmployeeOrder): any {
    return order.items?.[0] || null;
  }

  getItemName(item: any): string {
    return item?.producto || item?.nombre || 'Producto';
  }

  getItemDescription(item: any): string {
    return item?.descripcion || [item?.marca, item?.categoria].filter(Boolean).join(' · ') || 'Producto de Sport Center';
  }

  getItemAttributes(item: any): string {
    const attrs = this.getVariantInfo(item);
    return attrs || [item?.marca, item?.categoria].filter(Boolean).join(' · ');
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  toggleOrderDetails(order: EmployeeOrder): void {
    this.expandedOrderId.set(this.expandedOrderId() === order.id_orden ? null : order.id_orden);
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  normalizeStatus(status: string): EmployeeOrderStatus {
    const normalized = String(status || '').trim().toLowerCase();

    if (normalized === 'pendiente_pago') return 'pendiente_pago';
    if (normalized === 'entregado') return 'entregado';
    if (normalized === 'en proceso') return 'en proceso';
    return 'pendiente';
  }

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    const found = this.statuses.find((item) => item.value === normalized);
    return found?.label || 'Pendiente';
  }

  getStatusClass(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'pendiente_pago':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'entregado':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'en proceso':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  }

  isPaymentPending(order: EmployeeOrder): boolean {
    return this.normalizeStatus(order.estado) === 'pendiente_pago';
  }

  getShipmentStatusLabel(status: string | null | undefined): string {
    const normalized = this.normalizeShipmentStatus(status);
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      preparando: 'Preparando',
      enviado: 'Enviado',
      en_transito: 'En tránsito',
      entregado: 'Entregado',
      incidencia: 'Incidencia',
    };

    return labels[normalized] || 'Pendiente';
  }

  getShipmentStatusClass(status: string | null | undefined): string {
    const normalized = this.normalizeShipmentStatus(status);

    if (normalized === 'entregado') {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (['enviado', 'en_transito', 'preparando'].includes(normalized)) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    if (normalized === 'incidencia') {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  isDelivered(order: EmployeeOrder): boolean {
    return this.normalizeStatus(order.estado) === 'entregado';
  }

  isShipmentActionAllowed(
    order: EmployeeOrder,
    status: UpdateShipmentRequest['estado'],
  ): boolean {
    if (this.isDelivered(order) || this.isPaymentPending(order)) return false;
    const current = this.normalizeShipmentStatus(order.estado_envio);
    const nextByCurrent: Record<string, string> = {
      pendiente: 'preparando',
      preparando: 'enviado',
      enviado: 'en_transito',
      en_transito: 'entregado',
    };

    if (status !== nextByCurrent[current]) return false;
    if (status === 'enviado' && !order.codigo_confirmacion_entrega) return false;
    if (status === 'entregado' && !order.entrega_confirmada_por_usuario) return false;
    return true;
  }

  getShipmentActionBlockedMessage(
    order: EmployeeOrder,
    status: UpdateShipmentRequest['estado'],
  ): string {
    if (this.isDelivered(order)) return 'El pedido ya fue finalizado';
    if (this.isPaymentPending(order)) return 'Espera la confirmación de pago';
    if (
      this.normalizeShipmentStatus(order.estado_envio) === 'preparando' &&
      !order.codigo_confirmacion_entrega
    ) {
      return 'Genera e imprime el código de confirmación antes de enviar';
    }

    if (status === 'entregado' && !order.entrega_confirmada_por_usuario) {
      return 'El cliente debe confirmar el código incluido en el paquete';
    }

    const current = this.normalizeShipmentStatus(order.estado_envio);
    const nextLabel = this.getShipmentStatusLabel({
      pendiente: 'preparando',
      preparando: 'enviado',
      enviado: 'en_transito',
      en_transito: 'entregado',
    }[current] || 'pendiente');

    return `El siguiente paso válido es: ${nextLabel}`;
  }

  canGenerateDeliveryCode(order: EmployeeOrder): boolean {
    return (
      !this.isDelivered(order) &&
      !this.isPaymentPending(order) &&
      this.normalizeShipmentStatus(order.estado_envio) !== 'pendiente' &&
      !order.entrega_confirmada_por_usuario
    );
  }

  formatCurrency(value: number | string): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  formatDate(date: string | null): string {
    return date ? formatMexicoDateTime(date) : 'Pendiente';
  }

  formatLongDate(date: string | null): string {
    if (!date) return 'Pendiente';

    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }

  getVariantInfo(item: any): string {
    const atributos = item?.atributos || {};
    const values = [atributos.Talla, atributos.talla, atributos.Color, atributos.color]
      .filter(Boolean);
    return values.join(' · ');
  }

  getAddressLabel(order: EmployeeOrder): string {
    const address = order.direccion_envio;
    if (!address) return 'Sin dirección registrada';

    return [
      address.calle,
      address.numero,
      address.colonia,
      address.ciudad,
      address.estado,
      address.codigo_postal,
    ]
      .filter(Boolean)
      .join(', ');
  }

  normalizeShipmentStatus(status: string | null | undefined): string {
    return String(status || 'pendiente').trim().toLowerCase().replace(/\s+/g, '_');
  }

  private async openDeliveryCodePdf(order: EmployeeOrder, code: string): Promise<void> {
    try {
      const safeCode = String(code || '').replace(/[^A-Z0-9]/g, '');
      const filename = `codigo-entrega-${order.id_orden}.pdf`;
      const pdfBlob = await this.buildDeliveryCodePdf(order, safeCode);
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfFile);
      const preview = window.open('', '_blank', 'width=1100,height=760');

      if (!preview) {
        this.downloadBlob(pdfBlob, filename);
        this.toastr.info('Se descargó el PDF porque el navegador bloqueó la vista previa', 'Entrega');
        return;
      }

      preview.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <title>${filename}</title>
            <style>
              html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                overflow: hidden;
                background: #2f2f2f;
              }

              iframe {
                width: 100%;
                height: 100%;
                border: 0;
                display: block;
              }

              .download-pdf {
                position: fixed;
                top: 10px;
                right: 86px;
                z-index: 10;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, .24);
                background: #0367A6;
                color: #fff;
                text-decoration: none;
                box-shadow: 0 8px 18px rgba(0, 0, 0, .28);
              }

              .download-pdf:hover {
                background: #035A91;
              }

              .download-pdf svg {
                width: 18px;
                height: 18px;
                display: block;
              }
            </style>
          </head>
          <body>
            <a class="download-pdf" href="${pdfUrl}" download="${filename}" title="Descargar PDF" aria-label="Descargar PDF">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
              </svg>
            </a>
            <iframe src="${pdfUrl}"></iframe>
          </body>
        </html>
      `);
      preview.document.close();
    } catch (error) {
      this.toastr.error('No fue posible generar el PDF', 'Entrega');
    }
  }

  private async buildDeliveryCodePdf(order: EmployeeOrder, code: string): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setProperties({
      title: `codigo-entrega-${order.id_orden}`,
      subject: 'Código de confirmación de entrega',
      author: 'Sport Center Huejutla',
      creator: 'Sport Center',
    });
    const watermarkUrl =
      'https://res.cloudinary.com/dcktzxrmw/image/upload/v1783069223/logoSPORT-center-02_4_blnw8s.png';

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    try {
      const watermark = await this.loadImageAsDataUrl(watermarkUrl);
      const watermarkLayer = await this.createCenteredWatermarkLayer(
        watermark,
        pageWidth,
        pageHeight,
      );
      pdf.addImage(watermarkLayer, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    } catch {
      pdf.setTextColor(235, 235, 235);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(118);
      pdf.text('SPORT', pageWidth / 2, 330, { align: 'center', angle: -28 });
      pdf.text('CENTER', pageWidth / 2, 455, { align: 'center', angle: -28 });
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(16);
    pdf.text('ESTE ES TU CODIGO DE CONFIRMACION DE ENTREGA', pageWidth / 2, 320, {
      align: 'center',
    });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(76);
    pdf.text(code, pageWidth / 2, 410, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(17);
    pdf.text('EMITIDO POR SPORT CENTER HUEJUTLA', pageWidth / 2, 490, {
      align: 'center',
    });

    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(11);
    pdf.text(`Pedido #${order.id_orden}`, pageWidth / 2, 540, { align: 'center' });

    return pdf.output('blob');
  }

  private async loadImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error('No se pudo cargar la marca de agua');
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private async createCenteredWatermarkLayer(
    dataUrl: string,
    pageWidth: number,
    pageHeight: number,
  ): Promise<string> {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageWidth * scale);
    canvas.height = Math.round(pageHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo crear la marca de agua');
    }

    const image = await this.loadImageElement(dataUrl);
    const maxWidth = canvas.width * 1.08;
    const maxHeight = canvas.height * 0.78;
    const imageRatio = image.naturalWidth / image.naturalHeight;

    let targetWidth = maxWidth;
    let targetHeight = targetWidth / imageRatio;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * imageRatio;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.globalAlpha = 0.075;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((-28 * Math.PI) / 180);
    context.drawImage(
      image,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight,
    );
    context.restore();

    return canvas.toDataURL('image/png');
  }

  private loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      image.src = dataUrl;
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  statusCount(status: EmployeeOrderStatus): number {
    return this.orders().filter((order) => this.normalizeStatus(order.estado) === status)
      .length;
  }

  get firstItem(): number {
    if (this.filteredOrders().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filteredOrders().length);
  }
}
