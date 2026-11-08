import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LEGAL_CONTACT } from '../legal-contact';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './privacy.html',
  styles: [`
    @media print {
      .print-actions { display: none !important; }
    }
  `],
})
export class PrivacyComponent {
  readonly legal = LEGAL_CONTACT;
  readonly contactMailto = 'mailto:' + LEGAL_CONTACT.email;
  readonly deletionMailto = this.contactMailto + '?subject=' +
    encodeURIComponent('Solicitud de eliminación de cuenta y datos · Sport Center');

  printNotice(): void {
    if (typeof window !== 'undefined') window.print();
  }
}
