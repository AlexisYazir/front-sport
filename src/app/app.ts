import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { Footer } from './shared/components/footer/footer';

import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('ecommerce-app');
  private toastr = inject(ToastrService);

  testToast() {
    this.toastr.success('¡Todo funciona correctamente!', 'Éxito');
  }
}
