import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLucideIcons } from '@lucide/angular';
import { SPORT_CENTER_ICONS } from '../../../shared/icons/sport-center-icons';
import { PublicInfoOfflineService } from '../../../core/services/public-info-offline.service';
import { Nosotros } from './nosotros';

describe('Nosotros sin conexión', () => {
  let fixture: ComponentFixture<Nosotros>;
  let publicInfo: any;

  beforeEach(async () => {
    publicInfo = { company: { data: signal(null), loading: signal(false), error: signal('offline-empty') },
      start: jasmine.createSpy('start'), refreshCompany: jasmine.createSpy('refreshCompany') };
    await TestBed.configureTestingModule({ imports: [Nosotros], providers: [
      provideRouter([]), provideLucideIcons(...SPORT_CENTER_ICONS),
      { provide: PublicInfoOfflineService, useValue: publicInfo },
    ] }).compileComponents();
    fixture = TestBed.createComponent(Nosotros);
  });

  it('explica dentro de la página que los datos se descargarán cuando vuelva la conexión', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('Se descargará automáticamente cuando recuperes la conexión');
    expect(fixture.nativeElement.textContent).not.toContain('Sin correo registrado');
  });

  it('muestra los datos y retira el aviso automáticamente al recibirlos', () => {
    fixture.detectChanges();
    publicInfo.company.data.set({ nombre: 'Sport Center', mision: 'Misión guardada', vision: 'Visión guardada' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Misión guardada');
    expect(fixture.nativeElement.textContent).toContain('Visión guardada');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('muestra carga mientras todavía se está consultando y no anuncia datos ausentes', () => {
    publicInfo.company.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando información');
    expect(fixture.nativeElement.textContent).not.toContain('Información pendiente de descargar');
  });
});
