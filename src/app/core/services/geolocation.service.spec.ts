import { TestBed } from '@angular/core/testing';
import { GEOLOCATION_WINDOW, GeolocationService, getGeolocationErrorMessage } from './geolocation.service';

describe('GeolocationService', () => {
  let service: GeolocationService;
  let position: jasmine.Spy;
  let browser: { isSecureContext: boolean; navigator: { geolocation?: { getCurrentPosition: jasmine.Spy } }; document: object };

  beforeEach(() => {
    position = jasmine.createSpy('getCurrentPosition');
    browser = { isSecureContext: true, navigator: { geolocation: { getCurrentPosition: position } }, document: {} };
    TestBed.configureTestingModule({ providers: [{ provide: GEOLOCATION_WINDOW, useValue: browser }] });
    service = TestBed.inject(GeolocationService);
  });

  it('no solicita ubicación hasta que la página invoca la acción', () => {
    expect(position).not.toHaveBeenCalled();
  });

  it('devuelve una posición y conserva precisión, espera y antigüedad del checkout', async () => {
    const result = { coords: { latitude: 21, longitude: -98, accuracy: 20 } } as GeolocationPosition;
    position.and.callFake((success: PositionCallback) => success(result));
    expect(await service.getCurrentPosition()).toBe(result);
    expect(position.calls.mostRecent().args[2]).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  it('explica que se requiere HTTPS sin llamar al dispositivo en un contexto inseguro', async () => {
    browser.isSecureContext = false;
    try { await service.getCurrentPosition(); fail('Debe rechazar'); }
    catch (error) { expect(getGeolocationErrorMessage(error)).toContain('HTTPS'); }
    expect(position).not.toHaveBeenCalled();
  });

  it('explica cuando el navegador no ofrece geolocalización', async () => {
    delete browser.navigator.geolocation;
    try { await service.getCurrentPosition(); fail('Debe rechazar'); }
    catch (error) { expect(getGeolocationErrorMessage(error)).toContain('no permite consultar'); }
  });

  for (const property of ['permissionsPolicy', 'featurePolicy']) {
    it(`detecta un bloqueo del sitio mediante ${property}`, async () => {
      const allowsFeature = jasmine.createSpy('allowsFeature').and.returnValue(false);
      browser.document = { [property]: { allowsFeature } };
      try { await service.getCurrentPosition(); fail('Debe rechazar'); }
      catch (error) { expect(getGeolocationErrorMessage(error)).toContain('configuración de este sitio'); }
      expect(allowsFeature).toHaveBeenCalledWith('geolocation');
      expect(position).not.toHaveBeenCalled();
    });
  }

  it('propaga el motivo real del navegador en lugar de convertirlo siempre en un permiso denegado', async () => {
    const failure = { code: 3, message: 'Timeout expired' } as GeolocationPositionError;
    position.and.callFake((_success: PositionCallback, reject: PositionErrorCallback) => reject(failure));
    await expectAsync(service.getCurrentPosition()).toBeRejectedWith(failure);
    expect(getGeolocationErrorMessage(failure)).toContain('tardó demasiado');
  });

  it('distingue permiso denegado, posición no disponible y tiempo agotado', () => {
    expect(getGeolocationErrorMessage({ code: 1 })).toContain('ajustes del sitio');
    expect(getGeolocationErrorMessage({ code: 2 })).toContain('no pudo determinar');
    expect(getGeolocationErrorMessage({ code: 3 })).toContain('tardó demasiado');
    expect(getGeolocationErrorMessage(new Error('Detalles internos'))).toBe('No fue posible obtener tu ubicación. Inténtalo de nuevo.');
  });
});
