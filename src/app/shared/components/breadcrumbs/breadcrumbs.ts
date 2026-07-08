import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  url?: string;
  icon?: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="mb-3" aria-label="Breadcrumb" *ngIf="items().length > 0">
      <div class="breadcrumb-shell inline-block px-2.5 py-1 rounded-full">
        <ol class="flex items-center flex-wrap gap-0.5">
          <!-- Home Item -->
          <li class="flex items-center">
            <a routerLink="/" 
               class="breadcrumb-link flex items-center text-[11px] sm:text-xs font-medium transition-colors px-1.5 py-0.5 rounded-full">
              <span class="material-symbols-outlined text-sm sm:text-base mr-0.5">home</span>
              <span class="hidden sm:inline">Inicio</span>
            </a>
          </li>

          <!-- Dynamic Items -->
          <li *ngFor="let item of items(); let isLast = last" 
              class="flex items-center"
              [attr.aria-current]="isLast ? 'page' : null">
            
            <!-- Separator with fade -->
            <span class="breadcrumb-separator flex items-center mx-0.5">
              <span class="material-symbols-outlined text-xs sm:text-sm">chevron_right</span>
            </span>

            <!-- Item Content -->
            <ng-container *ngIf="item.url && !isLast; else staticItem">
              <a [routerLink]="item.url" 
                 class="breadcrumb-link flex items-center text-[11px] sm:text-xs font-medium transition-colors px-1.5 py-0.5 rounded-full">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined text-sm sm:text-base mr-0.5">
                  {{ item.icon }}
                </span>
                <span class="breadcrumb-text">{{ item.label }}</span>
              </a>
            </ng-container>

            <ng-template #staticItem>
              <span class="breadcrumb-static flex items-center text-[11px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full"
                    [ngClass]="isLast ? 'breadcrumb-current font-semibold' : ''">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined text-sm sm:text-base mr-0.5">
                  {{ item.icon }}
                </span>
                <span class="breadcrumb-text">{{ item.label }}</span>
              </span>
            </ng-template>
          </li>
        </ol>
      </div>
    </nav>
  `,
  styles: [`
    .breadcrumb-shell {
      color: inherit;
      background: rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: none;
      transition: all 0.2s ease;
    }

    .breadcrumb-shell:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Base styles */
    .breadcrumb-link {
      position: relative;
      transition: all 0.2s ease;
      color: inherit;
      opacity: 0.72;
    }

    .breadcrumb-link:hover {
      background: rgba(255, 255, 255, 0.16);
      opacity: 1;
    }

    /* Subtle underline animation - only on hover */
    .breadcrumb-link::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 1.5px;
      background: currentColor;
      transition: width 0.2s ease;
      border-radius: 2px;
      opacity: 0.6;
    }

    .breadcrumb-link:hover::after {
      width: 70%;
    }

    /* Text animation */
    .breadcrumb-text {
      display: inline-block;
      transition: transform 0.2s ease;
    }

    .breadcrumb-link:hover .breadcrumb-text {
      transform: translateX(1px);
    }

    /* Icon animation */
    .breadcrumb-link .material-symbols-outlined {
      transition: transform 0.2s ease;
    }

    .breadcrumb-link:hover .material-symbols-outlined {
      transform: scale(1.05);
    }

    /* Separator animation */
    .breadcrumb-separator {
      opacity: 0.34;
      transition: all 0.2s ease;
    }

    li:hover .breadcrumb-separator {
      opacity: 0.7;
      transform: translateX(1px);
    }

    .breadcrumb-static {
      color: inherit;
      opacity: 0.74;
    }

    .breadcrumb-current {
      background: rgba(255, 255, 255, 0.18);
      opacity: 1;
    }

    /* Active/current page styling */
    [aria-current="page"] span:last-child {
      font-weight: 600;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .breadcrumb-shell {
        padding: 0.5rem 0.75rem;
        border-radius: 9999px;
      }
      
      .breadcrumb-text {
        font-size: 0.7rem;
      }
      
      .material-symbols-outlined {
        font-size: 0.9rem;
      }
    }

    /* Fade in animation */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    nav {
      animation: fadeIn 0.3s ease-out;
    }

    /* Hover effect for active item */
    [aria-current="page"]:hover span:last-child {
      color: inherit;
    }

    /* Ensure the container only takes the width it needs */
    .breadcrumb-shell {
      width: fit-content;
      max-width: 100%;
    }

    /* Allow wrapping on small screens */
    ol {
      flex-wrap: wrap;
    }

    /* Subtle background for current item */
    [aria-current="page"] { border-radius: 9999px; }
  `]
})
export class Breadcrumbs {
  items = input.required<BreadcrumbItem[]>();
  
  // Computed property para mostrar solo si hay items
  hasItems = computed(() => this.items().length > 0);
}
