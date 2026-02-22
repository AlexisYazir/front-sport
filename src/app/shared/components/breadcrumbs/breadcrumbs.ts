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
    <nav class="mb-8" aria-label="Breadcrumb" *ngIf="items().length > 0">
      <ol class="flex items-center flex-wrap gap-1">
        <!-- Home Item -->
        <li class="flex items-center">
          <a routerLink="/" 
             class="breadcrumb-link flex items-center text-sm font-medium text-gray-500">
            <span class="material-symbols-outlined text-lg mr-1">home</span>
            <span class="hidden sm:inline">Inicio</span>
          </a>
        </li>

        <!-- Dynamic Items -->
        <li *ngFor="let item of items(); let isLast = last" 
            class="flex items-center"
            [attr.aria-current]="isLast ? 'page' : null">
          
          <!-- Separator with fade -->
          <span class="breadcrumb-separator flex items-center text-gray-300 mx-2">
            <span class="material-symbols-outlined text-lg">chevron_right</span>
          </span>

          <!-- Item Content -->
          <ng-container *ngIf="item.url && !isLast; else staticItem">
            <a [routerLink]="item.url" 
               class="breadcrumb-link flex items-center text-sm font-medium text-gray-500">
              <span *ngIf="item.icon" 
                    class="material-symbols-outlined text-lg mr-1">
                {{ item.icon }}
              </span>
              <span class="breadcrumb-text">{{ item.label }}</span>
            </a>
          </ng-container>

          <ng-template #staticItem>
            <span class="flex items-center text-sm font-medium"
                  [ngClass]="isLast ? 'text-gray-900 font-semibold' : 'text-gray-500'">
              <span *ngIf="item.icon" 
                    class="material-symbols-outlined text-lg mr-1"
                    [ngClass]="isLast ? 'text-blue-600' : 'text-gray-400'">
                {{ item.icon }}
              </span>
              <span class="breadcrumb-text">{{ item.label }}</span>
            </span>
          </ng-template>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    /* Base styles */
    .breadcrumb-link {
      position: relative;
      padding: 4px 0;
      transition: color 0.2s ease;
    }

    .breadcrumb-link:hover {
      color: #3b82f6;
    }

    /* Subtle underline animation */
    .breadcrumb-link::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 1.5px;
      background: #3b82f6;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.5;
    }

    .breadcrumb-link:hover::after {
      width: 100%;
    }

    /* Text fade animation */
    .breadcrumb-text {
      display: inline-block;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .breadcrumb-link:hover .breadcrumb-text {
      transform: translateX(2px);
    }

    /* Icon subtle pulse */
    .breadcrumb-link .material-symbols-outlined {
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .breadcrumb-link:hover .material-symbols-outlined {
      transform: scale(1.05);
    }

    /* Separator fade animation */
    .breadcrumb-separator {
      transition: all 0.2s ease;
    }

    li:hover .breadcrumb-separator {
      color: #3b82f6;
      opacity: 0.8;
    }

    /* Active/current page styling */
    [aria-current="page"] {
      position: relative;
    }

    [aria-current="page"] span:last-child {
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }

    [aria-current="page"] .material-symbols-outlined {
      color: #3b82f6;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .material-symbols-outlined {
        font-size: 1.1rem;
      }
      
      .breadcrumb-text {
        font-size: 0.8rem;
      }
    }

    /* Fade in animation for breadcrumbs */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    nav {
      animation: fadeInUp 0.4s ease-out;
    }

    /* Stagger children animation */
    li {
      opacity: 0;
      animation: fadeInUp 0.3s ease-out forwards;
    }

    li:nth-child(1) { animation-delay: 0.05s; }
    li:nth-child(2) { animation-delay: 0.1s; }
    li:nth-child(3) { animation-delay: 0.15s; }
    li:nth-child(4) { animation-delay: 0.2s; }
    li:nth-child(5) { animation-delay: 0.25s; }

    /* Remove shine effect */
    a::after {
      display: none;
    }

    /* Clean hover states */
    a {
      position: relative;
      overflow: visible;
    }
  `]
})
export class Breadcrumbs {
  items = input.required<BreadcrumbItem[]>();
  
  // Computed property para mostrar solo si hay items
  hasItems = computed(() => this.items().length > 0);
}