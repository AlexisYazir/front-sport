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
    <nav class="breadcrumb-nav" aria-label="Breadcrumb" *ngIf="items().length > 0">
      <div class="breadcrumb-shell">
        <ol class="breadcrumb-list">
          <!-- Home Item -->
          <li class="flex items-center">
            <a routerLink="/" 
               class="breadcrumb-link">
              <span class="material-symbols-outlined">home</span>
              <span class="hidden sm:inline">Inicio</span>
            </a>
          </li>

          <!-- Dynamic Items -->
          <li *ngFor="let item of items(); let isLast = last" 
              class="flex items-center"
              [attr.aria-current]="isLast ? 'page' : null">
            
            <!-- Separator with fade -->
            <span class="breadcrumb-separator">
              <span class="material-symbols-outlined">chevron_right</span>
            </span>

            <!-- Item Content -->
            <ng-container *ngIf="item.url && !isLast; else staticItem">
              <a [routerLink]="item.url" 
                 class="breadcrumb-link">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined">
                  {{ item.icon }}
                </span>
                <span class="breadcrumb-text">{{ item.label }}</span>
              </a>
            </ng-container>

            <ng-template #staticItem>
              <span class="breadcrumb-static flex items-center text-[11px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full"
                    [ngClass]="isLast ? 'breadcrumb-current font-semibold' : ''">
                <span *ngIf="item.icon" 
                      class="material-symbols-outlined">
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
    .breadcrumb-nav {
      width: 100%;
      margin: 0;
    }

    .breadcrumb-shell {
      display: inline-block;
      width: fit-content;
      max-width: min(100%, 56rem);
      color: #111827;
      background: #ffffff;
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 0.9rem;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      padding: 0.38rem 0.55rem;
      overflow: visible;
      white-space: normal;
    }

    .breadcrumb-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.15rem;
      padding: 0;
      margin: 0;
    }

    /* Base styles */
    .breadcrumb-link {
      position: relative;
      transition: all 0.2s ease;
      color: #4b5563;
      opacity: 1;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.12rem 0.25rem;
      border-radius: 0.45rem;
      font-size: 0.72rem;
      line-height: 1.15;
      font-weight: 600;
      text-decoration: none;
    }

    .breadcrumb-link:hover {
      background: #f3f6f9;
      color: #0367A6;
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
      width: 0;
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
      font-size: 0.88rem;
      line-height: 1;
    }

    .breadcrumb-link:hover .material-symbols-outlined {
      transform: scale(1.05);
    }

    /* Separator animation */
    .breadcrumb-separator {
      opacity: 0.45;
      transition: all 0.2s ease;
      color: #94a3b8;
      display: inline-flex;
      align-items: center;
      margin: 0 0.05rem;
    }

    .breadcrumb-separator .material-symbols-outlined {
      font-size: 0.8rem;
      line-height: 1;
    }

    li:hover .breadcrumb-separator {
      opacity: 0.7;
      transform: translateX(1px);
    }

    .breadcrumb-static {
      color: #4b5563;
      opacity: 1;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.12rem 0.25rem;
      border-radius: 0.45rem;
      font-size: 0.72rem;
      line-height: 1.15;
      font-weight: 600;
    }

    .breadcrumb-current {
      background: transparent;
      color: #111827;
      opacity: 1;
    }

    /* Active/current page styling */
    [aria-current="page"] span:last-child {
      font-weight: 600;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .breadcrumb-shell {
        max-width: 100%;
        padding: 0.28rem 0.45rem;
        border-radius: 0.75rem;
        box-shadow: 0 5px 14px rgba(15, 23, 42, 0.05);
      }
      
      .breadcrumb-text {
        font-size: 0.68rem;
      }
      
      .material-symbols-outlined {
        font-size: 0.78rem;
      }

      .breadcrumb-link,
      .breadcrumb-static {
        font-size: 0.68rem;
        padding: 0.08rem 0.2rem;
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

    /* Subtle background for current item */
    [aria-current="page"] { border-radius: 0.45rem; }
  `]
})
export class Breadcrumbs {
  items = input.required<BreadcrumbItem[]>();
  
  // Computed property para mostrar solo si hay items
  hasItems = computed(() => this.items().length > 0);
}
