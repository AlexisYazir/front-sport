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
    <nav class="mb-6" aria-label="Breadcrumb" *ngIf="items().length > 0">
      <div class="inline-block bg-white/40 backdrop-blur-[2px] px-3 py-1.5 rounded-full shadow-sm border border-white/30">
        <ol class="flex items-center flex-wrap gap-0.5">
          <!-- Home Item -->
          <li class="flex items-center">
            <a routerLink="/" 
               class="breadcrumb-link flex items-center text-xs sm:text-sm font-medium text-gray-600 hover:text-[#0367A6] transition-colors px-1.5 py-0.5 rounded-full">
              <span class="material-symbols-outlined text-base sm:text-lg mr-0.5 text-gray-500">home</span>
              <span class="hidden sm:inline">Inicio</span>
            </a>
          </li>

          <!-- Dynamic Items -->
          <li *ngFor="let item of items(); let isLast = last" 
              class="flex items-center"
              [attr.aria-current]="isLast ? 'page' : null">
            
            <!-- Separator with fade -->
            <span class="breadcrumb-separator flex items-center text-gray-300 mx-0.5">
              <span class="material-symbols-outlined text-sm sm:text-base">chevron_right</span>
            </span>

            <!-- Item Content -->
            <ng-container *ngIf="item.url && !isLast; else staticItem">
              <a [routerLink]="item.url" 
                 class="breadcrumb-link flex items-center text-xs sm:text-sm font-medium text-gray-700 hover:text-[#0367A6] transition-colors px-1.5 py-0.5 rounded-full">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined text-base sm:text-lg mr-0.5 text-gray-500">
                  {{ item.icon }}
                </span>
                <span class="breadcrumb-text">{{ item.label }}</span>
              </a>
            </ng-container>

            <ng-template #staticItem>
              <span class="flex items-center text-xs sm:text-sm font-medium px-1.5 py-0.5 rounded-full"
                    [ngClass]="isLast ? 'text-[#0367A6] font-semibold bg-white/60' : 'text-gray-600'">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined text-base sm:text-lg mr-0.5"
                      [ngClass]="isLast ? 'text-[#0367A6]' : 'text-gray-400'">
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
    /* Container with subtle white background - fits content */
    .inline-block {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(2px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;
    }

    .inline-block:hover {
      background: rgba(255, 255, 255, 0.6);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
    }

    /* Base styles */
    .breadcrumb-link {
      position: relative;
      transition: all 0.2s ease;
    }

    .breadcrumb-link:hover {
      background: rgba(3, 103, 166, 0.05);
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
      background: linear-gradient(90deg, #0367A6, #035A91);
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
      transition: all 0.2s ease;
    }

    li:hover .breadcrumb-separator {
      color: #0367A6;
      transform: translateX(1px);
    }

    /* Active/current page styling */
    [aria-current="page"] span:last-child {
      font-weight: 600;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .inline-block {
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
      color: #035A91;
    }

    /* Ensure the container only takes the width it needs */
    .inline-block {
      width: fit-content;
      max-width: 100%;
    }

    /* Allow wrapping on small screens */
    ol {
      flex-wrap: wrap;
    }

    /* Subtle background for current item */
    [aria-current="page"] {
      background: rgba(3, 103, 166, 0.04);
      border-radius: 9999px;
    }
  `]
})
export class Breadcrumbs {
  items = input.required<BreadcrumbItem[]>();
  
  // Computed property para mostrar solo si hay items
  hasItems = computed(() => this.items().length > 0);
}