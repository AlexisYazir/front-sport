import { AfterViewInit, Component, ElementRef, InjectionToken, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { Subscription } from 'rxjs';
import { CompanyInfo, CompanyService } from '../../../core/services/company.service';
import { GeolocationService, getGeolocationErrorMessage } from '../../../core/services/geolocation.service';
import { environment } from '../../../../environments/environment';
import { IconModule } from '../../../shared/icons/icon.module';

export const LOCATION_MAP_API = new InjectionToken<typeof maplibregl>('Location map API', {
  providedIn: 'root',
  factory: () => maplibregl,
});

interface CompanyLocationData {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
  address: string;
  mapsUrl: string;
}

@Component({
  selector: 'app-ubicacion',
  standalone: true,
  imports: [IconModule, CommonModule],
  templateUrl: './ubicacion.html',
  styleUrls: ['./ubicacion.css']
})
export class Ubicacion implements AfterViewInit, OnDestroy {
  private readonly companyService = inject(CompanyService);
  private readonly geolocation = inject(GeolocationService);
  private readonly mapApi = inject(LOCATION_MAP_API);
  @ViewChild('mapContainer', { static: true }) private mapContainer!: ElementRef<HTMLElement>;
  private map?: maplibregl.Map;
  private companySubscription?: Subscription;
  private storeMarker?: maplibregl.Marker;
  private userMarker?: maplibregl.Marker;
  private resizeFrame?: number;
  private resizeTimeout?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  companyInfo: CompanyInfo | null = null;
  locating = false;
  locationMessage = '';
  locationError = false;
  mapUnavailable = false;
  storeLocationConfigured = false;
  userLocation: { lat: number; lng: number; accuracy: number } | null = null;
  locationData: CompanyLocationData = {
    lat: 21.155931,
    lng: -98.381103,
    zoom: 15,
    label: 'Sport Center',
    address: 'Ubicación pendiente por configurar',
    mapsUrl: 'https://www.google.com/maps',
  };

  ngAfterViewInit(): void {
    this.companySubscription = this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        if (this.destroyed) return;
        this.companyInfo = info;
        const configuredLocation = this.parseLocation(info?.mapa_ubicacion);
        this.storeLocationConfigured = configuredLocation !== null;
        this.locationData = configuredLocation ?? this.locationData;
        this.initializeMap();
      },
      error: () => {
        if (this.destroyed) return;
        this.initializeMap();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.companySubscription?.unsubscribe();
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    if (this.resizeTimeout !== undefined) clearTimeout(this.resizeTimeout);
    this.userMarker?.remove();
    this.storeMarker?.remove();
    this.map?.remove();
  }

  async useMyLocation(): Promise<void> {
    if (this.destroyed || this.locating) return;
    this.locating = true;
    this.locationError = false;
    this.locationMessage = 'Buscando tu ubicación…';

    try {
      const position = await this.geolocation.getCurrentPosition();
      if (this.destroyed) return;
      if (!Number.isFinite(position.coords.latitude) || Math.abs(position.coords.latitude) > 90 ||
          !Number.isFinite(position.coords.longitude) || Math.abs(position.coords.longitude) > 180) {
        throw new Error('Invalid location coordinates');
      }
      this.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      this.showUserMarker();
      this.locationMessage = 'Ubicación obtenida. Tu posición es aproximada y no se guarda.';
    } catch (error: unknown) {
      if (this.destroyed) return;
      this.locationError = true;
      this.locationMessage = getGeolocationErrorMessage(error);
    } finally {
      if (!this.destroyed) this.locating = false;
    }
  }

  get distanceKm(): number | null {
    if (!this.userLocation || !this.storeLocationConfigured) return null;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = toRadians(this.locationData.lat - this.userLocation.lat);
    const longitudeDelta = toRadians(this.locationData.lng - this.userLocation.lng);
    const a = Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(toRadians(this.userLocation.lat)) * Math.cos(toRadians(this.locationData.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  get directionsUrl(): string | null {
    if (!this.userLocation || !this.storeLocationConfigured) return null;
    const url = new URL('https://www.google.com/maps/dir/');
    url.search = new URLSearchParams({
      api: '1',
      origin: `${this.userLocation.lat},${this.userLocation.lng}`,
      destination: `${this.locationData.lat},${this.locationData.lng}`,
    }).toString();
    return url.toString();
  }

  private initializeMap(): void {
    if (this.destroyed || this.map) return;
    const style = environment.maptilerApiKey
      ? `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`
      : 'https://demotiles.maplibre.org/style.json';

    try {
      // El worker de MapLibre 6 se sirve desde el propio sitio; la versión evita reutilizar uno anterior.
      maplibregl.setWorkerUrl(new URL(
        `assets/maplibre/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`, document.baseURI,
      ).href);
      this.map = new this.mapApi.Map({
        container: this.mapContainer.nativeElement,
        style,
        center: [this.locationData.lng, this.locationData.lat],
        zoom: this.locationData.zoom,
        pitch: 28,
        bearing: -8,
        cooperativeGestures: true,
        attributionControl: false,
      });

      const map = this.map;
      map.addControl(new this.mapApi.NavigationControl({ showCompass: false }), 'top-right');
      map.dragRotate.disable();

      map.on('load', () => {
        if (this.destroyed || this.map !== map) return;
        map.resize();
        if (this.userLocation) {
          this.fitLocations();
        } else {
          map.jumpTo({
            center: [this.locationData.lng, this.locationData.lat],
            zoom: this.locationData.zoom,
          });
        }
      });

      this.resizeFrame = requestAnimationFrame(() => {
        if (!this.destroyed && this.map === map) map.resize();
      });
      this.resizeTimeout = setTimeout(() => {
        if (!this.destroyed && this.map === map) map.resize();
      }, 120);

      const popup = new this.mapApi.Popup({
        offset: 14,
        closeButton: true,
        closeOnClick: false,
        className: 'public-location-popup',
      }).setDOMContent(this.createStorePopup());

      const marker = new this.mapApi.Marker({ color: '#0367A6', anchor: 'bottom' })
        .setLngLat([this.locationData.lng, this.locationData.lat])
        .setPopup(popup)
        .addTo(map);
      this.storeMarker = marker;

      map.once('idle', () => {
        if (!this.destroyed && this.map === map) marker.togglePopup();
      });
      this.showUserMarker();
    } catch {
      this.userMarker?.remove();
      this.storeMarker?.remove();
      this.map?.remove();
      this.map = undefined;
      this.mapUnavailable = true;
    }
  }

  private showUserMarker(): void {
    if (this.destroyed || !this.map || !this.userLocation) return;
    if (!this.userMarker) {
      this.userMarker = new this.mapApi.Marker({ color: '#16a34a', anchor: 'bottom' })
        .setPopup(new this.mapApi.Popup({ offset: 14 }).setText('Tu ubicación aproximada'))
        .setLngLat([this.userLocation.lng, this.userLocation.lat])
        .addTo(this.map);
    } else {
      this.userMarker.setLngLat([this.userLocation.lng, this.userLocation.lat]);
    }
    this.fitLocations();
  }

  private fitLocations(): void {
    if (this.destroyed || !this.map || !this.userLocation) return;
    if (!this.storeLocationConfigured) {
      this.map.jumpTo({ center: [this.userLocation.lng, this.userLocation.lat], zoom: 14 });
      return;
    }
    const bounds = new this.mapApi.LngLatBounds()
      .extend([this.locationData.lng, this.locationData.lat])
      .extend([this.userLocation.lng, this.userLocation.lat]);
    this.map.fitBounds(bounds, { padding: 64, maxZoom: this.locationData.zoom, duration: 500 });
  }

  private createStorePopup(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'store-popup-details';
    const title = document.createElement('strong');
    title.textContent = this.companyInfo?.nombre || this.locationData.label;
    container.appendChild(title);
    const address = document.createElement('p');
    address.textContent = this.locationData.address;
    container.appendChild(address);
    for (const [label, value] of [
      ['Tel:', this.companyInfo?.telefono || 'Sin teléfono'],
      ['Horario:', this.companyInfo?.horario_atencion || 'Horario pendiente'],
    ]) {
      const line = document.createElement('p');
      const heading = document.createElement('b');
      heading.textContent = `${label} `;
      line.append(heading, document.createTextNode(value));
      container.appendChild(line);
    }
    return container;
  }

  private parseLocation(rawValue: string | null | undefined): CompanyLocationData | null {
    if (!rawValue?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (Number.isFinite(parsed?.lat) && Math.abs(parsed.lat) <= 90 &&
          Number.isFinite(parsed?.lng) && Math.abs(parsed.lng) <= 180) {
        return {
          lat: parsed.lat,
          lng: parsed.lng,
          zoom: Number(parsed.zoom) || 15,
          label: parsed.label || this.companyInfo?.nombre || 'Sport Center',
          address: parsed.address || 'Ubicación principal',
          mapsUrl: parsed.mapsUrl || `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`,
        };
      }
    } catch {
      return null;
    }

    return null;
  }
}
