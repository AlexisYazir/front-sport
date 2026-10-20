import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  VOICE_SEARCH_WINDOW,
  VoiceRecognition,
  VoiceRecognitionResult,
  VoiceSearchBrowser,
  VoiceSearchService,
} from './voice-search.service';

describe('VoiceSearchService', () => {
  let service: VoiceSearchService;
  let browser: VoiceSearchBrowser;
  let instances: FakeRecognition[];
  let startError: Error | null;
  let constructorError: Error | null;

  class FakeRecognition implements VoiceRecognition {
    lang = '';
    continuous = true;
    interimResults = true;
    maxAlternatives = 0;
    onstart: VoiceRecognition['onstart'] = null;
    onresult: VoiceRecognition['onresult'] = null;
    onerror: VoiceRecognition['onerror'] = null;
    onend: VoiceRecognition['onend'] = null;
    start = jasmine.createSpy('start').and.callFake(() => {
      if (startError) throw startError;
    });
    abort = jasmine.createSpy('abort');
    constructor() {
      if (constructorError) throw constructorError;
      instances.push(this);
    }
  }

  const result = (transcript: string, isFinal = true): { results: VoiceRecognitionResult[] } => ({
    results: [{ isFinal, length: 1, 0: { transcript } }],
  });
  const current = (): FakeRecognition => instances[instances.length - 1];

  beforeEach(() => {
    instances = [];
    startError = null;
    constructorError = null;
    browser = Object.assign(new EventTarget(), {
      isSecureContext: true,
      navigator: { onLine: true },
      document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
      SpeechRecognition: FakeRecognition,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    }) as unknown as VoiceSearchBrowser;
    TestBed.configureTestingModule({
      providers: [VoiceSearchService, { provide: VOICE_SEARCH_WINDOW, useValue: browser }],
    });
    service = TestBed.inject(VoiceSearchService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('does not request the microphone until start is called', () => {
    expect(instances.length).toBe(0);
    expect(service.active()).toBeFalse();
    expect(service.message()).toBe('');
  });

  it('recognizes one phrase in Mexican Spanish and reports listening state', () => {
    service.start(jasmine.createSpy());
    expect(current().lang).toBe('es-MX');
    expect(current().continuous).toBeFalse();
    expect(current().interimResults).toBeFalse();
    expect(current().maxAlternatives).toBe(1);
    expect(current().start).toHaveBeenCalledTimes(1);
    expect(service.active()).toBeTrue();
    current().onstart?.();
    expect(service.message()).toContain('Escuchando');
  });

  it('uses the prefixed browser API when the standard constructor is unavailable', () => {
    browser.SpeechRecognition = undefined;
    browser.webkitSpeechRecognition = FakeRecognition;
    service.start(jasmine.createSpy());
    expect(current().start).toHaveBeenCalledTimes(1);
  });

  it('returns a final normalized phrase once and discards duplicate or late events', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    const recognition = current();
    const final = recognition.onresult;
    final?.(result('  tenis   deportivos  '));
    final?.(result('otro producto'));
    expect(callback).toHaveBeenCalledOnceWith('tenis deportivos');
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(service.active()).toBeFalse();
    expect(service.message()).toBe('');
  });

  for (const [transcript, expected] of [
    ['Tenis.', 'Tenis'],
    ['  tenis   deportivos.  ', 'tenis deportivos'],
    ['tenis...', 'tenis'],
    ['tenis…', 'tenis'],
    ['¿Tenis?', 'Tenis'],
    ['¡Tenis!', 'Tenis'],
    ['«Tenis.»', 'Tenis'],
    ['“Balón de fútbol.”', 'Balón de fútbol'],
    [" 'tenis.' ", 'tenis'],
    ['tenis,', 'tenis'],
    ['tenis; ', 'tenis'],
    ['AB-12.', 'AB-12'],
    ['CR7.5.', 'CR7.5'],
    ['.5.', '.5'],
    ['100% algodón.', '100% algodón'],
    ["Levi's.", "Levi's"],
  ]) {
    it(`cleans dictation punctuation without changing the product term: ${transcript}`, () => {
      const callback = jasmine.createSpy('search');
      service.start(callback);
      current().onresult?.(result(transcript));
      expect(callback).toHaveBeenCalledOnceWith(expected);
      expect(service.active()).toBeFalse();
    });
  }

  it('does not submit dictation containing only sentence punctuation', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    current().onresult?.(result(' ... ¿?! «» '));
    expect(callback).not.toHaveBeenCalled();
    current().onend?.();
    expect(service.message()).toContain('No se reconoció');
    expect(service.active()).toBeFalse();
  });

  it('does not search interim or empty results and explains a session ending without words', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    current().onresult?.(result('tenis', false));
    current().onresult?.(result('   '));
    expect(callback).not.toHaveBeenCalled();
    expect(service.active()).toBeTrue();
    current().onend?.();
    expect(service.active()).toBeFalse();
    expect(service.message()).toContain('No se reconoció');
  });

  for (const code of ['not-allowed', 'service-not-allowed']) {
    it(`explains denied permission (${code}) without retrying automatically`, () => {
      service.start(jasmine.createSpy());
      current().onerror?.({ error: code });
      expect(service.message()).toContain('bloqueado');
      expect(service.active()).toBeFalse();
      expect(instances.length).toBe(1);
    });
  }

  for (const [code, expected] of [
    ['audio-capture', 'No se pudo acceder al micrófono'],
    ['no-speech', 'No se detectó voz'],
    ['network', 'Revisa tu conexión'],
    ['language-not-supported', 'voz en español'],
    ['aborted', 'se detuvo'],
  ]) {
    it(`provides a useful message for ${code}`, () => {
      service.start(jasmine.createSpy());
      current().onerror?.({ error: code });
      expect(service.message()).toContain(expected);
      expect(service.active()).toBeFalse();
    });
  }

  it('leaves a text fallback when speech recognition is unsupported', () => {
    browser.SpeechRecognition = undefined;
    service.start(jasmine.createSpy());
    expect(service.message()).toContain('no admite');
    expect(service.message()).toContain('escribir');
    expect(instances.length).toBe(0);
  });

  it('does not capture audio in an insecure context', () => {
    Object.defineProperty(browser, 'isSecureContext', { value: false });
    service.start(jasmine.createSpy());
    expect(service.message()).toContain('conexión segura');
    expect(instances.length).toBe(0);
  });

  it('does not start without internet', () => {
    Object.defineProperty(browser.navigator, 'onLine', { value: false });
    service.start(jasmine.createSpy());
    expect(service.message()).toContain('necesita internet');
    expect(instances.length).toBe(0);
  });

  it('stops listening when connectivity is lost', () => {
    service.start(jasmine.createSpy());
    browser.dispatchEvent(new Event('offline'));
    expect(current().abort).toHaveBeenCalledTimes(1);
    expect(service.active()).toBeFalse();
    expect(service.message()).toContain('necesita internet');
  });

  it('cancels capture when the application is hidden', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    const lateResult = current().onresult;
    Object.defineProperty(browser.document, 'visibilityState', { value: 'hidden' });
    browser.document.dispatchEvent(new Event('visibilitychange'));
    lateResult?.(result('tenis'));
    expect(callback).not.toHaveBeenCalled();
    expect(current().abort).toHaveBeenCalledTimes(1);
    expect(service.active()).toBeFalse();
  });

  it('cancels voluntarily without showing a false browser error or searching late', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    const recognition = current();
    const lateError = recognition.onerror;
    const lateEnd = recognition.onend;
    const lateResult = recognition.onresult;
    service.cancel('Cancelada');
    lateError?.({ error: 'aborted' });
    lateEnd?.();
    lateResult?.(result('tenis'));
    expect(callback).not.toHaveBeenCalled();
    expect(service.message()).toBe('Cancelada');
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it('ignores a previous session after the user starts a new one', () => {
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');
    service.start(first);
    const lateResult = current().onresult;
    service.cancel();
    service.start(second);
    lateResult?.(result('viejo'));
    current().onresult?.(result('nuevo'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnceWith('nuevo');
  });

  it('does not start overlapping sessions while permission or audio is pending', () => {
    service.start(jasmine.createSpy());
    service.start(jasmine.createSpy());
    expect(instances.length).toBe(1);
    expect(current().start).toHaveBeenCalledTimes(1);
  });

  it('recovers from a synchronous denied-permission exception', () => {
    startError = new DOMException('blocked', 'NotAllowedError');
    service.start(jasmine.createSpy());
    expect(service.active()).toBeFalse();
    expect(service.message()).toContain('bloqueado');
    expect(current().abort).toHaveBeenCalledTimes(1);
    startError = null;
    service.start(jasmine.createSpy());
    expect(instances.length).toBe(2);
    expect(service.active()).toBeTrue();
  });

  it('handles a constructor failure without breaking the search page', () => {
    constructorError = new Error('not available');
    expect(() => service.start(jasmine.createSpy())).not.toThrow();
    expect(service.active()).toBeFalse();
    expect(service.message()).toContain('No se pudo iniciar');
  });

  it('bounds a browser session that never sends a result or end event', fakeAsync(() => {
    service.start(jasmine.createSpy());
    tick(30_000);
    expect(service.active()).toBeFalse();
    expect(service.message()).toContain('tardó demasiado');
    expect(current().abort).toHaveBeenCalledTimes(1);
  }));

  it('aborts and ignores all pending results on destruction', () => {
    const callback = jasmine.createSpy('search');
    service.start(callback);
    const recognition = current();
    const lateResult = recognition.onresult;
    TestBed.resetTestingModule();
    lateResult?.(result('tenis'));
    expect(callback).not.toHaveBeenCalled();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    service.start(callback);
    expect(instances.length).toBe(1);
  });
});
