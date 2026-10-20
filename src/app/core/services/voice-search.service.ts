import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';

export interface VoiceRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}

export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<VoiceRecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;
export type VoiceSearchBrowser = Window & typeof globalThis & {
  SpeechRecognition?: VoiceRecognitionConstructor;
  webkitSpeechRecognition?: VoiceRecognitionConstructor;
};

export const VOICE_SEARCH_WINDOW = new InjectionToken<VoiceSearchBrowser>('Voice search window', {
  providedIn: 'root',
  factory: () => window as VoiceSearchBrowser,
});

// Se proporciona desde Navbar: cada buscador cancela su propia sesión al destruirse.
@Injectable()
export class VoiceSearchService {
  private readonly browser = inject(VOICE_SEARCH_WINDOW);
  private readonly destroyRef = inject(DestroyRef);
  private recognition: VoiceRecognition | null = null;
  private timeout: number | null = null;
  private destroyed = false;

  readonly active = signal(false);
  readonly message = signal('');

  private readonly onOffline = () => {
    if (this.active()) this.release('La búsqueda por voz necesita internet. Puedes escribir tu búsqueda.');
  };

  private readonly onVisibilityChange = () => {
    if (this.browser.document.visibilityState === 'hidden' && this.active()) this.cancel();
  };

  constructor() {
    this.browser.addEventListener('offline', this.onOffline);
    this.browser.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.release('');
      this.browser.removeEventListener('offline', this.onOffline);
      this.browser.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  start(onResult: (term: string) => void): void {
    if (this.destroyed || this.active()) return;
    if (!this.browser.isSecureContext) {
      this.message.set('La búsqueda por voz necesita una conexión segura. Puedes escribir tu búsqueda.');
      return;
    }
    const Recognition = this.browser.SpeechRecognition || this.browser.webkitSpeechRecognition;
    if (!Recognition) {
      this.message.set('Este navegador no admite búsqueda por voz. Puedes escribir tu búsqueda.');
      return;
    }
    if (!this.browser.navigator.onLine) {
      this.message.set('La búsqueda por voz necesita internet. Puedes escribir tu búsqueda.');
      return;
    }

    try {
      const recognition = new Recognition();
      this.recognition = recognition;
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      this.active.set(true);
      this.message.set('Preparando el micrófono…');

      recognition.onstart = () => {
        if (this.recognition === recognition) this.message.set('Escuchando… di el producto que buscas.');
      };
      recognition.onresult = (event) => {
        if (this.recognition !== recognition) return;
        const terms: string[] = [];
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index];
          if (result.isFinal && result.length > 0) terms.push(result[0].transcript);
        }
        // El dictado puede añadir signos de frase; los puntos internos de modelos y números se conservan.
        const term = terms.join(' ').trim()
          .replace(/^[\s¿¡"'“”‘’«»]+|[\s.!?¿¡…,:;"'“”‘’«»]+$/gu, '')
          .replace(/\s+/g, ' ');
        if (!term) return;
        // Invalidar la sesión antes de navegar también descarta eventos finales duplicados.
        this.release('');
        onResult(term);
      };
      recognition.onerror = (event) => {
        if (this.recognition === recognition) this.release(this.errorMessage(event.error));
      };
      recognition.onend = () => {
        if (this.recognition === recognition) this.release('No se reconoció ninguna palabra. Intenta de nuevo o escribe tu búsqueda.');
      };
      this.timeout = this.browser.setTimeout(() => {
        if (this.recognition === recognition) this.release('La búsqueda por voz tardó demasiado. Intenta de nuevo o escribe tu búsqueda.');
      }, 30_000);
      // Debe permanecer dentro del clic del usuario; no se solicita getUserMedia aparte.
      recognition.start();
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      this.release(this.errorMessage(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'start-failed'));
    }
  }

  cancel(message = ''): void {
    this.release(message);
  }

  private release(message: string): void {
    const recognition = this.recognition;
    this.recognition = null;
    this.active.set(false);
    this.message.set(message);
    if (this.timeout !== null) this.browser.clearTimeout(this.timeout);
    this.timeout = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // Algunos navegadores ya cerraron la sesión al emitir el resultado o error.
    }
  }

  private errorMessage(error: string): string {
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'El micrófono o el reconocimiento de voz está bloqueado. Revisa los permisos del sitio o escribe tu búsqueda.';
      case 'audio-capture':
        return 'No se pudo acceder al micrófono. Comprueba que esté conectado y disponible, o escribe tu búsqueda.';
      case 'no-speech':
        return 'No se detectó voz. Acércate al micrófono e intenta de nuevo, o escribe tu búsqueda.';
      case 'network':
        return 'No se pudo conectar al reconocimiento de voz. Revisa tu conexión o escribe tu búsqueda.';
      case 'language-not-supported':
        return 'Este navegador no pudo reconocer voz en español. Puedes escribir tu búsqueda.';
      case 'aborted':
        return 'La búsqueda por voz se detuvo. Puedes intentarlo de nuevo o escribir tu búsqueda.';
      default:
        return 'No se pudo iniciar la búsqueda por voz. Intenta de nuevo o escribe tu búsqueda.';
    }
  }
}
