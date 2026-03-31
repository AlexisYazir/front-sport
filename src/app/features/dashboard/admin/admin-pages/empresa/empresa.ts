import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as maplibregl from 'maplibre-gl';
import { ToastrService } from 'ngx-toastr';
import { CompanyFaq, CompanyInfo, CompanyService } from '../../../../../core/services/company.service';
import { environment } from '../../../../../../environments/environment';

type CompanyModal = 'general' | 'contacto' | 'historia' | 'ubicacion' | 'faq' | null;

interface CompanyLocationData {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
  address: string;
  mapsUrl: string;
}

@Component({
  selector: 'app-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresa.html',
  styleUrl: './empresa.css',
})
export class Empresa implements OnInit, OnDestroy {
  private readonly companyService = inject(CompanyService);
  private readonly toastr = inject(ToastrService);

  companyInfo: CompanyInfo | null = null;
  faqs: CompanyFaq[] = [];
  filteredFaqs: CompanyFaq[] = [];
  isBootstrapping = false;
  isLoadingFaqs = false;
  isSaving = false;
  isUploadingLogo = false;
  isDraggingLogo = false;
  activeModal: CompanyModal = null;
  editingFaqId: number | null = null;
  faqSearchTerm = '';
  faqSeccionFilter = 'todas';
  faqActivoFilter = 'todas';
  faqPage = 1;
  readonly faqPageSize = 10;

  generalForm = {
    nombre: '',
    rfc: '',
    regimen_fiscal: '',
    sitio_web: '',
    logo_url: '',
  };
  logoFileName = '';

  contactoForm = {
    telefono: '',
    email: '',
    horario_atencion: '',
  };

  historiaForm = {
    mision: '',
    vision: '',
    facebook: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    youtube: '',
  };
  valoresDraft: string[] = [];
  newValor = '';
  removedValoresHistory: string[] = [];
  faqForm = {
    pregunta: '',
    respuesta: '',
    orden: 0,
    seccion: '',
    activo: true,
    destacado: false,
  };
  faqKeywordsDraft: string[] = [];
  newFaqKeyword = '';
  removedFaqKeywordsHistory: string[] = [];

  ubicacionForm: CompanyLocationData = this.getDefaultLocation();

  private map: maplibregl.Map | null = null;
  private locationMarker: maplibregl.Marker | null = null;

