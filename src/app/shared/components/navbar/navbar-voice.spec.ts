import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';
import { DashboardPreferencesService } from '../../../core/services/dashboard-preferences.service';
import { VoiceSearchService } from '../../../core/services/voice-search.service';
import { Navbar } from './navbar';

describe('Navbar voice search integration', () => {
  let navbar: Navbar;
  let events: Subject<NavigationStart>;
  let router: { events: Subject<NavigationStart>; url: string; navigate: jasmine.Spy };
  let callback: ((term: string) => void) | null;
  let voice: {
    active: ReturnType<typeof signal<boolean>>;
    message: ReturnType<typeof signal<string>>;
    start: jasmine.Spy;
    cancel: jasmine.Spy;
  };

  beforeEach(() => {
    callback = null;
    events = new Subject<NavigationStart>();
    router = { events, url: '/home', navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    voice = {
      active: signal(false),
      message: signal(''),
      start: jasmine.createSpy('start').and.callFake((result: (term: string) => void) => {
        callback = result;
        voice.active.set(true);
      }),
      cancel: jasmine.createSpy('cancel').and.callFake(() => voice.active.set(false)),
    };
    spyOn(Storage.prototype, 'getItem').and.returnValue(null);
    spyOn(Storage.prototype, 'setItem').and.stub();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: VoiceSearchService, useValue: voice },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: CartService, useValue: { itemCount: signal(0) } },
        { provide: ProductService, useValue: {} },
        { provide: DashboardPreferencesService, useValue: {} },
      ],
    });
    navbar = TestBed.runInInjectionContext(() => new Navbar());
  });

  afterEach(() => TestBed.resetTestingModule());

  it('uses the existing product search and recent searches for recognized words', () => {
    navbar.mobileMenuOpen.set(true);
    navbar.searchPanelOpen.set(true);
    navbar.toggleVoiceSearch();
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(navbar.searchPanelOpen()).toBeFalse();
    callback?.('tenis deportivos');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/products'], { queryParams: { search: 'tenis deportivos' } });
    expect(navbar.searchTerm()).toBe('tenis deportivos');
    expect(navbar.recentSearches()).toEqual(['tenis deportivos']);
    expect(navbar.mobileMenuOpen()).toBeFalse();
  });

  it('preserves written search and Enter behavior while cancelling pending capture', () => {
    navbar.searchTerm.set('balón');
    navbar.toggleVoiceSearch();
    navbar.onSearchInput();
    expect(voice.cancel).toHaveBeenCalled();
    expect(navbar.searchPanelOpen()).toBeTrue();
    navbar.onSearchKeyPress(new KeyboardEvent('keypress', { key: 'Enter' }));
    expect(router.navigate).toHaveBeenCalledOnceWith(['/products'], { queryParams: { search: 'balón' } });
  });

  it('preserves empty search navigation and recent search selection', () => {
    navbar.onSearch();
    expect(router.navigate).toHaveBeenCalledWith(['/products']);
    navbar.selectRecentSearch('ropa');
    expect(router.navigate).toHaveBeenCalledWith(['/products'], { queryParams: { search: 'ropa' } });
  });

  it('lets the microphone button cancel without launching any search', () => {
    navbar.toggleVoiceSearch();
    navbar.toggleVoiceSearch();
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(voice.cancel).toHaveBeenCalledWith('Búsqueda por voz cancelada. Puedes escribir tu búsqueda.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('cancels listening when navigating or closing the mobile menu', () => {
    navbar.toggleVoiceSearch();
    events.next(new NavigationStart(1, '/info/ubicacion'));
    expect(voice.active()).toBeFalse();
    navbar.mobileMenuOpen.set(true);
    navbar.toggleVoiceSearch();
    navbar.toggleMobileMenu();
    expect(voice.active()).toBeFalse();
    expect(navbar.mobileMenuOpen()).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('cancels capture before clearing or selecting a written suggestion', () => {
    navbar.toggleVoiceSearch();
    navbar.clearSearch();
    expect(voice.active()).toBeFalse();
    expect(navbar.searchTerm()).toBe('');
    navbar.toggleVoiceSearch();
    navbar.selectSearchSuggestion({ id: 7, nombre: 'Tenis' } as never);
    expect(voice.active()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/products', 7]);
  });
});
