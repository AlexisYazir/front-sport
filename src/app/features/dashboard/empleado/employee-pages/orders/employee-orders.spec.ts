import { HttpTestingController } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { EmployeeOrder } from '../../../../../core/models/product.model';
import { componentTestProviders } from '../../../../../../../tests/shared-testing/component-test-bed';
import { EmployeeOrders } from './employee-orders';

interface DeliveryPdfTestMethods {
  buildDeliveryCodePdf(order: EmployeeOrder, code: string): Promise<Blob>;
  openDeliveryCodePdf(order: EmployeeOrder, code: string): Promise<void>;
}

const qaOrder: EmployeeOrder = {
  id_orden: 943, id_usuario: 77, id_direccion_envio: 88, estado: 'en proceso',
  subtotal: 100, descuento: 0, total: 100, metodo_pago: 'QA', fecha_pago: null,
  fecha_envio: null, fecha_entrega: null, fecha_creacion: '2026-01-01T00:00:00Z',
  cliente: 'Cliente exclusivo QA', email: 'privado@example.invalid', total_productos: 0,
  total_items: 0, items: [], direccion_envio: { calle: 'Dirección exclusiva QA' },
};

function pdfText(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join('');
}

function previewWindow() {
  let closed = false;
  const events = new EventTarget();
  const write = jasmine.createSpy('preview document.write');
  const preview = {
    document: { write, close: jasmine.createSpy('preview document.close') },
    get closed() { return closed; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Window;
  return { preview, write, close: () => { closed = true; }, hide: () => events.dispatchEvent(new Event('pagehide')) };
}

describe('PDF de confirmación de entrega', () => {
  let pdf: DeliveryPdfTestMethods;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: componentTestProviders() });
    pdf = TestBed.runInInjectionContext(() => new EmployeeOrders()) as unknown as DeliveryPdfTestMethods;
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('genera un PDF real de una página con marca PNG, código y metadatos sin datos personales del pedido', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 24;
    const context = canvas.getContext('2d');
    if (!context) throw Error('La prueba requiere Canvas 2D real');
    context.fillStyle = '#0367a6'; context.fillRect(0, 0, 24, 24);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('PNG vacío')), 'image/png'));
    const fetchImage = spyOn(window, 'fetch').and.resolveTo(new Response(png, { status: 200 }));

    const blob = await pdf.buildDeliveryCodePdf(qaOrder, 'QA7B93');
    const body = pdfText(await blob.arrayBuffer());

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
    expect(body.startsWith('%PDF-')).toBeTrue();
    expect(body.match(/\/Type \/Page\b/g)?.length).toBe(1);
    expect(body).toContain('/Subtype /Image');
    expect(body).toContain('/Width 1224');
    expect(body).toContain('/Height 1584');
    expect(body).toContain('(QA7B93) Tj');
    expect(body).toContain('(Pedido #943) Tj');
    expect(body).toContain('/Title (codigo-entrega-943)');
    expect(body).toContain('/Author (Sport Center Huejutla)');
    expect(body).toContain('/Creator (Sport Center)');
    expect(body).not.toContain(qaOrder.email ?? 'privado@example.invalid');
    expect(body).not.toContain(qaOrder.cliente ?? 'Cliente exclusivo QA');
    expect(body).not.toContain('Dirección exclusiva QA');
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage.calls.mostRecent().args[0]).toContain('.png');
    expect(fetchImage.calls.mostRecent().args[1]).toEqual({ mode: 'cors' });
  });

  it('conserva un PDF real y la marca de texto si no se puede descargar la imagen', async () => {
    spyOn(window, 'fetch').and.rejectWith(new TypeError('Sin conexión QA'));
    const blob = await pdf.buildDeliveryCodePdf(qaOrder, 'QA7B93');
    const body = pdfText(await blob.arrayBuffer());
    expect(body.startsWith('%PDF-')).toBeTrue();
    expect(body).toContain('(SPORT) Tj');
    expect(body).toContain('(CENTER) Tj');
    expect(body).toContain('(QA7B93) Tj');
    expect(body).not.toContain('/Subtype /Image');
  });

  it('sanea el código, conserva la vista previa y libera su URL al cerrar sin liberarla dos veces', fakeAsync(() => {
    const build = spyOn(pdf, 'buildDeliveryCodePdf').and.resolveTo(new Blob(['%PDF-QA'], { type: 'application/pdf' }));
    const popup = previewWindow();
    spyOn(window, 'open').and.returnValue(popup.preview);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:qa-preview');
    const revoke = spyOn(URL, 'revokeObjectURL');
    void pdf.openDeliveryCodePdf(qaOrder, 'QA7<B9!3');
    flushMicrotasks();
    expect(build).toHaveBeenCalledOnceWith(qaOrder, 'QA7B93');
    expect(popup.write.calls.mostRecent().args[0]).toContain('<iframe src="blob:qa-preview"></iframe>');
    expect(popup.write.calls.mostRecent().args[0]).toContain('download="codigo-entrega-943.pdf"');
    expect(revoke).not.toHaveBeenCalled();
    popup.close(); tick(1000); popup.hide();
    expect(revoke).toHaveBeenCalledOnceWith('blob:qa-preview');
  }));

  it('usa sólo la URL de descarga y la libera cuando el navegador bloquea la vista previa', fakeAsync(() => {
    spyOn(pdf, 'buildDeliveryCodePdf').and.resolveTo(new Blob(['%PDF-QA']));
    spyOn(window, 'open').and.returnValue(null);
    const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:qa-download');
    const revoke = spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    void pdf.openDeliveryCodePdf(qaOrder, 'QA7B93'); flushMicrotasks();
    expect(create).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(ToastrService).info).toHaveBeenCalled();
    tick(1000);
    expect(revoke).toHaveBeenCalledOnceWith('blob:qa-download');
  }));

  it('libera la URL y avisa si falla el documento de vista previa', fakeAsync(() => {
    spyOn(pdf, 'buildDeliveryCodePdf').and.resolveTo(new Blob(['%PDF-QA']));
    const popup = previewWindow(); popup.write.and.throwError('Vista QA no disponible');
    spyOn(window, 'open').and.returnValue(popup.preview);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:qa-preview');
    const revoke = spyOn(URL, 'revokeObjectURL');
    void pdf.openDeliveryCodePdf(qaOrder, 'QA7B93'); flushMicrotasks();
    expect(revoke).toHaveBeenCalledOnceWith('blob:qa-preview');
    expect(TestBed.inject(ToastrService).error).toHaveBeenCalledWith('No fue posible generar el PDF', 'Entrega');
  }));

  it('libera la URL si se abandona la página que creó la vista previa', fakeAsync(() => {
    spyOn(pdf, 'buildDeliveryCodePdf').and.resolveTo(new Blob(['%PDF-QA']));
    spyOn(window, 'open').and.returnValue(previewWindow().preview);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:qa-preview');
    const revoke = spyOn(URL, 'revokeObjectURL');
    void pdf.openDeliveryCodePdf(qaOrder, 'QA7B93'); flushMicrotasks();
    window.dispatchEvent(new Event('pagehide'));
    expect(revoke).toHaveBeenCalledOnceWith('blob:qa-preview');
  }));
});
