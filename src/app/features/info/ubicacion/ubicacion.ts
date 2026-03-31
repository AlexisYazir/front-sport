import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { CompanyInfo, CompanyService } from '../../../core/services/company.service';
import { environment } from '../../../../environments/environment';

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
  imports: [CommonModule],
  templateUrl: './ubicacion.html',
  styleUrls: ['./ubicacion.css']
})
export class Ubicacion implements AfterViewInit, OnDestroy {
  private readonly companyService = inject(CompanyService);
  private map!: maplibregl.Map;

  companyInfo: CompanyInfo | null = null;
  locationData: CompanyLocationData = {
    lat: 21.155931,
    lng: -98.381103,
    zoom: 15,
    label: 'Sport Center',
    address: 'Ubicación pendiente por configurar',
    mapsUrl: 'https://www.google.com/maps',
  };

  ngAfterViewInit(): void {
    this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        this.companyInfo = info;
        this.locationData = this.parseLocation(info?.mapa_ubicacion) ?? this.locationData;
        this.initializeMap();
      },
      error: () => {
        this.initializeMap();
      },
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initializeMap(): void {
    const style = environment.maptilerApiKey
      ? `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`
      : 'https://demotiles.maplibre.org/style.json';

    this.map = new maplibregl.Map({
      container: 'map',
      style,
      center: [this.locationData.lng, this.locationData.lat],
      zoom: this.locationData.zoom,
      pitch: 28,
      bearing: -8,
      cooperativeGestures: true,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    this.map.dragRotate.disable();

    this.map.on('load', () => {
      this.map.resize();
      this.map.jumpTo({
        center: [this.locationData.lng, this.locationData.lat],
        zoom: this.locationData.zoom,
      });
    });

    requestAnimationFrame(() => this.map?.resize());
    setTimeout(() => this.map?.resize(), 120);

    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: true,
      closeOnClick: false,
      className: 'public-location-popup',
    }).setHTML(`
      <div style="min-width:220px;font-family:inherit;">
        <strong style="display:block;color:#203044;font-size:15px;margin-bottom:6px;">
          ${this.companyInfo?.nombre || this.locationData.label}
        </strong>
        <p style="margin:0 0 6px;color:#4b5d73;font-size:13px;">${this.locationData.address}</p>
        <p style="margin:0 0 4px;color:#203044;font-size:13px;"><strong>Tel:</strong> ${this.companyInfo?.telefono || 'Sin teléfono'}</p>
        <p style="margin:0;color:#203044;font-size:13px;white-space:pre-line;"><strong>Horario:</strong> ${this.companyInfo?.horario_atencion || 'Horario pendiente'}</p>
      </div>
    `);

    const marker = new maplibregl.Marker({ color: '#0367A6', anchor: 'bottom' })
      .setLngLat([this.locationData.lng, this.locationData.lat])
      .setPopup(popup)
      .addTo(this.map);

    this.map.once('idle', () => marker.togglePopup());
  }

  private parseLocation(rawValue: string | null | undefined): CompanyLocationData | null {
    if (!rawValue?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
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
