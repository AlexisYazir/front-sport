import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Directiva para mostrar/ocultar elementos según el rol del usuario
 * Ejemplo:
 * <button *appHasRole="[UserRole.ADMIN, UserRole.EMPLEADO]">
 *   Solo para admin y empleado
 * </button>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private allowedRoles: UserRole[] = [];
  private destroy$ = new Subject<void>();
  private hasView = false;

  @Input()
  set appHasRole(roles: UserRole[]) {
    this.allowedRoles = roles;
    this.updateView();
  }

  ngOnInit() {
    // Suscribirse a cambios de usuario (logout, login, etc)
    this.authService.currentUser$().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView() {
    const hasAccess = this.hasAccess();

    if (hasAccess && !this.hasView) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAccess && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }

  private hasAccess(): boolean {
    if (!this.allowedRoles || this.allowedRoles.length === 0) {
      return true;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return false;
    }

    return this.allowedRoles.includes(currentUser.rol);
  }
}
