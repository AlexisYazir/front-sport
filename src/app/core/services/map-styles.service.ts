import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';

export const MAP_STYLES_ASSET = 'assets/maplibre/6.15.0/maplibre-gl.css';
const LOAD_TIMEOUT_MS = 15_000;

export type MapStylesDocument = Pick<Document, 'baseURI' | 'head' | 'createElement'>;
export type MapCssLoader = (document: MapStylesDocument, href: string) => Promise<void>;

function loadStylesheet(document: MapStylesDocument, href: string): Promise<void> {
  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[data-maplibre-styles]'))
    .find(link => link.href === href);
  if (existing?.dataset['maplibreStyles'] === 'loaded') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = existing ?? document.createElement('link');
    let settled = false;
    const clean = () => {
      clearTimeout(timeout);
      link.removeEventListener('load', loaded);
      link.removeEventListener('error', failed);
    };
    const loaded = () => {
      if (settled) return;
      settled = true;
      clean();
      link.dataset['maplibreStyles'] = 'loaded';
      resolve();
    };
    const failed = () => {
      if (settled) return;
      settled = true;
      clean();
      link.remove();
      reject(new Error('No fue posible cargar los estilos locales del mapa.'));
    };
    link.addEventListener('load', loaded);
    link.addEventListener('error', failed);
    const timeout = setTimeout(failed, LOAD_TIMEOUT_MS);
    if (!existing) {
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset['maplibreStyles'] = 'loading';
      try { document.head.appendChild(link); } catch { failed(); }
    }
  });
}

export const MAP_CSS_LOADER = new InjectionToken<MapCssLoader>('Local MapLibre CSS loader', {
  providedIn: 'root', factory: () => loadStylesheet,
});

/** El CSS permanece compartido después de abrir el primer mapa, fuera del bundle inicial. */
@Injectable({ providedIn: 'root' })
export class MapStylesService {
  private readonly document = inject(DOCUMENT);
  private readonly loadCss = inject(MAP_CSS_LOADER);
  private pending: Promise<void> | null = null;

  ensureLoaded(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = Promise.resolve()
      .then(() => this.loadCss(this.document, new URL(MAP_STYLES_ASSET, this.document.baseURI).href))
      .catch((error: unknown) => {
        this.pending = null;
        throw error;
      });
    return this.pending;
  }
}
