import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LEGAL_CONTACT } from '../legal-contact';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './terms.html',
})
export class TermsComponent {
  readonly legal = LEGAL_CONTACT;

  print(): void {
    window.print();
  }
}
