import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-dashboard-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-usuario.html',
  styleUrl: './dashboard-usuario.css'
})
export class DashboardUsuario implements OnInit {
  private authService = inject(AuthService);
  
  currentUser: User | null = null;

  // Estadísticas del usuario
  stats = {
    pedidos: 12,
    favoritos: 8,
    carrito: 3,
    puntos: 450
  };

  // Pedidos recientes
  recentOrders = [
    {
      id: 'PED-001',
      fecha: '2025-10-28',
      total: 1250.00,
      estado: 'Entregado',
      productos: 3
    },
    {
      id: 'PED-002',
      fecha: '2025-10-15',
      total: 890.50,
      estado: 'En camino',
      productos: 2
    },
    {
      id: 'PED-003',
      fecha: '2025-10-05',
      total: 2100.00,
      estado: 'Entregado',
      productos: 5
    }
  ];

  // Productos favoritos
  favoriteProducts = [
    {
      id: 1,
      nombre: 'Balón Nike Pro',
      precio: 450.00,
      imagen: '/assets/images/products/balon-nike.jpg'
    },
    {
      id: 2,
      nombre: 'Tenis Adidas Running',
      precio: 1200.00,
      imagen: '/assets/images/products/tenis-adidas.jpg'
    }
  ];

  ngOnInit() {
    this.currentUser = this.authService.currentUser();
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'Entregado':
        return 'bg-green-100 text-green-800';
      case 'En camino':
        return 'bg-blue-100 text-blue-800';
      case 'Procesando':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
