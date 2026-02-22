// src/app/features/legal/terms/terms.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="min-h-screen bg-gradient-to-b from-[#f6f7f9] to-white p-6">
  <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">

    <!-- Header -->
    <header class="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
      <div class="flex-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-[#0f172a]">TÉRMINOS Y CONDICIONES – SPORT CENTER</h1>
        <p class="text-sm text-gray-500 mt-1">Fecha de última actualización: 25 de septiembre de 2025</p>
      </div>

      <div class="flex-shrink-0 flex flex-col items-end gap-2">
        <nav aria-label="Acciones rápidas" class="flex gap-2">
          <button type="button" onclick="window.print()" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0367A6] text-white text-sm hover:brightness-95">Imprimir</button>
          <a routerLink="/auth/register" class="inline-flex items-center px-3 py-2 rounded-lg border text-sm text-[#0367A6] hover:bg-[#0367A6]/5">Volver</a>
        </nav>
      </div>
    </header>

    <!-- Content -->
    <main class="px-6 py-6 sm:px-10 sm:py-8">
      <article class="prose max-w-none text-sm leading-relaxed text-gray-800">

        <section>
          <h2>1. Información General sobre la Empresa</h2>
          <p><strong>Nombre de la empresa:</strong> Sport Center</p>
          <p><strong>Razón social:</strong> sportcenter S.A. de C.V.</p>
          <p><strong>Domicilio fiscal:</strong> Av. Revolución #120, Col. Centro, Huejutla de Reyes, Hidalgo, México, C.P. 43000</p>
          <p><strong>Medios de contacto:</strong></p>
          <ul>
            <li><strong>Correo electrónico:</strong> support@sport.com.mx</li>
            <li><strong>Teléfono:</strong> (789) 123 4567</li>
            <li><strong>Página web:</strong> www.sportcenter.com.mx</li>
          </ul>
          <p><strong>Actividad comercial:</strong> Venta de ropa y accesorios deportivos a través de comercio electrónico, incluyendo servicios de carrito de compras y apartado de productos.</p>
          <p><strong>Marco legal:</strong> Ley Federal de Protección al Consumidor, Ley de Comercio Electrónico y leyes mercantiles aplicables supervisadas por PROFECO.</p>
        </section>

        <section>
          <h2>2. Aceptación de los Términos y Condiciones</h2>
          <p>Al realizar una compra o utilizar cualquier servicio de sport 2222, el usuario acepta estos Términos y Condiciones. La aceptación se realiza mediante clic en el botón de “Aceptar” o mediante cualquier acción de compra en la plataforma.</p>
          <p>Los Términos y Condiciones pueden ser modificados en cualquier momento; se recomienda revisarlos periódicamente.</p>
        </section>

        <section>
          <h2>3. Proceso de Compra y Precios</h2>
          <ul>
            <li><strong>Selección de productos:</strong> El usuario elige productos desde la plataforma en línea.</li>
            <li><strong>Carrito de compras:</strong> El usuario puede agregar, modificar o eliminar productos antes de finalizar la compra.</li>
            <li><strong>Sistema de apartado:</strong> Se permite apartar productos mediante anticipo y pagar el resto posteriormente.</li>
            <li><strong>Confirmación:</strong> Al completar el pago, se envía confirmación por correo.</li>
            <li><strong>Precios:</strong> Incluyen impuestos (IVA).</li>
            <li><strong>Formas de pago:</strong> Tarjeta, transferencia y PayPal.</li>
            <li><strong>Promociones:</strong> Aplican según la campaña vigente.</li>
          </ul>
        </section>

        <section>
          <h2>4. Envíos y Entregas</h2>
          <p><strong>Cobertura:</strong> Envíos dentro de México.</p>
          <p><strong>Tiempos:</strong> 3 a 7 días hábiles.</p>
          <p><strong>Costos:</strong> Dependen del método de envío elegido.</p>
          <p><strong>Incidencias:</strong> Si el producto no llega o llega dañado, debe reportarse de inmediato para reposición o reembolso.</p>
        </section>

        <section>
          <h2>5. Política de Devoluciones y Cambios</h2>
          <p><strong>Plazo:</strong> 15 días naturales desde la entrega.</p>
          <p><strong>No aplica devolución para:</strong> Artículos personalizados o productos de higiene usados.</p>
          <p><strong>Condiciones:</strong> Producto sin uso, con etiqueta y empaque original.</p>
          <p><strong>Costo:</strong> La empresa cubre devoluciones si el producto presenta defecto o error de envío.</p>
        </section>

        <section>
          <h2>6. Cancelación de Compras o Servicios</h2>
          <p><strong>Cliente:</strong> Puede cancelar antes del envío.</p>
          <p><strong>Empresa:</strong> Puede cancelar por causas justificadas informando al cliente.</p>
          <p><strong>Cargos:</strong> En apartados, el anticipo puede no ser reembolsable.</p>
        </section>

        <section>
          <h2>7. Garantías y Responsabilidades</h2>
          <p><strong>Duración:</strong> 30 días naturales desde la entrega.</p>
          <p><strong>Cobertura:</strong> Defectos de fabricación; no cubre mal uso.</p>
          <p><strong>Proceso:</strong> Reposición, reparación o reembolso según disponibilidad.</p>
        </section>

        <section>
          <h2>8. Marco Legal</h2>
          <p>Aplican las disposiciones de la Ley Federal de Protección al Consumidor (LFPC).</p>
          <p>El cliente puede presentar quejas ante PROFECO.</p>
          <p>En caso de conflicto, se aplicará la ley mexicana.</p>
          <p>La empresa no se hace responsable de daños por mal uso.</p>
        </section>

        <section>
          <h2>9. Modificaciones de los Términos y Condiciones</h2>
          <p>Las actualizaciones se publicarán en la página web y por correo electrónico.</p>
          <p><strong>Última actualización:</strong> 25 de septiembre de 2025.</p>
        </section>

      </article>
    </main>

    <!-- Footer -->
    <footer class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
      <div class="text-sm text-gray-600">© Sport Center</div>
      <div class="text-sm">
        <a routerLink="/auth/register" class="text-[#0367A6] hover:underline mr-4">Volver al registro</a>
        <a routerLink="/legal/privacy" class="text-[#0367A6] hover:underline">Aviso de Privacidad</a>
      </div>
    </footer>
  </div>
</div>

<style>
  @media print {
    button, a[routerlink], a[routerLink] { display: none !important; }
  }
</style>
  `,
})
export class TermsComponent {}
