import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CompanyService } from '../../../core/services/company.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactPage implements OnInit {
  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private router = inject(Router);

  form = {
    nombre: '',
    email: '',
    asunto: 'soporte',
    mensaje: '',
  };

  submitted = false;
  isLoading = signal<boolean>(false);
  isAuthenticated = signal<boolean>(false);

  // Validaciones
  errors = {
    nombre: '',
    email: '',
    mensaje: ''
  };

  ngOnInit() {
    // Verificar si el usuario está autenticado
    const currentUser = this.authService.currentUser();
    this.isAuthenticated.set(!!currentUser);
    
    // Si está autenticado, precargar datos
    if (currentUser) {
      this.form.nombre = currentUser.nombre || '';
      this.form.email = currentUser.email || '';
    }
  }

  validateForm(): boolean {
    let isValid = true;
    this.errors = {
      nombre: '',
      email: '',
      mensaje: ''
    };

    // Validar nombre
    if (!this.form.nombre.trim()) {
      this.errors.nombre = 'El nombre es obligatorio';
      isValid = false;
    } else if (this.form.nombre.length < 2) {
      this.errors.nombre = 'El nombre debe tener al menos 2 caracteres';
      isValid = false;
    }

    // Validar email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!this.form.email.trim()) {
      this.errors.email = 'El email es obligatorio';
      isValid = false;
    } else if (!emailRegex.test(this.form.email)) {
      this.errors.email = 'Ingresa un email válido';
      isValid = false;
    }

    // Validar mensaje
    if (!this.form.mensaje.trim()) {
      this.errors.mensaje = 'El mensaje es obligatorio';
      isValid = false;
    } else if (this.form.mensaje.length < 10) {
      this.errors.mensaje = 'El mensaje debe tener al menos 10 caracteres';
      isValid = false;
    }

    return isValid;
  }

  onSubmit() {
    // Verificar autenticación
    if (!this.isAuthenticated()) {
      this.toastr.warning('Debes iniciar sesión para contactar a soporte', 'Acceso requerido');
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/contact' } 
      });
      return;
    }

    if (!this.validateForm()) {
      this.toastr.warning('Por favor corrige los errores del formulario', 'Validación');
      return;
    }

    this.isLoading.set(true);

    this.companyService.sendContactMessage(this.form).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.submitted = true;
        this.toastr.success('Mensaje enviado correctamente', '¡Gracias por contactarnos!');
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Error al enviar mensaje:', error);
        
        if (error.status === 401) {
          this.toastr.error('Tu sesión ha expirado. Inicia sesión nuevamente.', 'Sesión expirada');
          this.router.navigate(['/auth/login']);
        } else {
          this.toastr.error(
            error.error?.message || 'Error al enviar el mensaje. Intenta de nuevo.',
            'Error'
          );
        }
      }
    });
  }

  resetForm() {
    this.submitted = false;
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.form = {
        nombre: currentUser.nombre || '',
        email: currentUser.email || '',
        asunto: 'soporte',
        mensaje: ''
      };
    } else {
      this.form = {
        nombre: '',
        email: '',
        asunto: 'soporte',
        mensaje: ''
      };
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login'], { 
      queryParams: { returnUrl: '/contact' } 
    });
  }
}