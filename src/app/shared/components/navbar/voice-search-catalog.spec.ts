import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';
import { DashboardPreferencesService } from '../../../core/services/dashboard-preferences.service';
import { VOICE_SEARCH_WINDOW, VoiceRecognition, VoiceSearchService } from '../../../core/services/voice-search.service';
import { environment } from '../../../../environments/environment';
import { Navbar } from './navbar';

describe('Dictado → buscador → filtro real del catálogo', () => {
  let navbar: Navbar;
  let recognition: VoiceRecognition;
  let navigate: jasmine.Spy;
  let products: ProductService;
  let http: HttpTestingController;
  const catalog = [
    { id_producto: 1, producto: 'Tenis deportivos', descripcion: 'Calzado para correr',
      marca: 'Nike', categoria: 'Calzado', variantes: [{ precio: 500, stock: 5 }] },
    { id_producto: 2, producto: 'Botas CR7.5', descripcion: 'Modelo CR7.5',
      marca: 'Sport', categoria: 'Calzado', variantes: [{ precio: 600, stock: 3 }] },
    { id_producto: 3, producto: 'Playera AB-12', descripcion: 'Modelo AB-12',
      marca: 'Sport', categoria: 'Ropa', variantes: [{ precio: 200, stock: 4 }] },
  ];

  beforeEach(() => {
    recognition = {
      lang: '', continuous: false, interimResults: false, maxAlternatives: 1,
      onstart: null, onresult: null, onerror: null, onend: null,
      start: jasmine.createSpy('start'), abort: jasmine.createSpy('abort'),
    };
    class FakeRecognition {
      constructor() { return recognition; }
    }
    const browser = Object.assign(new EventTarget(), {
      isSecureContext: true, navigator: { onLine: true },
      document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
      SpeechRecognition: FakeRecognition,
      setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    });
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    spyOn(Storage.prototype, 'getItem').and.returnValue(null);
    spyOn(Storage.prototype, 'setItem').and.stub();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), VoiceSearchService,
      { provide: VOICE_SEARCH_WINDOW, useValue: browser },
      { provide: Router, useValue: { events: new Subject<NavigationStart>(), url: '/home', navigate } },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      { provide: CartService, useValue: { itemCount: signal(0) } },
      { provide: DashboardPreferencesService, useValue: {} },
    ] });
    navbar = TestBed.runInInjectionContext(() => new Navbar());
    products = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  for (const [transcript, cleanTerm, expectedId] of [
    ['Tenis deportivos.', 'Tenis deportivos', 1],
    ['¿Tenis deportivos?', 'Tenis deportivos', 1],
    ['CR7.5.', 'CR7.5', 2],
    ['AB-12.', 'AB-12', 3],
  ] as const) {
    it(`finds the actual catalog match after dictation: ${transcript}`, () => {
      navbar.toggleVoiceSearch();
      recognition.onresult?.({ results: [{ isFinal: true, length: 1, 0: { transcript } }] });
      expect(navigate).toHaveBeenCalledOnceWith(['/products'], { queryParams: { search: cleanTerm } });
      expect(navbar.searchTerm()).toBe(cleanTerm);
      expect(navbar.recentSearches()).toEqual([cleanTerm]);

      // ProductList entrega este parámetro al servicio de catálogo sin transformarlo.
      const query = navigate.calls.mostRecent().args[1].queryParams.search;
      let resultIds: number[] | undefined;
      products.searchProducts(query).subscribe(result => { resultIds = result.products.map(product => product.id); });
      http.expectOne(`${environment.apiUrl}/products/get-all-products`).flush(catalog);
      expect(resultIds).toEqual([expectedId]);
    });
  }

  it('does not navigate or request products for punctuation without a product term', () => {
    navbar.toggleVoiceSearch();
    recognition.onresult?.({ results: [{ isFinal: true, length: 1, 0: { transcript: '... ¿?!' } }] });
    recognition.onend?.();
    expect(navigate).not.toHaveBeenCalled();
    expect(navbar.recentSearches()).toEqual([]);
    http.expectNone(() => true);
  });
});
