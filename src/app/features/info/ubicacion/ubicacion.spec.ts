import { MapStylesService } from '../../../core/services/map-styles.service';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideLucideIcons } from '@lucide/angular';
import type * as maplibregl from 'maplibre-gl';
import { Subject } from 'rxjs';
import { CompanyInfo, CompanyService } from '../../../core/services/company.service';
import { GeolocationService, getGeolocationErrorMessage } from '../../../core/services/geolocation.service';
import { SPORT_CENTER_ICONS } from '../../../shared/icons/sport-center-icons';
import { LOCATION_MAP_API, Ubicacion } from './ubicacion';

describe('Ubicacion: geolocalización voluntaria', () => {
  let fixture: ComponentFixture<Ubicacion>;
  let component: Ubicacion;
  let company: Subject<CompanyInfo>;
  let geolocation: jasmine.SpyObj<GeolocationService>;
  let map: jasmine.SpyObj<maplibregl.Map> & { dragRotate: { disable: jasmine.Spy } };
  let markers: jasmine.SpyObj<maplibregl.Marker>[];
  let popups: jasmine.SpyObj<maplibregl.Popup>[];
  let mapConstructor: jasmine.Spy;
  let styles: jasmine.SpyObj<MapStylesService>;
  let callbacks: Record<string, () => void>;

  function position(latitude = 21.16, longitude = -98.39): GeolocationPosition {
    return { coords: { latitude, longitude, accuracy: 25 }, timestamp: Date.now() } as GeolocationPosition;
  }

  async function loadCompany(lat = 21.155931, lng = -98.381103): Promise<void> {
    company.next({
      nombre: 'Sport Center',
      mapa_ubicacion: JSON.stringify({ lat, lng, address: 'Dirección del local', label: 'Sport Center' }),
    });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    company = new Subject<CompanyInfo>();
    styles = jasmine.createSpyObj<MapStylesService>('MapStylesService', ['ensureLoaded']);
    styles.ensureLoaded.and.returnValue(Promise.resolve());
    geolocation = jasmine.createSpyObj<GeolocationService>('GeolocationService', ['getCurrentPosition']);
    geolocation.getCurrentPosition.and.returnValue(Promise.resolve(position()));
    callbacks = {};
    markers = [];
    popups = [];
    map = Object.assign(jasmine.createSpyObj<maplibregl.Map>('Map', [
      'addControl', 'on', 'once', 'resize', 'jumpTo', 'fitBounds', 'remove',
    ]), { dragRotate: { disable: jasmine.createSpy('disable') } });
    map.on.and.callFake(((event: string, callback: () => void) => {
      callbacks[event] = callback;
      return map;
    }) as unknown as typeof map.on);
    map.once.and.callFake(((event: string, callback: () => void) => {
      callbacks[event] = callback;
      return map;
    }) as unknown as typeof map.once);
    mapConstructor = jasmine.createSpy('Map constructor').and.returnValue(map);
    const api = {
      Map: mapConstructor,
      NavigationControl: jasmine.createSpy('NavigationControl'),
      Marker: jasmine.createSpy('Marker').and.callFake(function () {
        const marker = jasmine.createSpyObj<maplibregl.Marker>('Marker', [
          'setLngLat', 'setPopup', 'addTo', 'togglePopup', 'remove',
        ]);
        marker.setLngLat.and.returnValue(marker);
        marker.setPopup.and.returnValue(marker);
        marker.addTo.and.returnValue(marker);
        markers.push(marker);
        return marker;
      }),
      Popup: jasmine.createSpy('Popup').and.callFake(function () {
        const popup = jasmine.createSpyObj<maplibregl.Popup>('Popup', ['setDOMContent', 'setText']);
        popup.setDOMContent.and.returnValue(popup);
        popup.setText.and.returnValue(popup);
        popups.push(popup);
        return popup;
      }),
      LngLatBounds: jasmine.createSpy('LngLatBounds').and.callFake(function () {
        const bounds = { extend: jasmine.createSpy('extend') };
        bounds.extend.and.returnValue(bounds);
        return bounds;
      }),
    } as unknown as typeof maplibregl;

    await TestBed.configureTestingModule({
      imports: [Ubicacion],
      providers: [
        provideLucideIcons(...SPORT_CENTER_ICONS),
        { provide: CompanyService, useValue: { getCompanyInfo: () => company.asObservable() } },
        { provide: GeolocationService, useValue: geolocation },
        { provide: LOCATION_MAP_API, useValue: api },
        { provide: MapStylesService, useValue: styles },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Ubicacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('conserva el marcador del local y no solicita posición al abrir', async () => {
    await loadCompany();
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    expect(markers.length).toBe(1);
    expect(markers[0].setLngLat).toHaveBeenCalledWith([-98.381103, 21.155931]);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(component.directionsUrl).toBeNull();
  });

  it('solicita por clic, evita solicitudes duplicadas y muestra ambos puntos sin mover el local', async () => {
    await loadCompany();
    let resolvePosition!: (value: GeolocationPosition) => void;
    geolocation.getCurrentPosition.and.returnValue(new Promise(resolve => resolvePosition = resolve));
    const button = fixture.nativeElement.querySelector('.location-button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(component.locationMessage).toContain('Buscando');
    await component.useMyLocation();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

    resolvePosition(position());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
    expect(markers.length).toBe(2);
    expect(markers[1].setLngLat).toHaveBeenCalledWith([-98.39, 21.16]);
    expect(markers[0].setLngLat).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalled();
    expect(popups[1].setText).toHaveBeenCalledWith('Tu ubicación aproximada');
    const url = new URL(component.directionsUrl!);
    expect(url.searchParams.get('origin')).toBe('21.16,-98.39');
    expect(url.searchParams.get('destination')).toBe('21.155931,-98.381103');
    expect(fixture.nativeElement.textContent).toContain('línea recta');
  });

  it('conserva la posición si llega antes de CompanyInfo y la dibuja al crear el mapa', async () => {
    await component.useMyLocation();
    expect(markers.length).toBe(0);
    expect(component.distanceKm).toBeNull();
    expect(component.directionsUrl).toBeNull();
    await loadCompany();
    expect(markers.length).toBe(2);
    expect(component.distanceKm).not.toBeNull();
    callbacks['load']();
    expect(map.fitBounds).toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  for (const [code, description] of [[1, 'permiso denegado'], [2, 'posición no disponible'], [3, 'tiempo agotado']] as const) {
    it(`muestra el mensaje de ${description} y conserva el mapa del negocio`, async () => {
      await loadCompany();
      const error = { code };
      geolocation.getCurrentPosition.and.returnValue(Promise.reject(error));
      await component.useMyLocation();
      fixture.detectChanges();
      expect(component.locationError).toBeTrue();
      expect(component.locationMessage).toBe(getGeolocationErrorMessage(error));
      expect(component.locating).toBeFalse();
      expect(markers.length).toBe(1);
      expect(markers[0].remove).not.toHaveBeenCalled();
      expect(map.remove).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.location-status').textContent).toContain(component.locationMessage);
    });
  }

  it('actualiza el marcador del usuario al repetir la solicitud sin duplicarlo', async () => {
    await loadCompany();
    await component.useMyLocation();
    geolocation.getCurrentPosition.and.returnValue(Promise.resolve(position(21.17, -98.4)));
    await component.useMyLocation();
    expect(markers.length).toBe(2);
    expect(markers[1].setLngLat).toHaveBeenCalledWith([-98.4, 21.17]);
    expect(markers[0].setLngLat).toHaveBeenCalledTimes(1);
  });

  it('calcula distancia en línea recta y admite coordenadas cero válidas del local', async () => {
    await loadCompany(0, 0);
    geolocation.getCurrentPosition.and.returnValue(Promise.resolve(position(1, 0)));
    await component.useMyLocation();
    expect(component.distanceKm!).toBeCloseTo(111.195, 2);
  });

  it('no ofrece distancia ni indicaciones a un destino sin configuración válida', async () => {
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":999,"lng":0}' });
    await component.useMyLocation();
    fixture.detectChanges();
    expect(component.storeLocationConfigured).toBeFalse();
    expect(component.distanceKm).toBeNull();
    expect(component.directionsUrl).toBeNull();
    expect(fixture.nativeElement.querySelector('.directions-link')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ubicación válida del local');
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('permite obtener posición si falla CompanyInfo sin inventar distancia al negocio', async () => {
    company.error(new Error('CompanyInfo unavailable'));
    await component.useMyLocation();
    expect(markers.length).toBe(2);
    expect(component.locationError).toBeFalse();
    expect(component.directionsUrl).toBeNull();
    expect(component.distanceKm).toBeNull();
  });

  it('rechaza posiciones inválidas antes de crear el marcador del usuario', async () => {
    await loadCompany();
    geolocation.getCurrentPosition.and.returnValue(Promise.resolve(position(NaN, -98)));
    await component.useMyLocation();
    expect(component.locationError).toBeTrue();
    expect(component.userLocation).toBeNull();
    expect(markers.length).toBe(1);
  });

  it('ignora una geolocalización que termina después de abandonar la página', async () => {
    await loadCompany();
    let resolvePosition!: (value: GeolocationPosition) => void;
    geolocation.getCurrentPosition.and.returnValue(new Promise(resolve => resolvePosition = resolve));
    const pending = component.useMyLocation();
    fixture.destroy();
    resolvePosition(position());
    await pending;
    expect(component.userLocation).toBeNull();
    expect(markers.length).toBe(1);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('cancela CompanyInfo al salir antes de recibir la respuesta', async () => {
    fixture.destroy();
    company.next({ nombre: 'Respuesta tardía', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(component.companyInfo).toBeNull();
  });

  it('limpia los marcadores y no ejecuta callbacks ni timers de un mapa destruido', fakeAsync(() => {
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    flushMicrotasks();
    fixture.destroy();
    callbacks['load']();
    callbacks['idle']();
    tick(150);
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(markers[0].remove).toHaveBeenCalledTimes(1);
    expect(markers[0].togglePopup).not.toHaveBeenCalled();
    expect(map.resize).not.toHaveBeenCalled();
    expect(map.jumpTo).not.toHaveBeenCalled();
  }));

  it('inserta los datos del negocio como texto, sin ejecutar HTML en el popup', async () => {
    company.next({ nombre: '<img src=x onerror=alert(1)>', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    await fixture.whenStable();
    const content = popups[0].setDOMContent.calls.mostRecent().args[0] as HTMLElement;
    expect(content.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(content.querySelector('img')).toBeNull();
  });

  it('mantiene el botón y las indicaciones disponibles si el navegador no puede crear el mapa', async () => {
    mapConstructor.and.throwError('WebGL unavailable');
    await loadCompany();
    await component.useMyLocation();
    expect(component.mapUnavailable).toBeTrue();
    expect(component.userLocation).not.toBeNull();
    expect(component.directionsUrl).not.toBeNull();
    expect(component.locationError).toBeFalse();
  });

  it('espera el CSS una sola vez antes de construir el mapa con la última ubicación recibida', async () => {
    let resolveStyles!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(resolve => resolveStyles = resolve));
    expect(styles.ensureLoaded).not.toHaveBeenCalled();
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":22,"lng":-97}' });
    expect(styles.ensureLoaded).toHaveBeenCalledTimes(1);
    expect(mapConstructor).not.toHaveBeenCalled();
    resolveStyles();
    await fixture.whenStable();
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    expect(markers[0].setLngLat).toHaveBeenCalledWith([-97, 22]);
  });

  it('conserva las indicaciones y el mensaje de mapa no disponible si falla el CSS', async () => {
    styles.ensureLoaded.and.returnValue(Promise.reject(new Error('CSS unavailable')));
    await loadCompany();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(component.mapUnavailable).toBeTrue();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('El mapa no pudo cargarse');
  });

  it('no crea mapa ni marcadores cuando el CSS termina después de destruir la vista', async () => {
    let resolveStyles!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(resolve => resolveStyles = resolve));
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    fixture.destroy();
    resolveStyles();
    await Promise.resolve();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(markers).toEqual([]);
  });

  it('ignora también un error tardío del CSS después de destruir la vista', async () => {
    let rejectStyles!: (reason: Error) => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>((_resolve, reject) => rejectStyles = reject));
    company.next({ nombre: 'Sport Center', mapa_ubicacion: '{"lat":21,"lng":-98}' });
    fixture.destroy();
    rejectStyles(new Error('Late CSS failure'));
    await Promise.resolve();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(component.mapUnavailable).toBeFalse();
  });

  it('reintenta el CSS desde la misma pantalla sin duplicar solicitudes ni perder ubicaciones', async () => {
    styles.ensureLoaded.and.callFake(() => Promise.reject(new Error('CSS unavailable')));
    await loadCompany();
    await component.useMyLocation();
    fixture.detectChanges();
    const previous = component.userLocation;
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Reintentar mapa'))!;
    expect(retry).toBeDefined();
    let resolveStyles!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(resolve => resolveStyles = resolve));
    retry.click();
    component.retryMap();
    fixture.detectChanges();
    expect(styles.ensureLoaded).toHaveBeenCalledTimes(2);
    expect(retry.disabled).toBeTrue();
    expect(retry.textContent).toContain('Cargando mapa');
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    resolveStyles();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.mapUnavailable).toBeFalse();
    expect(component.userLocation).toBe(previous);
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    expect(markers.length).toBe(2);
    expect(markers[0].setLngLat).toHaveBeenCalledWith([-98.381103, 21.155931]);
    expect(markers[1].setLngLat).toHaveBeenCalledWith([-98.39, 21.16]);
    expect(fixture.nativeElement.textContent).not.toContain('Reintentar mapa');
  });
});
