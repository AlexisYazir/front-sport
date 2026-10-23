import { TestBed } from '@angular/core/testing';
import { PwaStorageService } from './pwa-storage.service';

describe('PwaStorageService', () => {
  const MiB = 1024 * 1024;
  let service: PwaStorageService;
  let storage: Partial<StorageManager>;
  let storageGetter: jasmine.Spy;
  let persisted: jasmine.Spy;
  let persist: jasmine.Spy;
  let estimate: jasmine.Spy;

  beforeEach(() => {
    persisted = jasmine.createSpy('persisted').and.resolveTo(false);
    persist = jasmine.createSpy('persist').and.resolveTo(false);
    estimate = jasmine.createSpy('estimate').and.resolveTo({ quota: 128 * MiB, usage: 32 * MiB });
    storage = { persisted, persist, estimate };
    storageGetter = spyOnProperty(navigator, 'storage', 'get').and.callFake(() => storage as StorageManager);
    TestBed.configureTestingModule({});
    service = TestBed.inject(PwaStorageService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('funciona sin la API de almacenamiento', async () => {
    storageGetter.and.returnValue(undefined);
    expect(await service.requestPersistence()).toBeFalse();
    expect(await service.hasCapacity(10 * MiB)).toBeTrue();
    expect(persist).not.toHaveBeenCalled();
  });

  it('acepta persistencia ya concedida sin volver a solicitarla', async () => {
    persisted.and.resolveTo(true);
    expect(await service.requestPersistence()).toBeTrue();
    expect(persist).not.toHaveBeenCalled();
  });

  it('solicita persistencia y conserva una concesión nueva', async () => {
    persist.and.resolveTo(true);
    expect(await service.requestPersistence()).toBeTrue();
    expect(await service.requestPersistence()).toBeTrue();
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('coalesce solicitudes simultáneas y conserva también una denegación', async () => {
    let finish!: (value: boolean) => void;
    persisted.and.returnValue(new Promise<boolean>(resolve => finish = resolve));
    const first = service.requestPersistence();
    expect(service.requestPersistence()).toBe(first);
    finish(false);
    expect(await first).toBeFalse();
    expect(service.requestPersistence()).toBe(first);
    expect(await service.requestPersistence()).toBeFalse();
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('admite navegadores que solo implementan persist', async () => {
    storage.persisted = undefined;
    persist.and.resolveTo(true);
    expect(await service.requestPersistence()).toBeTrue();
  });

  it('tolera métodos de persistencia ausentes o rechazados', async () => {
    storage.persist = undefined;
    expect(await service.requestPersistence()).toBeFalse();
  });

  it('captura el rechazo al consultar persistencia', async () => {
    persisted.and.rejectWith(new Error('Consulta bloqueada'));
    expect(await service.requestPersistence()).toBeFalse();
    expect(persist).not.toHaveBeenCalled();
  });

  it('captura el rechazo al solicitar persistencia', async () => {
    persist.and.rejectWith(new Error('Solicitud bloqueada'));
    expect(await service.requestPersistence()).toBeFalse();
  });

  it('inicia sin bloquear y reintenta una sola vez tras el primer gesto', async () => {
    expect(service.start()).toBeUndefined();
    service.start();
    expect(await service.requestPersistence()).toBeFalse();
    persist.and.resolveTo(true);
    window.dispatchEvent(new Event('pointerdown'));
    expect(await service.requestPersistence()).toBeTrue();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('el teclado también permite el único reintento aunque vuelva a denegarse', async () => {
    service.start();
    await service.requestPersistence();
    window.dispatchEvent(new Event('keydown'));
    expect(await service.requestPersistence()).toBeFalse();
    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('no reintenta tras gestos si la persistencia inicial ya fue concedida', async () => {
    persist.and.resolveTo(true);
    service.start();
    await service.requestPersistence();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('retira los listeners cuando se destruye el servicio', async () => {
    service.start();
    await service.requestPersistence();
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('no instala listeners si el intento pendiente termina después de destruirse', async () => {
    let finish!: (value: boolean) => void;
    persisted.and.returnValue(new Promise<boolean>(resolve => finish = resolve));
    service.start();
    const attempt = service.requestPersistence();
    TestBed.resetTestingModule();
    finish(false);
    await attempt;
    window.dispatchEvent(new Event('pointerdown'));
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reserva 8 MiB además del tamaño de la siguiente descarga', async () => {
    estimate.and.resolveTo({ quota: 32 * MiB, usage: 20 * MiB });
    expect(await service.hasCapacity(4 * MiB)).toBeTrue();
    expect(await service.hasCapacity(4 * MiB + 1)).toBeFalse();
    estimate.and.resolveTo({ quota: 32 * MiB, usage: 25 * MiB });
    expect(await service.hasCapacity(0)).toBeFalse();
  });

  it('permite continuar cuando la estimación no está disponible o falla', async () => {
    storage.estimate = undefined;
    expect(await service.hasCapacity(10 * MiB)).toBeTrue();
    storage.estimate = estimate;
    estimate.and.rejectWith(new Error('Estimación bloqueada'));
    expect(await service.hasCapacity(10 * MiB)).toBeTrue();
  });

  it('trata estimaciones incompletas o no numéricas como desconocidas', async () => {
    for (const value of [{}, { quota: 128 * MiB }, { usage: 32 * MiB },
      { quota: NaN, usage: 1 }, { quota: 128 * MiB, usage: Infinity },
      { quota: -1, usage: 0 }]) {
      estimate.and.resolveTo(value);
      expect(await service.hasCapacity(10 * MiB)).toBeTrue();
    }
  });
});
