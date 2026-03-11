// Enums para roles de usuario
export enum UserRole {
  USUARIO = 1,    // Cliente registrado
  EMPLEADO = 2,   // Empleado de la tienda
  ADMIN = 3       // Administrador
}

// Interface principal de Usuario
export interface User {
  id?: number;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  email: string;
  telefono: string;
  rol: UserRole;
  activo: number;
  fecha_creacion?: string;
  updatedAt?: string;
}

// Interface para Login Request
export interface LoginRequest {
  email: string;
  passw: string;
  code: string
}

// Interface para Login Response
export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

// Interface para Register Request
export interface RegisterRequest {
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  email: string;
  telefono: string;
  passw: string;
  rol: UserRole;
  activo: number;
}

// Interface para Register Response
export interface RegisterResponse {
  success: boolean;
  message: string;
  user?: User;
}

// Interface para Auth State
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// Helper para obtener nombre del rol
export function getRoleName(rol: UserRole): string {
  switch (rol) {
    case UserRole.USUARIO:
      return 'Usuario';
    case UserRole.EMPLEADO:
      return 'Empleado';
    case UserRole.ADMIN:
      return 'Administrador';
    default:
      return 'Desconocido';
  }
}

// Helper para obtener ruta de dashboard según rol
export function getDashboardRoute(rol: UserRole): string {
  switch (rol) {
    case UserRole.USUARIO:
      return '/dashboard/usuario';
    case UserRole.EMPLEADO:
      return '/dashboard/empleado';
    case UserRole.ADMIN:
      return '/dashboard/admin';
    default:
      return '/home';
  }

}

export interface RecentUserCreated {
  id: number,
  nombre: string;
  email: string;
  rol: UserRole;
  activo: number;
  fecha_creacion: string;
}

export interface UsersAdmin {
  id_usuario: number,
  nombre: string;
  email: string;
  rol: UserRole;
  activo: number;
  fecha_creacion: string;
}

export interface Roles {
  id_rol: number,
  rol: string
}

export interface UpdateProfileData {
  nombre?: string;
  aPaterno?: string;
  aMaterno?: string;
  email?: string;
  telefono?: string;
  contrasenaActual?: string;
  passw?: string; // Nueva contraseña
}

export interface UpdateProfileResponse {
  message: string;
  user: User;
}
