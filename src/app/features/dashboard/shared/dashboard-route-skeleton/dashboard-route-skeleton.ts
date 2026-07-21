import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

type SkeletonLayout = 'dashboard' | 'table' | 'form';

@Component({
  selector: 'app-dashboard-route-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-route-skeleton.html',
  styleUrl: './dashboard-route-skeleton.css',
})
export class DashboardRouteSkeleton {
  @Input() route = '';

  get layout(): SkeletonLayout {
    if (/settings|profile|billing|alexa|empresa|banner|promotion/i.test(this.route)) {
      return 'form';
    }

    if (/products|inventory|orders|compras|returns|users|reviews|logs|reports|prediction/i.test(this.route)) {
      return 'table';
    }

    return 'dashboard';
  }
}