  ngOnInit(): void {
    this.loadCompanyInfo();
    this.loadFaqs();
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  loadCompanyInfo(): void {
    this.isBootstrapping = true;
    this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        this.companyInfo = info;
        this.isBootstrapping = false;
      },
      error: () => {
        this.companyInfo = null;
        this.isBootstrapping = false;
      },
    });
  }

  openModal(modal: Exclude<CompanyModal, null>): void {
    this.activeModal = modal;

    if (modal === 'general') {
      this.generalForm = {
        nombre: this.companyInfo?.nombre ?? '',
        rfc: this.companyInfo?.rfc ?? '',
        regimen_fiscal: this.companyInfo?.regimen_fiscal ?? '',
        sitio_web: this.companyInfo?.sitio_web ?? '',
        logo_url: this.companyInfo?.logo_url ?? '',
      };
      this.logoFileName = '';
    }

    if (modal === 'contacto') {
      this.contactoForm = {
        telefono: this.companyInfo?.telefono ?? '',
        email: this.companyInfo?.email ?? '',
        horario_atencion: this.companyInfo?.horario_atencion ?? '',
      };
    }

    if (modal === 'historia') {
      this.historiaForm = {
        mision: this.companyInfo?.mision ?? '',
        vision: this.companyInfo?.vision ?? '',
        facebook: this.companyInfo?.facebook ?? '',
        instagram: this.companyInfo?.instagram ?? '',
        twitter: this.companyInfo?.twitter ?? '',
        tiktok: this.companyInfo?.tiktok ?? '',
        youtube: this.companyInfo?.youtube ?? '',
      };
      this.valoresDraft = [...(this.companyInfo?.valores ?? [])];
      this.newValor = '';
      this.removedValoresHistory = [];
    }

    if (modal === 'ubicacion') {
      this.ubicacionForm = this.parseLocation(this.companyInfo?.mapa_ubicacion) ?? this.getDefaultLocation();
      setTimeout(() => this.initializeLocationMap(), 0);
    }

    if (modal === 'faq') {
      this.resetFaqForm();
    }
  }

  closeModal(): void {
    this.activeModal = null;
    this.destroyMap();
  }

  saveGeneral(): void {
    if (!this.isValidCompanyName(this.generalForm.nombre)) {
      this.toastr.info('El nombre de la empresa no puede estar vacío ni ser solo números.', 'Perfil de empresa');
      return;
    }

    if (this.generalForm.sitio_web.trim() && !this.isValidUrl(this.generalForm.sitio_web)) {
      this.toastr.info('El sitio web debe ser una URL válida.', 'Perfil de empresa');
      return;
    }

    if (this.generalForm.logo_url.trim() && !this.isValidUrl(this.generalForm.logo_url)) {
      this.toastr.info('La URL del logo debe ser válida.', 'Perfil de empresa');
      return;
    }

    this.persistCompanyInfo({
      nombre: this.generalForm.nombre.trim(),
      rfc: this.nullIfEmpty(this.generalForm.rfc),
      regimen_fiscal: this.nullIfEmpty(this.generalForm.regimen_fiscal),
      sitio_web: this.nullIfEmpty(this.generalForm.sitio_web),
      logo_url: this.nullIfEmpty(this.generalForm.logo_url),
    }, 'Información general actualizada.');
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    this.handleLogoFile(file);

    if (input) {
      input.value = '';
    }
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingLogo = true;
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingLogo = false;
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingLogo = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.handleLogoFile(file);
  }

  private handleLogoFile(file: File | null | undefined): void {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toastr.error('Selecciona un archivo de imagen válido.', 'Perfil de empresa');
      return;
    }

    this.isUploadingLogo = true;
    this.logoFileName = file.name;

    this.companyService.uploadCompanyLogo(file).subscribe({
      next: (response) => {
        const uploadedUrl = response?.secure_url || response?.url || response?.imageUrl || null;
        if (!uploadedUrl) {
          this.toastr.error('No se pudo obtener la URL del logo subido.', 'Perfil de empresa');
          return;
        }

        this.generalForm = {
          ...this.generalForm,
          logo_url: uploadedUrl,
        };
        this.toastr.success('Logo subido correctamente.', 'Perfil de empresa');
      },
      error: (error) => {
        this.isUploadingLogo = false;
        const message = error?.error?.message || 'No fue posible subir el logo a Cloudinary.';
        this.toastr.error(message, 'Perfil de empresa');
      },
      complete: () => {
        this.isUploadingLogo = false;
      },
    });
  }

  saveContacto(): void {
    if (this.contactoForm.telefono.trim() && !this.isValidPhone(this.contactoForm.telefono)) {
      this.toastr.info('El teléfono debe tener 10 dígitos y solo números.', 'Perfil de empresa');
      return;
    }

    if (this.contactoForm.email.trim() && !this.isValidEmail(this.contactoForm.email)) {
      this.toastr.info('El correo debe tener un formato válido.', 'Perfil de empresa');
      return;
    }

    this.persistCompanyInfo({
      telefono: this.nullIfEmpty(this.contactoForm.telefono),
      email: this.nullIfEmpty(this.contactoForm.email),
      horario_atencion: this.nullIfEmpty(this.contactoForm.horario_atencion),
    }, 'Datos de contacto actualizados.');
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const digitsOnly = (input?.value || '').replace(/\D/g, '').slice(0, 10);
    this.contactoForm = {
      ...this.contactoForm,
      telefono: digitsOnly,
    };

    if (input && input.value !== digitsOnly) {
      input.value = digitsOnly;
    }
  }

  saveHistoria(): void {
    this.persistCompanyInfo({
      mision: this.nullIfEmpty(this.historiaForm.mision),
      vision: this.nullIfEmpty(this.historiaForm.vision),
      valores: this.valoresDraft,
      facebook: this.nullIfEmpty(this.historiaForm.facebook),
      instagram: this.nullIfEmpty(this.historiaForm.instagram),
      twitter: this.nullIfEmpty(this.historiaForm.twitter),
      tiktok: this.nullIfEmpty(this.historiaForm.tiktok),
      youtube: this.nullIfEmpty(this.historiaForm.youtube),
    }, 'Contenido institucional actualizado.');
  }

  saveUbicacion(): void {
    const payload = {
      lat: Number(this.ubicacionForm.lat),
      lng: Number(this.ubicacionForm.lng),
      zoom: Number(this.ubicacionForm.zoom) || 15,
      label: this.ubicacionForm.label.trim(),
      address: this.ubicacionForm.address.trim(),
      mapsUrl: `https://www.google.com/maps?q=${this.ubicacionForm.lat},${this.ubicacionForm.lng}`,
    };

    this.persistCompanyInfo({
      mapa_ubicacion: JSON.stringify(payload),
    }, 'Ubicación actualizada.');
  }

  loadFaqs(): void {
    this.isLoadingFaqs = true;
    this.companyService.getAllFaqs().subscribe({
      next: (faqs) => {
        this.faqs = (faqs || [])
          .slice()
          .sort((a: CompanyFaq, b: CompanyFaq) => (a.orden || 0) - (b.orden || 0));
        this.applyFaqFilters();
        this.isLoadingFaqs = false;
      },
      error: () => {
        this.toastr.error('No fue posible cargar las preguntas frecuentes.', 'Perfil de empresa');
        this.isLoadingFaqs = false;
      },
    });
  }

  hasLocation(): boolean {
    return !!this.parseLocation(this.companyInfo?.mapa_ubicacion);
  }

  getLocationSummary(): string {
    const location = this.parseLocation(this.companyInfo?.mapa_ubicacion);
    if (!location) {
      return 'Aún no has configurado una ubicación exacta.';
    }

    if (location.address?.trim()) {
      return location.address.trim();
    }

    if (location.label?.trim() && location.label.trim() !== 'Sport Center') {
      return `${location.label.trim()} configurada y lista para mostrarse en la parte pública.`;
    }

    return 'La ubicación ya está configurada y lista para mostrarse a tus clientes.';
  }

  getValoresPreview(): string[] {
    return this.companyInfo?.valores?.length
      ? this.companyInfo.valores
      : ['Sin valores registrados'];
  }

  get faqSections(): string[] {
    const sections = this.faqs
      .map((faq) => faq.seccion?.trim())
      .filter((seccion): seccion is string => !!seccion);

    return ['todas', ...new Set(sections)];
  }

  get paginatedFaqs(): CompanyFaq[] {
    const start = (this.faqPage - 1) * this.faqPageSize;
    return this.filteredFaqs.slice(start, start + this.faqPageSize);
  }

  get totalFaqPages(): number {
    return Math.max(1, Math.ceil(this.filteredFaqs.length / this.faqPageSize));
  }

  get faqRangeLabel(): string {
    if (!this.filteredFaqs.length) {
      return '0 de 0';
    }

    const start = (this.faqPage - 1) * this.faqPageSize + 1;
    const end = Math.min(this.faqPage * this.faqPageSize, this.filteredFaqs.length);
    return `${start}-${end} de ${this.filteredFaqs.length}`;
  }

  addValor(): void {
    const value = this.newValor.trim();
    if (!value) {
      return;
    }

    if (this.valoresDraft.some((item) => item.toLowerCase() === value.toLowerCase())) {
      this.toastr.info('Ese valor ya está agregado.', 'Perfil de empresa');
      return;
    }

    this.valoresDraft = [...this.valoresDraft, value];
    this.newValor = '';
  }

  removeValor(index: number): void {
    const removed = this.valoresDraft[index];
    if (!removed) {
      return;
    }

    this.removedValoresHistory = [removed, ...this.removedValoresHistory].slice(0, 5);
    this.valoresDraft = this.valoresDraft.filter((_, currentIndex) => currentIndex !== index);
  }

  undoRemoveValor(): void {
    const [lastRemoved, ...rest] = this.removedValoresHistory;
    if (!lastRemoved) {
      return;
    }

    if (!this.valoresDraft.some((item) => item.toLowerCase() === lastRemoved.toLowerCase())) {
      this.valoresDraft = [...this.valoresDraft, lastRemoved];
    }
    this.removedValoresHistory = rest;
  }

  openCreateFaqModal(): void {
    this.editingFaqId = null;
    this.resetFaqForm();
    this.activeModal = 'faq';
  }

  openEditFaqModal(faq: CompanyFaq): void {
    this.editingFaqId = faq.id_faq;
    this.faqForm = {
      pregunta: faq.pregunta || '',
      respuesta: faq.respuesta || '',
      orden: faq.orden || 0,
      seccion: faq.seccion || '',
      activo: faq.activo ?? true,
      destacado: faq.destacado ?? false,
    };
    this.faqKeywordsDraft = [...(faq.palabras_clave || [])];
    this.newFaqKeyword = '';
    this.removedFaqKeywordsHistory = [];
    this.activeModal = 'faq';
  }

  saveFaq(): void {
    const payload = {
      pregunta: this.faqForm.pregunta.trim(),
      respuesta: this.faqForm.respuesta.trim(),
      orden: Number(this.faqForm.orden) || 0,
      seccion: this.nullIfEmpty(this.faqForm.seccion),
      palabras_clave: this.faqKeywordsDraft,
      activo: this.faqForm.activo,
      destacado: this.faqForm.destacado,
    };

    if (!payload.pregunta || !payload.respuesta) {
      this.toastr.info('La pregunta y la respuesta son obligatorias.', 'Perfil de empresa');
      return;
    }

    this.isSaving = true;
    const request$ = this.editingFaqId
      ? this.companyService.updateFaq(this.editingFaqId, payload)
      : this.companyService.createFaq(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.toastr.success(
          this.editingFaqId ? 'Pregunta frecuente actualizada.' : 'Pregunta frecuente creada.',
          'Perfil de empresa',
        );
        this.closeModal();
        this.loadFaqs();
      },
      error: (error) => {
        this.isSaving = false;
        const message = error?.error?.message || 'No fue posible guardar la pregunta frecuente.';
        this.toastr.error(message, 'Perfil de empresa');
      },
    });
  }

  toggleFaqStatus(faq: CompanyFaq): void {
    this.companyService.updateFaq(faq.id_faq, { activo: !faq.activo }).subscribe({
      next: () => {
        this.toastr.success(
          !faq.activo ? 'Pregunta frecuente activada.' : 'Pregunta frecuente desactivada.',
          'Perfil de empresa',
        );
        this.loadFaqs();
      },
      error: (error) => {
        const message = error?.error?.message || 'No fue posible actualizar el estado de la pregunta frecuente.';
        this.toastr.error(message, 'Perfil de empresa');
      },
    });
  }

  applyFaqFilters(): void {
    const term = this.faqSearchTerm.trim().toLowerCase();

    this.filteredFaqs = this.faqs.filter((faq) => {
      const matchesSearch = !term
        || faq.pregunta?.toLowerCase().includes(term)
        || faq.respuesta?.toLowerCase().includes(term)
        || faq.seccion?.toLowerCase().includes(term)
        || (faq.palabras_clave || []).some((keyword) => keyword.toLowerCase().includes(term));

      const matchesSection = this.faqSeccionFilter === 'todas'
        || faq.seccion === this.faqSeccionFilter;

      const matchesActivo = this.faqActivoFilter === 'todas'
        || (this.faqActivoFilter === 'activas' ? faq.activo : !faq.activo);

      return matchesSearch && matchesSection && matchesActivo;
    });

    this.faqPage = 1;
  }

  clearFaqFilters(): void {
    this.faqSearchTerm = '';
    this.faqSeccionFilter = 'todas';
    this.faqActivoFilter = 'todas';
    this.applyFaqFilters();
  }

  goToFaqPage(page: number): void {
    if (page < 1 || page > this.totalFaqPages) {
      return;
    }

    this.faqPage = page;
  }

  addFaqKeyword(): void {
    const value = this.newFaqKeyword.trim();
    if (!value) {
      return;
    }

    if (this.faqKeywordsDraft.some((item) => item.toLowerCase() === value.toLowerCase())) {
      this.toastr.info('Esa palabra clave ya está agregada.', 'Perfil de empresa');
      return;
    }

    this.faqKeywordsDraft = [...this.faqKeywordsDraft, value];
    this.newFaqKeyword = '';
  }

  removeFaqKeyword(index: number): void {
    const removed = this.faqKeywordsDraft[index];
    if (!removed) {
      return;
    }

    this.removedFaqKeywordsHistory = [removed, ...this.removedFaqKeywordsHistory].slice(0, 5);
    this.faqKeywordsDraft = this.faqKeywordsDraft.filter((_, currentIndex) => currentIndex !== index);
  }

  undoRemoveFaqKeyword(): void {
    const [lastRemoved, ...rest] = this.removedFaqKeywordsHistory;
    if (!lastRemoved) {
      return;
    }

    if (!this.faqKeywordsDraft.some((item) => item.toLowerCase() === lastRemoved.toLowerCase())) {
      this.faqKeywordsDraft = [...this.faqKeywordsDraft, lastRemoved];
    }
    this.removedFaqKeywordsHistory = rest;
  }

  private persistCompanyInfo(payload: Partial<CompanyInfo>, successMessage: string): void {
    this.isSaving = true;

    const request$ = this.companyInfo?.id_empresa
      ? this.companyService.updateCompanyInfo(payload)
      : this.companyService.createCompanyInfo({
          nombre: payload.nombre?.trim() || this.generalForm.nombre.trim() || 'Sport Center',
          ...payload,
        });

    request$.subscribe({
      next: (info) => {
        this.companyInfo = info;
        this.isSaving = false;
        this.toastr.success(successMessage, 'Perfil de empresa');
        this.closeModal();
      },
      error: (error) => {
        this.isSaving = false;
        const message = error?.error?.message || 'No fue posible guardar la información de la empresa.';
        this.toastr.error(message, 'Perfil de empresa');
      },
    });
  }

  private resetFaqForm(): void {
    this.editingFaqId = null;
    this.faqForm = {
      pregunta: '',
      respuesta: '',
      orden: this.faqs.length + 1,
      seccion: '',
      activo: true,
      destacado: false,
    };
    this.faqKeywordsDraft = [];
    this.newFaqKeyword = '';
    this.removedFaqKeywordsHistory = [];
  }

  private initializeLocationMap(): void {
    this.destroyMap();

    const style = environment.maptilerApiKey
      ? `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`
      : 'https://demotiles.maplibre.org/style.json';

    this.map = new maplibregl.Map({
      container: 'company-location-map',
      style,
      center: [this.ubicacionForm.lng, this.ubicacionForm.lat],
      zoom: this.ubicacionForm.zoom || 15,
      cooperativeGestures: true,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    this.map.dragRotate.disable();

    this.map.on('click', (event) => {
      const { lng, lat } = event.lngLat;
      this.ubicacionForm = {
        ...this.ubicacionForm,
        lng: Number(lng.toFixed(6)),
        lat: Number(lat.toFixed(6)),
      };
      this.setLocationMarker(lng, lat);
    });

    this.map.on('zoomend', () => {
      if (!this.map) {
        return;
      }

      this.ubicacionForm = {
        ...this.ubicacionForm,
        zoom: Number(this.map.getZoom().toFixed(2)),
      };
    });

    this.map.on('load', () => {
      this.refreshMapViewport();
      this.setLocationMarker(this.ubicacionForm.lng, this.ubicacionForm.lat);
    });

    requestAnimationFrame(() => this.refreshMapViewport());
    setTimeout(() => this.refreshMapViewport(), 120);
  }

  private setLocationMarker(lng: number, lat: number): void {
    if (!this.map) {
      return;
    }

    if (!this.locationMarker) {
      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: true,
        closeOnClick: false,
        className: 'company-location-popup',
      }).setHTML(this.getPopupHtml());

      this.locationMarker = new maplibregl.Marker({
        color: '#0367A6',
        draggable: true,
        anchor: 'bottom',
      })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(this.map);

      this.locationMarker.on('dragend', () => {
        const markerPosition = this.locationMarker?.getLngLat();
        if (!markerPosition) {
          return;
        }

        this.ubicacionForm = {
          ...this.ubicacionForm,
          lng: Number(markerPosition.lng.toFixed(6)),
          lat: Number(markerPosition.lat.toFixed(6)),
        };
        this.refreshMarkerPopup();
      });

      this.map.once('idle', () => this.openMarkerPopup());

      return;
    }

    this.locationMarker.setLngLat([lng, lat]);
    this.refreshMarkerPopup();
    this.map.easeTo({
      center: [lng, lat],
      duration: 220,
    });

    this.map.once('moveend', () => this.openMarkerPopup());
  }

  onLocationCoordinateChange(): void {
    const lat = Number(this.ubicacionForm.lat);
    const lng = Number(this.ubicacionForm.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.map) {
      return;
    }

    this.ubicacionForm = {
      ...this.ubicacionForm,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };

    this.setLocationMarker(this.ubicacionForm.lng, this.ubicacionForm.lat);
    this.map.easeTo({
      center: [this.ubicacionForm.lng, this.ubicacionForm.lat],
      duration: 240,
    });
  }

  private destroyMap(): void {
    this.locationMarker?.remove();
    this.locationMarker = null;
    this.map?.remove();
    this.map = null;
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
          label: parsed.label || 'Sport Center',
          address: parsed.address || '',
          mapsUrl: parsed.mapsUrl || `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private getDefaultLocation(): CompanyLocationData {
    return {
      lat: 21.155931,
      lng: -98.381103,
      zoom: 15,
      label: 'Sport Center',
      address: '',
      mapsUrl: 'https://www.google.com/maps',
    };
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  isValidCompanyName(value: string | null | undefined): boolean {
    const normalized = value?.trim() || '';
    return !!normalized && !/^\d+$/.test(normalized);
  }

  isValidUrl(value: string | null | undefined): boolean {
    const normalized = value?.trim() || '';
    if (!normalized) {
      return true;
    }

    try {
      const parsed = new URL(normalized);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  isValidPhone(value: string | null | undefined): boolean {
    const normalized = value?.trim() || '';
    return /^\d{10}$/.test(normalized);
  }

  isValidEmail(value: string | null | undefined): boolean {
    const normalized = value?.trim() || '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }

  private getPopupHtml(): string {
    const companyName = this.companyInfo?.nombre || this.generalForm.nombre || 'Sport Center';
    const phone = this.companyInfo?.telefono || this.contactoForm.telefono || 'Sin teléfono';
    const horario = this.companyInfo?.horario_atencion || this.contactoForm.horario_atencion || 'Horario pendiente';
    const address = this.ubicacionForm.address || 'Ubicación configurada manualmente';

    return `
      <div style="min-width:220px;font-family:inherit;">
        <strong style="display:block;color:#203044;font-size:15px;margin-bottom:6px;">${companyName}</strong>
        <p style="margin:0 0 6px;color:#4b5d73;font-size:13px;">${address}</p>
        <p style="margin:0 0 4px;color:#203044;font-size:13px;"><strong>Tel:</strong> ${phone}</p>
        <p style="margin:0;color:#203044;font-size:13px;white-space:pre-line;"><strong>Horario:</strong> ${horario}</p>
      </div>
    `;
  }

  private refreshMarkerPopup(): void {
    if (!this.locationMarker) {
      return;
    }

    const popup = this.locationMarker.getPopup();
    popup?.setHTML(this.getPopupHtml());
  }

  private refreshMapViewport(): void {
    if (!this.map) {
      return;
    }

    this.map.resize();
    this.map.jumpTo({
      center: [this.ubicacionForm.lng, this.ubicacionForm.lat],
      zoom: this.ubicacionForm.zoom || 15,
    });
  }

  private openMarkerPopup(): void {
    if (!this.locationMarker) {
      return;
    }

    const popup = this.locationMarker.getPopup();
    if (!popup?.isOpen()) {
      this.locationMarker.togglePopup();
    }
  }
}
