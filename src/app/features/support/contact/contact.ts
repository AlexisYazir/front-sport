import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactPage {
  form = {
    nombre: '',
    email: '',
    asunto: 'soporte',
    mensaje: '',
  };

  submitted = false;

  onSubmit() {
    // Solo marcamos como enviado para este mock; se puede conectar a API luego.
    this.submitted = true;
  }
}
