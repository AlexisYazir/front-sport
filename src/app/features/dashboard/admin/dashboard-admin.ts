import { Component, signal, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ProductService } from '../../../core/services/product.service';
import { RecentUserCreated, getRoleName } from '../../../core/models/user.model';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatMexicoDate } from '../../../core/utils/date-time.util';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatTooltipModule],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css'
})
export class DashboardAdmin implements OnInit {
  public authService = inject(AuthService);
  private productService = inject(ProductService);
  
  // Estado del menú lateral (inicialmente abierto)
  sidebarOpen = signal<boolean>(true);

  // Estado del navbar (oculto o visible)
  navbarOculto = signal<boolean>(false);
  
  // Variables para el scroll
  lastScrollTop = 0;
  scrollThreshold = 50;

  
  // Datos del usuario actual
  currentUser: { nombre: string } | null = null;

  // Estadísticas del sistema
  stats = {
    totalUsuarios: 0,
    usuariosActivos: 0,
    empleados: 0,
    administradores: 0,
    totalProductos: 0,
    productosAgotados: 0,
    categorias: 0,
    marcas: 0,
    stockBajo: 0,
    productosIncompletos: 0
  };

  // Opciones del menú
  menuItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard/admin' },
    { icon: 'inventory_2', label: 'Productos', route: '/dashboard/admin/products' },
    { icon: 'inventory', label: 'Inventario', route: '/dashboard/admin/inventory' },
    // { icon: 'category', label: 'Categorías', route: '/dashboard/admin/categories' },
    { icon: 'branding_watermark', label: 'Marcas & Categ', route: '/dashboard/admin/marcas-categorias' },
    { icon: 'people', label: 'Usuarios', route: '/dashboard/admin/users' },
    { icon: 'database', label: 'DB Admin', route: '/dashboard/admin/db' },
    { icon: 'article', label: 'Logs', route: '/dashboard/admin/logs' },
    { icon: 'domain', label: 'Perfil Empresa', route: '/dashboard/admin/empresa' },
    { icon: 'monitoring', label: 'Predicción ventas', route: '/dashboard/admin/predictions' },
    // { icon: 'person', label: 'Perfil', route: '/dashboard/admin/profile' },
    { icon: 'settings', label: 'Configuración', route: '/dashboard/admin/settings' },
  ];

  // Lista de usuarios RECIENTES desde la API
  recentUsers: RecentUserCreated[] = [];

  constructor(public router: Router) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentScroll > this.lastScrollTop && currentScroll > 50) {
      this.navbarOculto.set(true);
    } else {
      this.navbarOculto.set(false);
    }
    
    this.lastScrollTop = currentScroll;
  }

  ngOnInit(): void {
     const user = this.authService.currentUser(); // Obtener el valor del signal
    this.currentUser = user ? { nombre: user.nombre || 'Administrador' } : { nombre: 'Administrador' };
    console.log('Usuario actual:', this.currentUser); // Para verificar
    this.loadAllStats();
  }

  loadAllStats() {
    this.loadRecentUsers();
    this.loadUserStats(); // Carga TODOS los usuarios para las stats
    this.loadProductStats();
    this.loadCategoryStats();
    this.loadBrandStats();
  }

  loadRecentUsers() {
    this.authService.getRecentUsers().subscribe({
      next: (users: RecentUserCreated[]) => {
        this.recentUsers = users;
        // console.log('Usuarios recientes:', users);
      },
      error: (error) => {
        console.error('Error loading recent users:', error);
      }
    });
  }

  loadUserStats() {
    // Usar getUsers() en lugar de getRecentUsers() para obtener TODOS los usuarios
    this.authService.getUsers().subscribe({
      next: (users: any[]) => {
        this.stats.totalUsuarios = users.length;
        
        // Contar activos (activo === 1)
        this.stats.usuariosActivos = users.filter(u => u.activo === 1).length;
        
        // Contar por rol
        this.stats.empleados = users.filter(u => u.rol === 2).length;
        this.stats.administradores = users.filter(u => u.rol === 3).length;
        
        console.log('Estadísticas de usuarios:', this.stats);
      },
      error: (error) => {
        console.error('Error loading user stats:', error);
      }
    });
  }

  loadProductStats() {
    this.productService.getInventoryProducts().subscribe({
      next: (products: any[]) => {
        this.stats.totalProductos = products.length;
        this.stats.productosAgotados = products.filter(p => {
          const stock = p.stock ? Number(p.stock) : 0;
          return stock === 0;
        }).length;
        
        // Productos con stock bajo (<=5)
        this.stats.stockBajo = products.filter(p => {
          const stock = p.stock ? Number(p.stock) : 0;
          return stock > 0 && stock <= 5;
        }).length;
      },
      error: (error) => {
        console.error('Error loading product stats:', error);
      }
    });

    // Productos incompletos (sin atributos)
    this.productService.getProductsWithoutVariantsAttributes().subscribe({
      next: (products: any[]) => {
        // console.log(products);
        this.stats.productosIncompletos = products.length;
      },
      error: (error) => {
        console.error('Error loading incomplete products:', error);
      }
    });
  }

  loadCategoryStats() {
    this.productService.getCategorias().subscribe({
      next: (categories: any[]) => {
        this.stats.categorias = categories.length;
      },
      error: (error) => {
        console.error('Error loading category stats:', error);
      }
    });
  }

  loadBrandStats() {
    this.productService.getMarcas().subscribe({
      next: (brands: any[]) => {
        this.stats.marcas = brands.length;
      },
      error: (error) => {
        console.error('Error loading brand stats:', error);
      }
    });
  }

  toggleSidebar() {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  // Método para obtener el nombre del rol usando el helper del modelo
  getRoleNameFromValue(rol: string | number): string {
    const rolNumber = typeof rol === 'string' ? parseInt(rol, 10) : rol;
    return getRoleName(rolNumber);
  }

  getRolClass(rol: string | number): string {
    const rolNumber = typeof rol === 'string' ? parseInt(rol, 10) : rol;
    
    switch (rolNumber) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      case 3: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusClass(activo: string | number): string {
    const activoNumber = typeof activo === 'string' ? parseInt(activo, 10) : activo;
    return activoNumber === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  getStatusText(activo: string | number): string {
    const activoNumber = typeof activo === 'string' ? parseInt(activo, 10) : activo;
    return activoNumber === 1 ? 'Activo' : 'Inactivo';
  }

  formatDate(dateString: string): string {
    return formatMexicoDate(dateString);
  }

  //mejor mieerda jajaja 

  // Métodos para obtener estadísticas formateadas
  getStockBajoPercentage(): number {
    if (this.stats.totalProductos === 0) return 0;
    return Math.round((this.stats.stockBajo / this.stats.totalProductos) * 100);
  }

  getProductosCompletos(): number {
    return this.stats.totalProductos - this.stats.productosIncompletos;
  }

  // Método para verificar si la ruta está activa
  isActive(route: string): boolean {
    return this.router.url === route;
  }
  // En tu dashboard-admin.ts, agrega:

// Propiedades que faltan
recentProducts: any[] = []; // O crea una interfaz Producto

// Métodos que faltan
getStockClass(stock: number): string {
  if (stock <= 0) return 'bg-red-100 text-red-800';
  if (stock <= 5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

getStockStatus(stock: number): string {
  if (stock <= 0) return 'Agotado';
  if (stock <= 5) return 'Bajo stock';
  return 'Disponible';
}

}
