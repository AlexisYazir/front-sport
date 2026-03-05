import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { ProductService } from '../../../core/services/product.service';
import { Orders } from '../../../core/models/product.model';

@Component({
  selector: 'app-dashboard-empleado',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-empleado.html',
  styleUrl: './dashboard-empleado.css'
})
export class DashboardEmpleado implements OnInit {
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  
  currentUser: User | null = null;

  // Estadísticas del empleado
  stats = {
    pedidosPendientes: 15,
    productosStock: 234,
    ventasHoy: 8,
    ingresosMes: 45800
  };

  // Pedidos pendientes de procesar
  pendingOrders = [
    {
      id: 'PED-045',
      cliente: 'María González',
      fecha: '2025-10-31',
      total: 1850.00,
      estado: 'Pendiente',
      productos: 4,
      prioridad: 'alta'
    },
    {
      id: 'PED-044',
      cliente: 'Carlos Ruiz',
      fecha: '2025-10-31',
      total: 920.00,
      estado: 'En proceso',
      productos: 2,
      prioridad: 'media'
    },
    {
      id: 'PED-043',
      cliente: 'Ana Martínez',
      fecha: '2025-10-30',
      total: 3200.00,
      estado: 'Pendiente',
      productos: 6,
      prioridad: 'alta'
    }
  ];

  // Productos con stock bajo
  lowStockProducts = [
    {
      id: 1,
      nombre: 'Balón Nike Pro',
      stock: 3,
      minStock: 10,
      precio: 450.00
    },
    {
      id: 2,
      nombre: 'Guantes Portero Adidas',
      stock: 2,
      minStock: 8,
      precio: 890.00
    },
    {
      id: 3,
      nombre: 'Camiseta Barcelona 2025',
      stock: 5,
      minStock: 15,
      precio: 1200.00
    }
  ];

  // Actividad reciente
  recentActivity = [
    {
      accion: 'Pedido procesado',
      detalle: 'PED-042 - Juan Pérez',
      tiempo: 'Hace 15 min',
      icono: 'check_circle',
      color: 'text-green-600'
    },
    {
      accion: 'Stock actualizado',
      detalle: 'Tenis Puma Running (+20 unidades)',
      tiempo: 'Hace 1 hora',
      icono: 'inventory',
      color: 'text-blue-600'
    },
    {
      accion: 'Nuevo pedido',
      detalle: 'PED-045 - María González',
      tiempo: 'Hace 2 horas',
      icono: 'notification_add',
      color: 'text-[#FF7A00]'
    }
  ];

ngOnInit() {
  this.currentUser = this.authService.currentUser();
  this.loadOrders();
}

loadOrders() {
  this.productService.getOrdersEmployee().subscribe({
    next: (orders: Orders[]) => {
      console.log('Órdenes recientes:', orders);
    },
    error: (error) => {
      console.error('Error loading orders:', error);
    }
  });
}


  getPrioridadClass(prioridad: string): string {
    switch (prioridad) {
      case 'alta':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'baja':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'En proceso':
        return 'bg-blue-100 text-blue-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completado':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
