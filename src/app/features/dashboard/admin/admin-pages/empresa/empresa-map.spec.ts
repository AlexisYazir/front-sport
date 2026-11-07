import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import * as maplibregl from 'maplibre-gl';
import { ToastrService } from 'ngx-toastr';
import { componentTestProviders, flushComponentReads } from '../../../../../../../tests/shared-testing/component-test-bed';
import { MapStylesService } from '../../../../../core/services/map-styles.service';
import { COMPANY_MAP_API, Empresa } from './empresa';

describe('Empresa: mapa diferido del modal', () => {
  let fixture: ComponentFixture<Empresa>;
  let component: Empresa;
  let styles: jasmine.SpyObj<MapStylesService>;
  let toastr: jasmine.SpyObj<ToastrService>;
  let map: jasmine.SpyObj<maplibregl.Map> & { dragRotate: { disable: jasmine.Spy } };
  let marker: jasmine.SpyObj<maplibregl.Marker>;
  let mapConstructor: jasmine.Spy;
  let callbacks: Record<string, (event?: unknown) => void>;

  beforeEach(async () => {
    styles = jasmine.createSpyObj<MapStylesService>('MapStylesService', ['ensureLoaded']);
    styles.ensureLoaded.and.returnValue(Promise.resolve());
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['error', 'info', 'success']);
    callbacks = {};
    map = Object.assign(jasmine.createSpyObj<maplibregl.Map>('Map', [
      'addControl', 'on', 'once', 'resize', 'jumpTo', 'easeTo', 'remove', 'getZoom',
    ]), { dragRotate: { disable: jasmine.createSpy('disable') } });
    map.getZoom.and.returnValue(16);
    const register = ((event: string, callback: (value?: unknown) => void) => {
      callbacks[event] = callback;
      return map;
    }) as unknown as typeof map.on;
    map.on.and.callFake(register);
    map.once.and.callFake(register as unknown as typeof map.once);
    const popup = jasmine.createSpyObj<maplibregl.Popup>('Popup', ['setHTML', 'isOpen']);
    popup.setHTML.and.returnValue(popup);
    popup.isOpen.and.returnValue(false);
    marker = jasmine.createSpyObj<maplibregl.Marker>('Marker', [
      'setLngLat', 'setPopup', 'addTo', 'on', 'getLngLat', 'getPopup', 'togglePopup', 'remove',
    ]);
    marker.setLngLat.and.returnValue(marker);
    marker.setPopup.and.returnValue(marker);
    marker.addTo.and.returnValue(marker);
    marker.getPopup.and.returnValue(popup);
    marker.getLngLat.and.returnValue(new maplibregl.LngLat(-98.5, 21.5));
    mapConstructor = jasmine.createSpy('Map constructor').and.returnValue(map);
    const api = {
      Map: mapConstructor,
      NavigationControl: jasmine.createSpy('NavigationControl'),
      Marker: jasmine.createSpy('Marker').and.returnValue(marker),
      Popup: jasmine.createSpy('Popup').and.returnValue(popup),
    } as unknown as typeof maplibregl;
    await TestBed.configureTestingModule({
      imports: [Empresa],
      providers: [
        ...componentTestProviders(),
        { provide: MapStylesService, useValue: styles },
        { provide: COMPANY_MAP_API, useValue: api },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Empresa);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.inject(HttpTestingController).verify();
  });

  function open(): void {
    component.openModal('ubicacion');
    fixture.detectChanges();
    tick(0);
  }

  it('no solicita CSS ni mapa al abrir el perfil o un modal sin mapa', () => {
    component.openModal('contacto');
    expect(styles.ensureLoaded).not.toHaveBeenCalled();
    expect(mapConstructor).not.toHaveBeenCalled();
  });

  it('espera el CSS antes de crear mapa, controles y marcador', fakeAsync(() => {
    let resolve!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(done => resolve = done));
    open();
    expect(styles.ensureLoaded).toHaveBeenCalledTimes(1);
    expect(mapConstructor).not.toHaveBeenCalled();
    resolve(); flushMicrotasks();
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    expect(map.addControl).toHaveBeenCalled();
    expect(map.dragRotate.disable).toHaveBeenCalled();
    callbacks['load']();
    expect(marker.setLngLat).toHaveBeenCalledWith([-98.381103, 21.155931]);
    fixture.destroy(); tick(150);
  }));

  it('descarta la apertura anterior al cerrar y reabrir durante la espera del CSS', fakeAsync(() => {
    let resolve!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(done => resolve = done));
    open();
    component.closeModal();
    open();
    resolve(); flushMicrotasks();
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    fixture.destroy(); tick(150);
  }));

  it('permite reabrir y reintentar después de un error sin crear un mapa incompleto', fakeAsync(() => {
    styles.ensureLoaded.and.callFake(() => Promise.reject(new Error('CSS unavailable')));
    open(); flushMicrotasks();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(toastr.error).toHaveBeenCalledTimes(1);
    component.closeModal();
    styles.ensureLoaded.and.returnValue(Promise.resolve());
    open(); flushMicrotasks();
    expect(mapConstructor).toHaveBeenCalledTimes(1);
    fixture.destroy(); tick(150);
  }));

  it('no crea mapa ni muestra errores después de destruir la vista con CSS pendiente', fakeAsync(() => {
    let resolve!: () => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>(done => resolve = done));
    open();
    fixture.destroy();
    resolve(); flushMicrotasks();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(toastr.error).not.toHaveBeenCalled();
  }));

  it('ignora el rechazo tardío del CSS cuando la vista ya no existe', fakeAsync(() => {
    let reject!: (reason: Error) => void;
    styles.ensureLoaded.and.returnValue(new Promise<void>((_resolve, fail) => reject = fail));
    open();
    fixture.destroy();
    reject(new Error('Late CSS failure')); flushMicrotasks();
    expect(mapConstructor).not.toHaveBeenCalled();
    expect(toastr.error).not.toHaveBeenCalled();
  }));

  it('conserva edición por mapa y limpieza; ignora eventos y repintados de la instancia destruida', fakeAsync(() => {
    open(); flushMicrotasks();
    callbacks['click']({ lngLat: { lat: 21.5, lng: -98.5 } });
    callbacks['zoomend']();
    expect(component.ubicacionForm).toEqual(jasmine.objectContaining({ lat: 21.5, lng: -98.5, zoom: 16 }));
    const before = { ...component.ubicacionForm };
    map.resize.calls.reset();
    fixture.destroy();
    callbacks['click']({ lngLat: { lat: 0, lng: 0 } });
    callbacks['zoomend'](); callbacks['load']();
    tick(150);
    expect(component.ubicacionForm).toEqual(before);
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(map.resize).not.toHaveBeenCalled();
  }));
});
