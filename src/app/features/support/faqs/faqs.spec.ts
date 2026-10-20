import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLucideIcons } from '@lucide/angular';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { SPORT_CENTER_ICONS } from '../../../shared/icons/sport-center-icons';
import { PublicInfoOfflineService } from '../../../core/services/public-info-offline.service';
import { CompanyService } from '../../../core/services/company.service';
import { Faqs } from './faqs';

describe('Preguntas frecuentes sin conexión', () => {
  let fixture: ComponentFixture<Faqs>;
  let publicInfo: any;
  let votes: jasmine.Spy;
  const question = { id_faq: 1, pregunta: '¿Cómo comprar?', respuesta: 'Desde la tienda.',
    activo: true, seccion: 'Compras', palabras_clave: ['pedido'], contador_util: 2 };

  beforeEach(async () => {
    publicInfo = { faqs: { data: signal(null), loading: signal(false), error: signal('offline-empty') },
      start: jasmine.createSpy('start'), refreshFaqs: jasmine.createSpy('refreshFaqs') };
    votes = jasmine.createSpy('vote').and.returnValue(of({}));
    await TestBed.configureTestingModule({ imports: [Faqs], providers: [
      provideRouter([]), provideLucideIcons(...SPORT_CENTER_ICONS),
      { provide: PublicInfoOfflineService, useValue: publicInfo },
      { provide: CompanyService, useValue: { marcarFaqComoUtil: votes } },
      { provide: ToastrService, useValue: jasmine.createSpyObj('toastr', ['success', 'error']) },
    ] }).compileComponents();
    fixture = TestBed.createComponent(Faqs);
  });

  it('muestra un aviso dentro de la página si todavía no hay copia', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('Se descargarán automáticamente cuando recuperes la conexión');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(votes).not.toHaveBeenCalled();
  });

  it('conserva la búsqueda local y los filtros al actualizar los datos', () => {
    publicInfo.faqs.data.set([question]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchTerm = 'pedido';
    component.onSeccionChange('Compras');
    publicInfo.faqs.data.set([question, { ...question, id_faq: 2, seccion: 'Envíos' }]);
    fixture.detectChanges();
    expect(component.filteredFaqs.map(faq => faq.id_faq)).toEqual([1]);
    expect(component.searchTerm).toBe('pedido');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Desde la tienda.');
    expect(votes).not.toHaveBeenCalled();
  });

  it('distingue una lista vacía publicada de la falta de primera descarga', () => {
    publicInfo.faqs.data.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay preguntas frecuentes publicadas');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('mantiene el voto existente sin modificar la copia pública compartida', () => {
    publicInfo.faqs.data.set([question]);
    fixture.detectChanges();
    fixture.componentInstance.marcarComoUtil(1);
    expect(votes).toHaveBeenCalledOnceWith(1);
    expect(fixture.componentInstance.faqs[0].contador_util).toBe(3);
    expect(publicInfo.faqs.data()[0].contador_util).toBe(2);
  });
});
