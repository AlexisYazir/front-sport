import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductReviewAdmin } from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class ReviewsPage implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);

  reviews = signal<ProductReviewAdmin[]>([]);
  isLoading = signal(false);

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
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading.set(true);
    this.productService.getAllReviewsAdmin().subscribe({
      next: (reviews) => {
        this.reviews.set(reviews);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar las reseñas', 'Reseñas');
      },
    });
  }

  refresh(): void {
    this.productService.clearRequestCache();
    this.loadReviews();
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
