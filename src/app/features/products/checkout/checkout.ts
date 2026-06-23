import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  CheckoutAddress,
  CheckoutCardInput,
  CheckoutSummaryResponse,
  ConfirmCheckoutRequest,
} from '../../../core/models/cart.model';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';

type AddressMode = 'existing' | 'new';
type PaymentMode = 'saved' | 'new';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);

  summary = signal<CheckoutSummaryResponse | null>(null);
  isLoading = signal(true);
  isSubmitting = signal(false);
  isApplyingCoupon = signal(false);
  isLookingUpPostalCode = signal(false);

  addressMode = signal<AddressMode>('new');
  selectedAddressId = signal<number | null>(null);
  selectedShippingMethodId = signal<number | null>(null);
  paymentMode = signal<PaymentMode>('new');
  selectedPaymentMethodId = signal<number | null>(null);
  saveCard = signal(true);
  postalColonias = signal<Array<{ nombre: string; tipo?: string }>>([]);
  couponCode = signal('');
  appliedCouponCode = signal('');
  private lastPostalLookup = '';
  private paymentSelectionInitialized = false;

  addressForm: CheckoutAddress = {
    alias: 'Casa',
    calle: '',
    numero: '',
    colonia: '',
    ciudad: '',
    estado: '',
    codigo_postal: '',
    pais: 'México',
    principal: true,
  };

  cardForm: CheckoutCardInput = {
    alias: 'Mi tarjeta',
    titular: '',
    numero: '',
    exp_mes: new Date().getMonth() + 1,
    exp_anio: new Date().getFullYear(),
    cvv: '',
    principal: true,
  };

  items = computed(() => this.summary()?.cart.items || []);
  totals = computed(() => this.summary()?.totals);
  addresses = computed(() => this.summary()?.addresses || []);
  shippingMethods = computed(() => this.summary()?.shippingMethods || []);
  paymentMethods = computed(() => this.summary()?.paymentMethods || []);
  selectedShippingMethod = computed(() => this.summary()?.selectedShippingMethod);
  appliedPromotion = computed(() => this.summary()?.appliedPromotion);
  isEmpty = computed(() => this.items().length === 0);
  cardBrand = computed(() => this.detectCardBrand(this.cardForm.numero));

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(options?: { keepAddressMode?: boolean }): void {
    this.isLoading.set(true);
    this.productService
      .getCheckoutSummary({
        codigo_promocion: this.appliedCouponCode(),
        id_metodo_envio: this.selectedShippingMethodId(),
      })
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.syncSelections(summary, options?.keepAddressMode === true);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.toastr.error(
            this.getBackendMessage(error, 'No fue posible cargar el checkout'),
            'Checkout',
          );
        },
      });
  }

  selectShippingMethod(idMetodo: number | null): void {
    this.selectedShippingMethodId.set(idMetodo);
    this.loadSummary({ keepAddressMode: true });
  }

  applyCoupon(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isSubmitting()) {
      return;
    }

    const code = this.couponCode().trim();

    if (!code) {
      this.appliedCouponCode.set('');
      this.loadSummary({ keepAddressMode: true });
      return;
    }

    this.isApplyingCoupon.set(true);
    this.productService
      .getCheckoutSummary({
        codigo_promocion: code,
        id_metodo_envio: this.selectedShippingMethodId(),
      })
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.appliedCouponCode.set(code);
          this.syncSelections(summary, true);
          this.isApplyingCoupon.set(false);
          this.toastr.success('Cupón aplicado correctamente', 'Promoción');
        },
        error: (error) => {
          this.isApplyingCoupon.set(false);
          this.toastr.error(
            this.getBackendMessage(error, 'El cupón no pudo aplicarse'),
            'Promoción',
          );
        },
      });
  }

  removeCoupon(): void {
    this.couponCode.set('');
    this.appliedCouponCode.set('');
    this.loadSummary({ keepAddressMode: true });
  }

  confirmOrder(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isApplyingCoupon()) {
      return;
    }

    if (this.isEmpty()) {
      this.router.navigate(['/cart']);
      return;
    }

    const payload = this.buildCheckoutPayload();
    if (!payload) {
      return;
    }

    this.isSubmitting.set(true);
    this.productService.confirmCheckout(payload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.toastr.success(response.message, 'Checkout');
        this.cartService.loadCart().subscribe();
        this.router.navigate(['/dashboard/usuario/compras']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.toastr.error(
          this.getBackendMessage(error, 'No fue posible finalizar la compra'),
          'Checkout',
        );
        this.loadSummary({ keepAddressMode: true });
      },
    });
  }

  useNewAddress(): void {
    this.addressMode.set('new');
    this.selectedAddressId.set(null);
  }

  useExistingAddress(id: number): void {
    this.addressMode.set('existing');
    this.selectedAddressId.set(Number(id));
  }

  useNewPaymentMethod(): void {
    this.paymentMode.set('new');
    this.selectedPaymentMethodId.set(null);
  }

  useSavedPaymentMethod(id: number): void {
    this.paymentMode.set('saved');
    this.selectedPaymentMethodId.set(Number(id));
  }

  onPostalCodeChange(value: string): void {
    const zipCode = String(value || '').replace(/\D/g, '').slice(0, 5);
    this.addressForm.codigo_postal = zipCode;

    if (zipCode.length === 5 && zipCode !== this.lastPostalLookup) {
      this.lookupPostalCode(zipCode);
    }
  }

  lookupPostalCode(zipCode = this.addressForm.codigo_postal): void {
    const normalizedZipCode = String(zipCode || '').replace(/\D/g, '').slice(0, 5);

    if (normalizedZipCode.length !== 5) {
      this.toastr.warning('Ingresa un código postal de 5 dígitos', 'Dirección');
      return;
    }

    this.isLookingUpPostalCode.set(true);
    this.productService.lookupPostalCode(normalizedZipCode).subscribe({
      next: (response) => {
        const colonias = Array.isArray(response.colonias) ? response.colonias : [];
        this.addressForm.codigo_postal = response.codigo_postal || normalizedZipCode;
        this.addressForm.estado = response.estado || '';
        this.addressForm.ciudad = response.ciudad || response.municipio || '';
        this.addressForm.colonia = colonias[0]?.nombre || this.addressForm.colonia || '';
        this.postalColonias.set(colonias);
        this.lastPostalLookup = normalizedZipCode;
        this.isLookingUpPostalCode.set(false);
      },
      error: (error) => {
        this.postalColonias.set([]);
        this.isLookingUpPostalCode.set(false);
        this.toastr.error(
          this.getBackendMessage(error, 'No fue posible consultar el código postal'),
          'Dirección',
        );
      },
    });
  }

  onCardNumberChange(value: string): void {
    const number = String(value || '').replace(/\D/g, '').slice(0, 19);
    this.cardForm.numero = number.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  getCardLabel(method: any): string {
    return `${method.marca || 'Tarjeta'} terminada en ${method.ultimos4}`;
  }

  formatCurrency(value: number | string | undefined): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  getAddressLabel(address: CheckoutAddress): string {
    return [
      address.alias,
      address.calle,
      address.numero,
      address.colonia,
      address.ciudad,
    ]
      .filter(Boolean)
      .join(', ');
  }

  getVariantInfo(item: any): string {
    const atributos = item.atributos || {};
    const values = [atributos.Talla, atributos.Color].filter(Boolean);
    return values.join(' · ');
  }

  private syncSelections(summary: CheckoutSummaryResponse, keepAddressMode: boolean): void {
    if (!this.selectedShippingMethodId() && summary.selectedShippingMethod?.id_metodo_envio) {
      this.selectedShippingMethodId.set(summary.selectedShippingMethod.id_metodo_envio);
    }

    if (!keepAddressMode && summary.addresses.length > 0) {
      this.addressMode.set('existing');
      this.selectedAddressId.set(Number(summary.addresses[0].id_direccion));
    }

    if (!this.paymentSelectionInitialized && summary.paymentMethods.length > 0) {
      this.paymentMode.set('saved');
      this.selectedPaymentMethodId.set(Number(summary.paymentMethods[0].id_metodo_pago));
    }

    this.paymentSelectionInitialized = true;
  }

  private buildCheckoutPayload(): ConfirmCheckoutRequest | null {
    const selectedMethod = this.selectedShippingMethodId();
    const payload: ConfirmCheckoutRequest = {
      id_metodo_envio: selectedMethod,
      metodo_pago: 'tarjeta',
      codigo_promocion: this.appliedCouponCode() || undefined,
    };

    if (this.addressMode() === 'existing') {
      const idAddress = this.selectedAddressId();

      if (!idAddress) {
        this.toastr.warning('Selecciona una dirección de envío', 'Checkout');
        return null;
      }

      payload.id_direccion_envio = idAddress;
    } else {
      if (!this.isNewAddressValid()) {
        this.toastr.warning('Completa la dirección de envío', 'Checkout');
        return null;
      }

      payload.direccion = {
        alias: this.addressForm.alias?.trim() || 'Principal',
        calle: this.addressForm.calle.trim(),
        numero: this.addressForm.numero?.trim() || undefined,
        colonia: this.addressForm.colonia?.trim() || undefined,
        ciudad: this.addressForm.ciudad.trim(),
        estado: this.addressForm.estado.trim(),
        codigo_postal: this.addressForm.codigo_postal.trim(),
        pais: this.addressForm.pais?.trim() || 'México',
        principal: this.addressForm.principal === true,
      };
    }

    if (this.paymentMode() === 'saved') {
      const idPaymentMethod = this.selectedPaymentMethodId();

      if (!idPaymentMethod) {
        this.toastr.warning('Selecciona una tarjeta', 'Checkout');
        return null;
      }

      payload.id_metodo_pago_usuario = idPaymentMethod;
      return payload;
    }

    if (!this.isCardValid()) {
      this.toastr.warning('Completa una tarjeta válida', 'Checkout');
      return null;
    }

    payload.guardar_tarjeta = this.saveCard();
    payload.tarjeta = {
      alias: this.cardForm.alias?.trim() || `${this.cardBrand()} ${this.getCardLast4()}`,
      titular: this.cardForm.titular.trim(),
      numero: this.normalizeCardNumber(this.cardForm.numero),
      exp_mes: Number(this.cardForm.exp_mes),
      exp_anio: Number(this.cardForm.exp_anio),
      cvv: String(this.cardForm.cvv || '').trim(),
      principal: this.cardForm.principal !== false,
    };

    return payload;
  }

  private isNewAddressValid(): boolean {
    return !!(
      this.addressForm.calle?.trim() &&
      this.addressForm.ciudad?.trim() &&
      this.addressForm.estado?.trim() &&
      this.addressForm.codigo_postal?.trim()
    );
  }

  private isCardValid(): boolean {
    const number = this.normalizeCardNumber(this.cardForm.numero);
    const cvv = String(this.cardForm.cvv || '').trim();

    return !!(
      this.cardForm.titular?.trim() &&
      /^\d{13,19}$/.test(number) &&
      this.isValidLuhn(number) &&
      /^\d{3,4}$/.test(cvv) &&
      this.isExpiryValid(Number(this.cardForm.exp_mes), Number(this.cardForm.exp_anio))
    );
  }

  private normalizeCardNumber(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private getCardLast4(): string {
    return this.normalizeCardNumber(this.cardForm.numero).slice(-4);
  }

  private isExpiryValid(month: number, year: number): boolean {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return false;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return year > currentYear || (year === currentYear && month >= currentMonth);
  }

  private isValidLuhn(number: string): boolean {
    let sum = 0;
    let shouldDouble = false;

    for (let index = number.length - 1; index >= 0; index--) {
      let digit = Number(number[index]);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum > 0 && sum % 10 === 0;
  }

  private detectCardBrand(value: string): string {
    const number = this.normalizeCardNumber(value);

    if (/^4/.test(number)) {
      return 'Visa';
    }

    if (/^(5[1-5]|2[2-7])/.test(number)) {
      return 'Mastercard';
    }

    if (/^3[47]/.test(number)) {
      return 'American Express';
    }

    return 'Tarjeta';
  }

  private getBackendMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return message || error?.error?.error || fallback;
  }
}
