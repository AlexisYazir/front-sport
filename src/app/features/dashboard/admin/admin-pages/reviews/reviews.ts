import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ProductReviewAdmin, ReviewModerationAction, ReviewModerationDetail, ReviewReport, ReviewReportFilter } from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { UserRole } from '../../../../../core/models/user.model';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';
import { IconModule } from '../../../../../shared/icons/icon.module';


@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [IconModule, CommonModule, FormsModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class ReviewsPage implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);
  private readonly auth = inject(AuthService);

  reviews = signal<ProductReviewAdmin[]>([]);
  isLoading = signal(false);
  loadError = signal('');
  reports = signal<ReviewReport[]>([]);
  reportFilter = signal<ReviewReportFilter>('pendiente');
  reportPage = signal(1);
  reportTotal = signal(0);
  readonly reportPageSize = 20;
  reportsLoading = signal(false);
  reportsError = signal('');
  moderation = signal<ReviewModerationDetail | null>(null);
  moderationLoading = signal(false);
  moderationError = signal('');
  decisionAction = signal<ReviewModerationAction>('conservar');
  decisionReason = signal('');
  selectedReportId = signal<number | null>(null);
  isSaving = signal(false);
  decisionNeedsReload = signal(false);
  accessDenied = signal(false);
  private selectedReviewId: number | null = null;
  private adminIdentity: string | null = null;
  private readonly subscriptions = new Subscription();
  private detailSubscription?: Subscription;
  private reportsSubscription?: Subscription;
  reportPages = computed(() => Math.max(1, Math.ceil(this.reportTotal() / this.reportPageSize)));
  canSave = computed(() => !!this.moderation() && !this.accessDenied() && !this.moderationLoading() && !this.isSaving()
    && !this.decisionNeedsReload() && this.decisionReason().trim().length > 0
    && this.decisionReason().trim().length <= 1000);

  searchTerm = signal('');
  selectedRating = signal('all');
  selectedProductId = signal('all');
  currentPage = signal(1);
  readonly pageSize = 10;
  readonly stars = [1, 2, 3, 4, 5];

  filteredReviews = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const rating = this.selectedRating();
    const productId = this.selectedProductId();

    return this.reviews().filter((review) => {
      const matchesRating =
        rating === 'all' || Number(review.calificacion) === Number(rating);
      const matchesProduct =
        productId === 'all' || Number(review.id_producto) === Number(productId);

      const matchesSearch =
        !search ||
        [
          review.producto,
          review.usuario,
          review.email,
          review.comentario,
          String(review.id_producto),
          String(review.id_review),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesRating && matchesProduct && matchesSearch;
    });
  });

  productOptions = computed(() => {
    const products = new Map<number, string>();

    for (const review of this.reviews()) {
      products.set(
        review.id_producto,
        review.producto || `Producto #${review.id_producto}`,
      );
    }

    return Array.from(products.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  paginatedReviews = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredReviews().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredReviews().length / this.pageSize)),
  );

  averageRating = computed(() => {
    const items = this.reviews();
    if (!items.length) return 0;
    const total = items.reduce((sum, review) => sum + Number(review.calificacion), 0);
    return total / items.length;
  });

  ngOnInit(): void {
    this.subscriptions.add(this.auth.currentUser$().subscribe(user => {
      const identity = user ? String(user.id ?? user.email) : null;
      if (!user || user.rol !== UserRole.ADMIN || (this.adminIdentity !== null && identity !== this.adminIdentity)) {
        this.denyAccess();
        this.loadError.set('La sesión administradora cambió. Vuelve a acceder para revisar las reseñas.');
      } else {
        this.adminIdentity = identity;
      }
    }));
    this.loadReviews();
    this.loadReports();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.detailSubscription?.unsubscribe();
    this.reportsSubscription?.unsubscribe();
    this.reviews.set([]);
    this.reports.set([]);
    this.moderation.set(null);
    this.decisionReason.set('');
    this.selectedReportId.set(null);
    this.productService.clearRequestCache();
  }

  loadReviews(): void {
    if (this.accessDenied()) return;
    this.isLoading.set(true);
    this.loadError.set('');
    this.subscriptions.add(this.productService.getAllReviewsAdmin().subscribe({
      next: (reviews) => {
        if (this.accessDenied()) return;
        this.reviews.set(reviews);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.loadError.set(this.errorText(error, 'No fue posible cargar las reseñas.'));
      },
    }));
  }

  refresh(): void {
    if (this.isSaving() || this.accessDenied()) return;
    this.productService.clearRequestCache();
    this.loadReviews();
    this.loadReports();
  }

  loadReports(page = this.reportPage()): void {
    if (this.isSaving() || this.accessDenied()) return;
    this.reportsSubscription?.unsubscribe();
    this.reportPage.set(Math.min(Math.max(1, page), this.reportPages()));
    this.reportsLoading.set(true);
    this.reportsError.set('');
    this.reportsSubscription = this.productService.getReviewReports(this.reportFilter(), this.reportPage(), this.reportPageSize).subscribe({
      next: (result) => {
        if (this.accessDenied()) return;
        this.reportTotal.set(result.total);
        const lastPage = Math.max(1, Math.ceil(result.total / this.reportPageSize));
        if (result.page > lastPage && this.reportPage() !== lastPage) {
          this.loadReports(lastPage);
          return;
        }
        this.reports.set(result.items);
        this.reportPage.set(result.page);
        this.reportsLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.reports.set([]);
        this.reportsLoading.set(false);
        this.reportsError.set(this.errorText(error, 'No fue posible cargar los reportes.'));
      },
    });
  }

  changeReportFilter(value: ReviewReportFilter): void {
    if (this.isSaving()) return;
    this.reportFilter.set(value);
    this.loadReports(1);
  }

  openReport(report: ReviewReport): void {
    if (!report.referencia_valida || !report.id_review || this.isSaving() || this.accessDenied()) return;
    this.openModeration(report.id_review, report.id_mensaje);
  }

  openModeration(id: number, reportId: number | null = null): void {
    if (this.isSaving() || this.accessDenied()) return;
    this.selectedReviewId = id;
    this.selectedReportId.set(reportId);
    this.decisionAction.set('conservar');
    this.decisionReason.set('');
    this.reloadModeration();
  }

  reloadModeration(): void {
    if (this.isSaving() || this.accessDenied() || this.selectedReviewId === null) return;
    this.detailSubscription?.unsubscribe();
    this.moderation.set(null);
    this.moderationLoading.set(true);
    this.moderationError.set('');
    this.detailSubscription = this.productService.getReviewModeration(this.selectedReviewId).subscribe({
      next: (detail) => {
        if (this.accessDenied()) return;
        if (!this.validDetail(detail, this.selectedReviewId)) {
          this.moderationLoading.set(false);
          this.decisionNeedsReload.set(true);
          this.moderationError.set('El servidor no devolvió una revisión válida. No se puede guardar una decisión.');
          return;
        }
        this.moderation.set(detail);
        const reportId = this.selectedReportId();
        if (reportId !== null && !this.hasReport(detail, reportId)) {
          this.decisionNeedsReload.set(true);
          this.moderationLoading.set(false);
          this.moderationError.set('El folio ya no corresponde a esta reseña. Revisa su referencia antes de tomar una decisión.');
          return;
        }
        this.decisionNeedsReload.set(false);
        this.moderationLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.moderationLoading.set(false);
        this.decisionNeedsReload.set(true);
        this.moderationError.set(this.errorText(error, 'No fue posible cargar la revisión.'));
      },
    });
  }

  closeModeration(): void {
    if (this.isSaving()) return;
    this.detailSubscription?.unsubscribe();
    this.selectedReviewId = null;
    this.moderation.set(null);
    this.moderationLoading.set(false);
    this.moderationError.set('');
    this.selectedReportId.set(null);
  }

  saveModeration(): void {
    const detail = this.moderation();
    if (!detail || !this.canSave()) return;
    const accion = this.decisionAction();
    if ((accion === 'retirar' && detail.review.retirada) || (accion === 'restaurar' && !detail.review.retirada)) return;
    const reportId = this.selectedReportId();
    if (reportId !== null && !this.hasReport(detail, reportId)) return;
    this.isSaving.set(true);
    this.moderationError.set('');
    this.subscriptions.add(this.productService.moderateReview(detail.review.id_review, {
      accion, motivo: this.decisionReason().trim(), revision_esperada: detail.review.revision,
      ...(reportId === null ? {} : { id_mensaje: reportId }),
    }).subscribe({
      next: (updated) => {
        const visibility = accion === 'conservar' ? detail.review.retirada : accion === 'retirar';
        if (!this.validDetail(updated, detail.review.id_review)
          || updated.review.revision !== detail.review.revision + 1 || updated.review.retirada !== visibility) {
          this.isSaving.set(false);
          this.decisionNeedsReload.set(true);
          this.moderationError.set('No pudimos comprobar la respuesta de la decisión. Actualiza el detalle y revisa el historial antes de continuar.');
          return;
        }
        this.moderation.set(updated);
        this.decisionAction.set('conservar');
        this.decisionReason.set('');
        this.isSaving.set(false);
        this.toastr.success('La decisión quedó registrada en el historial.', 'Moderación');
        this.loadReviews();
        this.loadReports();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.decisionNeedsReload.set(true);
        this.moderationError.set(this.errorText(error, error.status === 409
          ? 'La reseña cambió durante la revisión. Actualiza el detalle y revisa el historial antes de decidir de nuevo.'
          : 'No pudimos confirmar la decisión. Actualiza el detalle y consulta el historial antes de volver a enviarla.'));
      },
    }));
  }

  private errorText(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 401 || error.status === 403) {
      this.denyAccess();
      return 'No tienes permiso para consultar o moderar estas reseñas. Accede con una cuenta administradora.';
    }
    return fallback;
  }

  private validDetail(detail: ReviewModerationDetail, id: number | null): boolean {
    return detail?.review?.id_review === id && Number.isSafeInteger(detail.review.revision)
      && detail.review.revision >= 0 && typeof detail.review.retirada === 'boolean'
      && Array.isArray(detail.reports) && Array.isArray(detail.history);
  }

  private hasReport(detail: ReviewModerationDetail, id: number): boolean {
    return detail.reports.some(report => report.id_mensaje === id && report.referencia_valida
      && report.id_review === detail.review.id_review && report.id_producto === detail.review.id_producto);
  }

  private denyAccess(): void {
    this.accessDenied.set(true);
    this.productService.clearRequestCache();
    this.subscriptions.unsubscribe();
    this.reportsSubscription?.unsubscribe();
    this.detailSubscription?.unsubscribe();
    this.reviews.set([]);
    this.reports.set([]);
    this.reportTotal.set(0);
    this.isLoading.set(false);
    this.reportsLoading.set(false);
    this.moderationLoading.set(false);
    this.moderation.set(null);
    this.selectedReviewId = null;
    this.selectedReportId.set(null);
    this.decisionReason.set('');
  }

  onFiltersChange(): void {
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedRating.set('all');
    this.selectedProductId.set('all');
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  formatDate(date: string): string {
    return formatMexicoDateTime(date);
  }

  ratingCount(rating: number): number {
    return this.reviews().filter((review) => Number(review.calificacion) === rating).length;
  }

  isStarFilled(star: number, rating: number): boolean {
    return star <= rating;
  }

  getRatingText(rating: number): string {
    if (rating === 1) return '1 estrella';
    return `${rating} estrellas`;
  }

  get firstItem(): number {
    if (this.filteredReviews().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filteredReviews().length);
  }
}
