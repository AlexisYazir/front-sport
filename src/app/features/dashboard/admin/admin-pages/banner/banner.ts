import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { CompanyService, HomeBannerImage } from '../../../../../core/services/company.service';

@Component({
  selector: 'app-banner-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './banner.html',
  styleUrl: './banner.css',
})
export class BannerAdmin implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly toastr = inject(ToastrService);
  private readonly maxBannerOrder = 4;

  banners = signal<HomeBannerImage[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  uploading = signal(false);
  savingBannerId = signal<number | null>(null);
  pendingDelete = signal<HomeBannerImage | null>(null);
  pendingOrders = signal<Record<number, number>>({});

  activeCount = computed(() => this.banners().filter((banner) => banner.activo).length);

  form: Partial<HomeBannerImage> = {
    url_imagen: '',
    cloudinary_public_id: '',
    titulo: '',
    descripcion: '',
    alt_text: '',
    orden: 1,
    activo: true,
  };

  ngOnInit(): void {
    this.loadBanners();
  }

  loadBanners(): void {
    this.isLoading.set(true);
    this.companyService.getAdminBannerImages().subscribe({
      next: (banners) => {
        this.banners.set(banners || []);
        this.ensureNextOrder();
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.toastr.error(error?.error?.message || 'No fue posible cargar el banner', 'Banner');
      },
    });
  }

  uploadImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toastr.warning('Selecciona una imagen válida', 'Banner');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.companyService.uploadBannerImage(file).subscribe({
      next: (response) => {
        const url = response?.secure_url || response?.url || '';
        if (!url) {
          this.toastr.error('Cloudinary no devolvió URL de imagen', 'Banner');
          return;
        }

        this.form = {
          ...this.form,
          url_imagen: url,
          cloudinary_public_id: response?.public_id || '',
          titulo: this.form.titulo || file.name.replace(/\.[^.]+$/, ''),
          alt_text: this.form.alt_text || 'Banner principal Sport Center',
          orden: this.getNextOrder(),
        };
        this.uploading.set(false);
        this.toastr.success('Imagen subida a Cloudinary', 'Banner');
      },
      error: (error) => {
        this.uploading.set(false);
        this.toastr.error(error?.error?.message || 'No fue posible subir la imagen', 'Banner');
      },
      complete: () => {
        input.value = '';
      },
    });
  }

  createBanner(): void {
    if (!this.form.url_imagen?.trim()) {
      this.toastr.warning('Sube una imagen o pega una URL', 'Banner');
      return;
    }

    if (this.form.activo && this.activeCount() >= 4) {
      this.toastr.warning('Solo puedes tener máximo 4 imágenes activas', 'Banner');
      return;
    }

    const requestedOrder = Number(this.form.orden) || this.getNextOrder();
    if (!this.isValidOrderRange(requestedOrder)) return;

    const availableOrder = this.getAvailableOrder(requestedOrder);
    if (!availableOrder) {
      this.toastr.warning('Ya están ocupados los 4 órdenes disponibles del banner', 'Banner');
      return;
    }

    this.isSaving.set(true);
    const payload = this.normalizePayload({
      ...this.form,
      orden: availableOrder,
    });

    this.companyService.createBannerImage(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.resetForm();
        this.toastr.success('Imagen agregada al banner', 'Banner');
        this.loadBanners();
      },
      error: (error) => {
        this.isSaving.set(false);
        this.toastr.error(error?.error?.message || 'No fue posible guardar la imagen', 'Banner');
      },
    });
  }

  toggleActive(banner: HomeBannerImage): void {
    const nextActive = !banner.activo;
    if (nextActive && this.activeCount() >= 4) {
      this.toastr.warning('Solo puedes tener máximo 4 imágenes activas', 'Banner');
      return;
    }

    this.updateBanner(banner, { activo: nextActive });
  }

  updateOrder(banner: HomeBannerImage, value: string | number): void {
    const order = Math.max(1, Math.floor(Number(value) || 1));
    this.pendingOrders.update((current) => ({
      ...current,
      [banner.id_banner]: order,
    }));
  }

  hasOrderChange(banner: HomeBannerImage): boolean {
    const pendingOrder = this.pendingOrders()[banner.id_banner];
    return pendingOrder !== undefined && Number(pendingOrder) !== Number(banner.orden);
  }

  getOrderValue(banner: HomeBannerImage): number {
    const pendingOrder = this.pendingOrders()[banner.id_banner];
    return pendingOrder === undefined ? Number(banner.orden) : pendingOrder;
  }

  saveOrder(banner: HomeBannerImage): void {
    const nextOrder = this.pendingOrders()[banner.id_banner];
    if (!nextOrder || Number(nextOrder) === Number(banner.orden)) return;

    if (!this.isValidOrderRange(nextOrder)) return;

    if (this.isOrderDuplicated(nextOrder, banner.id_banner)) {
      this.toastr.warning(`El orden ${nextOrder} ya está usado por otra imagen`, 'Banner');
      return;
    }

    this.updateBanner(banner, { orden: nextOrder });
  }

  deleteBanner(banner: HomeBannerImage): void {
    this.pendingDelete.set(banner);
  }

  confirmDeleteBanner(): void {
    const banner = this.pendingDelete();
    if (!banner) return;
    this.savingBannerId.set(banner.id_banner);
    this.companyService.deleteBannerImage(banner.id_banner).subscribe({
      next: () => {
        this.savingBannerId.set(null);
        this.pendingDelete.set(null);
        this.toastr.success('Imagen eliminada', 'Banner');
        this.loadBanners();
      },
      error: (error) => {
        this.savingBannerId.set(null);
        this.toastr.error(error?.error?.message || 'No fue posible eliminar la imagen', 'Banner');
      },
    });
  }

  cancelDeleteBanner(): void {
    if (this.savingBannerId()) return;
    this.pendingDelete.set(null);
  }

  private updateBanner(banner: HomeBannerImage, changes: Partial<HomeBannerImage>): void {
    if (this.savingBannerId()) return;

    this.savingBannerId.set(banner.id_banner);
    this.companyService.updateBannerImage(banner.id_banner, this.normalizePayload(changes)).subscribe({
      next: (updated) => {
        this.banners.set(
          this.banners().map((item) => (item.id_banner === updated.id_banner ? updated : item)),
        );
        if (changes.orden !== undefined) {
          this.pendingOrders.update((current) => {
            const next = { ...current };
            delete next[banner.id_banner];
            return next;
          });
        }
        this.savingBannerId.set(null);
        this.toastr.success('Banner actualizado', 'Banner');
        this.loadBanners();
      },
      error: (error) => {
        this.savingBannerId.set(null);
        this.toastr.error(error?.error?.message || 'No fue posible actualizar el banner', 'Banner');
      },
    });
  }

  private normalizePayload(data: Partial<HomeBannerImage>): Partial<HomeBannerImage> {
    const payload: Partial<HomeBannerImage> = { ...data };

    if (data.titulo !== undefined) payload.titulo = data.titulo?.trim() || null;
    if (data.descripcion !== undefined) payload.descripcion = data.descripcion?.trim() || null;
    if (data.alt_text !== undefined) payload.alt_text = data.alt_text?.trim() || null;
    if (data.cloudinary_public_id !== undefined) {
      payload.cloudinary_public_id = data.cloudinary_public_id?.trim() || null;
    }
    if (data.orden !== undefined) payload.orden = Number(data.orden) || 1;
    if (data.activo !== undefined) payload.activo = data.activo === true;

    return payload;
  }

  private resetForm(): void {
    this.form = {
      url_imagen: '',
      cloudinary_public_id: '',
      titulo: '',
      descripcion: '',
      alt_text: '',
      orden: this.getNextOrder(),
      activo: this.activeCount() < 4,
    };
  }

  private ensureNextOrder(): void {
    if (!this.form.orden || Number(this.form.orden) <= 1) {
      this.form = {
        ...this.form,
        orden: this.getNextOrder(),
      };
    }
  }

  private getNextOrder(): number {
    const maxOrder = this.banners().reduce((max, banner) => {
      const order = Number(banner.orden) || 0;
      return Math.max(max, order);
    }, 0);

    return Math.min(maxOrder + 1, this.maxBannerOrder);
  }

  private getAvailableOrder(preferredOrder: number): number | null {
    const usedOrders = new Set(this.banners().map((banner) => Number(banner.orden) || 0));
    let order = Math.max(1, Math.floor(preferredOrder));

    while (usedOrders.has(order) && order < this.maxBannerOrder) {
      order += 1;
    }

    return usedOrders.has(order) ? null : order;
  }

  private isOrderDuplicated(order: number, currentBannerId: number): boolean {
    return this.banners().some(
      (banner) => banner.id_banner !== currentBannerId && Number(banner.orden) === Number(order),
    );
  }

  private isValidOrderRange(order: number): boolean {
    if (order < 1 || order > this.maxBannerOrder) {
      this.toastr.warning(`El orden debe estar entre 1 y ${this.maxBannerOrder}`, 'Banner');
      return false;
    }

    return true;
  }
}
