import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { Checkout } from './checkout';

describe('Checkout: geolocalización', () => {
  let checkout: Checkout;
  let geolocation: jasmine.SpyObj<GeolocationService>;
  let toastr: jasmine.SpyObj<ToastrService>;
  let fetchAddress: jasmine.Spy;
  const position = { coords: { latitude: 21.15, longitude: -98.38, accuracy: 20 } } as GeolocationPosition;
  const address = { features: [{ address: '10', text: 'Calle Deportiva', context: [
    { id: 'place.1', text: 'Huejutla' }, { id: 'region.1', text: 'Hidalgo' },
    { id: 'neighborhood.1', text: 'Centro' }, { id: 'postcode.1', text: '43000' },
  ] }] };

  beforeEach(() => {
    geolocation = jasmine.createSpyObj('GeolocationService', ['getCurrentPosition']);
    geolocation.getCurrentPosition.and.resolveTo(position);
    toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error']);
    fetchAddress = spyOn(window, 'fetch').and.resolveTo({ ok: true, json: async () => address } as Response);
    TestBed.configureTestingModule({ providers: [
      { provide: GeolocationService, useValue: geolocation },
      { provide: ToastrService, useValue: toastr },
      { provide: Router, useValue: {} },
      { provide: CartService, useValue: {} },
      { provide: ProductService, useValue: { lookupPostalCode: () => of({
        codigo_postal: '43000', estado: 'Hidalgo', ciudad: 'Huejutla', colonias: [{ nombre: 'Centro' }],
      }) } },
    ] });
    checkout = TestBed.runInInjectionContext(() => new Checkout());
  });

  it('no solicita permisos ni consulta una dirección al abrir el checkout', () => {
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchAddress).not.toHaveBeenCalled();
  });

  it('conserva el autocompletado de envío y los ajustes de pago/cupón existentes', async () => {
    checkout.addressMode.set('existing');
    checkout.paymentMode.set('saved');
    checkout.couponCode.set('DEPORTE');
    await checkout.useCurrentLocation();
    expect(checkout.addressForm.calle).toBe('10 Calle Deportiva');
    expect(checkout.addressForm.ciudad).toBe('Huejutla');
    expect(checkout.addressForm.estado).toBe('Hidalgo');
    expect(checkout.addressForm.codigo_postal).toBe('43000');
    expect(checkout.addressMode()).toBe('new');
    expect(checkout.paymentMode()).toBe('saved');
    expect(checkout.couponCode()).toBe('DEPORTE');
    expect(checkout.isLocating()).toBeFalse();
    expect(toastr.success).toHaveBeenCalledWith('Ubicación cargada. Revisa calle y número antes de pagar.', 'Dirección');
  });

  for (const [code, expected] of [[1, 'ajustes del sitio'], [2, 'no pudo determinar'], [3, 'tardó demasiado']] as const) {
    it(`muestra el mensaje adecuado para error de ubicación ${code} y conserva la dirección`, async () => {
      checkout.addressForm.calle = 'Dirección escrita';
      geolocation.getCurrentPosition.and.rejectWith({ code });
      await checkout.useCurrentLocation();
      expect(toastr.warning.calls.mostRecent().args[0]).toContain(expected);
      expect(checkout.addressForm.calle).toBe('Dirección escrita');
      expect(checkout.isLocating()).toBeFalse();
      expect(fetchAddress).not.toHaveBeenCalled();
    });
  }

  it('distingue un fallo de MapTiler de un permiso denegado y deja editar la dirección', async () => {
    checkout.addressForm.calle = 'Mi dirección';
    fetchAddress.and.rejectWith(new TypeError('Network error'));
    await checkout.useCurrentLocation();
    expect(toastr.warning).not.toHaveBeenCalled();
    expect(toastr.error.calls.mostRecent().args[0]).toContain('Tu ubicación se obtuvo');
    expect(checkout.addressForm.calle).toBe('Mi dirección');
    expect(checkout.isLocating()).toBeFalse();
  });

  it('no anuncia éxito si el servicio no encuentra una dirección', async () => {
    fetchAddress.and.resolveTo({ ok: true, json: async () => ({ features: [] }) } as unknown as Response);
    await checkout.useCurrentLocation();
    expect(toastr.error).toHaveBeenCalled();
    expect(toastr.success).not.toHaveBeenCalled();
  });

  it('evita duplicar una consulta mientras el usuario espera el permiso', async () => {
    let resolve!: (value: GeolocationPosition) => void;
    geolocation.getCurrentPosition.and.returnValue(new Promise(value => { resolve = value; }));
    const pending = checkout.useCurrentLocation();
    await checkout.useCurrentLocation();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    resolve(position);
    await pending;
    expect(fetchAddress).toHaveBeenCalledTimes(1);
  });

  it('ignora una respuesta de ubicación que llega después de salir de la pantalla', async () => {
    let resolve!: (value: GeolocationPosition) => void;
    geolocation.getCurrentPosition.and.returnValue(new Promise(value => { resolve = value; }));
    const pending = checkout.useCurrentLocation();
    TestBed.resetTestingModule();
    resolve(position);
    await pending;
    expect(fetchAddress).not.toHaveBeenCalled();
    expect(toastr.success).not.toHaveBeenCalled();
  });

  it('cancela la consulta de dirección al salir e ignora el aborto sin mostrar un error', async () => {
    let lookupSignal!: AbortSignal;
    fetchAddress.and.callFake((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      lookupSignal = options.signal!;
      lookupSignal.addEventListener('abort', () => reject(new DOMException('Abortado', 'AbortError')));
    }));
    const pending = checkout.useCurrentLocation();
    await Promise.resolve();
    expect(lookupSignal).toBeDefined();
    TestBed.resetTestingModule();
    await pending;
    expect(lookupSignal.aborted).toBeTrue();
    expect(toastr.error).not.toHaveBeenCalled();
    expect(toastr.success).not.toHaveBeenCalled();
  });
});
