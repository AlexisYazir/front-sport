// src/app/features/legal/privacy/privacy.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="min-h-screen bg-gradient-to-b from-[#f6f7f9] to-white p-6">
  <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">

    <!-- Header -->
    <header class="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
      <div class="flex-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-[#0f172a]">Aviso de Privacidad</h1>
        <p class="text-sm text-gray-500 mt-1">Última actualización: 26 de septiembre de 2025</p>
      </div>

      <div class="flex-shrink-0 flex flex-col items-end gap-2">
        <nav class="flex gap-2">
          <button type="button" onclick="window.print()" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0367A6] text-white text-sm hover:brightness-95">Imprimir</button>
          <a routerLink="/auth/register" class="inline-flex items-center px-3 py-2 rounded-lg border text-sm text-[#0367A6] hover:bg-[#0367A6]/5">Volver</a>
        </nav>
      </div>
    </header>

    <!-- Content -->
    <main class="px-6 py-6 sm:px-10 sm:py-8">
      <article class="prose max-w-none text-sm leading-relaxed text-gray-800">

        <section>
          <p><strong>Sport Center</strong>, con domicilio en Av. Revolución #120, Col. Centro, Huejutla de Reyes, Hidalgo, México, C.P. 43000, y portal de internet <strong>www.sport2222.com.mx</strong>, es responsable del uso y protección de sus datos personales.</p>
        </section>

        <section>
          <h2>¿Para qué fines utilizaremos sus datos personales?</h2>

          <p>Los datos personales que recabamos de usted se utilizarán para las siguientes finalidades necesarias:</p>
          <ul>
            <li>Entrega y envío de productos adquiridos</li>
            <li>Atención a solicitudes, dudas o aclaraciones</li>
            <li>Mercadotecnia o publicitaria</li>
            <li>Prospección comercial</li>
          </ul>

          <p>Finalidades secundarias (opcionales):</p>
          <ul>
            <li>Gestionar compras y ventas de productos</li>
          </ul>

          <p><strong>No consiento que mis datos personales se utilicen para las siguientes finalidades:</strong></p>
          <p>[ ] Gestionar compras y ventas de productos</p>

          <p>La negativa al uso de datos personales para finalidades secundarias no afecta los servicios contratados.</p>
        </section>

        <section>
          <h2>¿Qué datos personales utilizaremos para estos fines?</h2>
          <ul>
            <li>Datos de identificación</li>
            <li>Datos de contacto</li>
            <li>Datos patrimoniales y/o financieros</li>
          </ul>
        </section>

        <section>
          <h2>¿Con quién compartimos su información personal y para qué fines?</h2>

          <table class="border w-full text-sm my-4">
            <thead>
              <tr class="bg-gray-100">
                <th class="border px-2 py-1">Destinatario</th>
                <th class="border px-2 py-1">Finalidad</th>
                <th class="border px-2 py-1">Requiere consentimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border px-2 py-1">Empresas de paquetería</td>
                <td class="border px-2 py-1">Entrega de productos</td>
                <td class="border px-2 py-1">No</td>
              </tr>
              <tr>
                <td class="border px-2 py-1">Instituciones bancarias / pasarelas de pago</td>
                <td class="border px-2 py-1">Procesar pagos y devoluciones</td>
                <td class="border px-2 py-1">No</td>
              </tr>
              <tr>
                <td class="border px-2 py-1">SAT</td>
                <td class="border px-2 py-1">Cumplimiento legal y facturación</td>
                <td class="border px-2 py-1">No</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Derechos ARCO</h2>
          <p>Usted puede ejercer los derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO).</p>

          <p><strong>Medio de contacto:</strong> correo electrónico, escrito físico o vía telefónica.</p>

          <p><strong>Requisitos:</strong></p>
          <ul>
            <li>Identificación oficial vigente</li>
            <li>Carta poder en caso de representante</li>
            <li>Descripción clara del derecho ARCO a ejercer</li>
          </ul>

          <p><strong>Respuesta:</strong> se otorgará en un plazo de 20 días hábiles vía correo electrónico o físicamente.</p>
        </section>

        <section>
          <h2>Departamento de Datos Personales</h2>
          <ul>
            <li><strong>Nombre:</strong> Departamento de Datos Personales – sport center</li>
            <li><strong>Domicilio:</strong> Av. Revolución #120, Col. Centro, Huejutla de Reyes, Hidalgo</li>
            <li><strong>Correo:</strong> support@sportcenter.com.mx</li>
            <li><strong>Teléfono:</strong> (789) 123 4567</li>
            <li><strong>Sitio web:</strong> www.sport2222.com.mx</li>
          </ul>
        </section>

        <section>
          <h2>Revocación del consentimiento</h2>
          <p>Usted puede solicitar la revocación del consentimiento mediante correo, escrito físico o vía telefónica.</p>
          <p>La solicitud debe incluir identificación, datos de contacto y descripción clara de lo que desea revocar.</p>
          <p>Tiempo de respuesta: 20 días hábiles.</p>
        </section>

        <section>
          <h2>Limitación del uso o divulgación de información personal</h2>
          <p>Puede solicitar que sus datos no sean utilizados para fines publicitarios mediante correo o vía telefónica.</p>

          <p><strong>Listado de exclusión:</strong></p>
          <ul>
            <li>Listado de Exclusión de Marketing – sport center 
              <br>Contacto: privacidad@sportcenter.com.mx / (789) 123 4567
            </li>
          </ul>

          <p>También puede inscribirse al Registro Público para Evitar Publicidad (PROFECO).</p>
        </section>

        <section>
          <h2>Uso de tecnologías de rastreo</h2>
          <p>Usamos cookies y web beacons para análisis del sitio, mejorar la experiencia y personalizar contenido.</p>

          <p><strong>Datos que se recopilan:</strong></p>
          <ul>
            <li>Identificadores y sesión</li>
            <li>Idioma y región</li>
            <li>Navegador y sistema operativo</li>
            <li>Páginas visitadas, búsquedas y publicidad vista</li>
          </ul>

          <p><strong>Para deshabilitar estas tecnologías:</strong></p>
          <p>Configurar su navegador en “Privacidad y seguridad” y desactivar cookies.</p>
        </section>

        <section>
          <h2>Cambios al Aviso de Privacidad</h2>
          <p>Este aviso puede ser actualizado por cambios legales, internos o de servicio.</p>
          <p>Los cambios serán comunicados vía correo electrónico y publicados en la página web.</p>
        </section>

        <section>
          <h2>Consentimiento</h2>
          <p>Consiento que mis datos personales sean tratados de conformidad con este aviso de privacidad.</p>
          <p>[ ] Acepto</p>
        </section>

      </article>
    </main>

    <!-- Footer -->
    <footer class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
      <div class="text-sm text-gray-600">© Sport 2222</div>
      <div class="text-sm">
        <a routerLink="/auth/register" class="text-[#0367A6] hover:underline mr-4">Volver al registro</a>
        <a routerLink="/legal/terms" class="text-[#0367A6] hover:underline">Términos y Condiciones</a>
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
export class PrivacyComponent {}
