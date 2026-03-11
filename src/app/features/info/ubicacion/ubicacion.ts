import { Component, AfterViewInit } from '@angular/core';
import * as maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-ubicacion',
  templateUrl: './ubicacion.html',
  styleUrls: ['./ubicacion.css']
})
export class Ubicacion implements AfterViewInit {

  private map!: maplibregl.Map;

  ngAfterViewInit(): void {
    // Reemplaza 'YOUR_MAPTILER_KEY' con la API key gratuita de MapTiler
    this.map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/streets/style.json?key=P8d5gh2p1ZmSAbNmmUpE',
  center: [-98.3811029, 21.1559307],
  zoom: 16,
  pitch: 60,     // ángulo del mapa en grados (0 = plano, 60 = inclinado)
  bearing: -20,  // rotación horizontal del mapa
});

    // Agregar marcador con popup
    new maplibregl.Marker()
      .setLngLat([-98.3811029, 21.1559307])
      .setPopup(new maplibregl.Popup().setHTML('<b>UT Huasteca Hidalguense</b>'))
      .addTo(this.map);
  }
}