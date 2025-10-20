import { Component, OnDestroy } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, IonButtons } from '@ionic/angular/standalone';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import * as L from 'leaflet';
import { addIcons } from 'ionicons';
import { locationOutline, mapOutline } from 'ionicons/icons';

const iconRetinaUrl = 'assets/images/marker-icon-2x.png';
const iconUrl = 'assets/images/marker-icon.png';
const shadowUrl = 'assets/images/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;


@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonButtons, HttpClientModule]
})

export class MapaPage implements OnDestroy {

  private map: L.Map | null = null;

  constructor(private http: HttpClient) {
    addIcons({mapOutline,locationOutline});
  }

  ionViewDidEnter() {
    if (!this.map) {
      // Usamos un timeout para asegurarnos de que el DOM de Ionic esté 100% listo.
      setTimeout(() => this.initMap(), 300);
    } else {
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 200);
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    const map = L.map('map', {
      center: [-9.19, -75.0152],
      zoomControl: false,
      zoom: 10
    });

    const lightLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }
    );
    const satelliteLayer = L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      { attribution: '&copy; Google', maxZoom: 20 }
    );

    const baseMaps = {
      "Satélite": satelliteLayer,
      "Calles": lightLayer,
    };

    // Añadimos la capa de mapa por defecto
    satelliteLayer.addTo(map);
    L.control.layers(baseMaps).addTo(map);
    L.control.scale({position: 'topleft', metric: true, imperial: false, maxWidth: 100}).addTo(map);

    // Añadimos el control de zoom en la esquina superior derecha, debajo del control de capas.
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Cargamos y añadimos el límite de Departamentos desde el archivo GeoJSON
    this.http.get('assets/data/departamentos.geojson').subscribe((data: any) => {
      const peruLayer = L.geoJSON(data, {
        style: {
          color: '#ff7800', // Color de la línea
          weight: 2,       // Grosor de la línea
          opacity: 0.9,    // Opacidad
          fillColor: '#ff7800',
          fillOpacity: 0 // No rellenar el polígono
        }
      }).addTo(map);
      map.fitBounds(peruLayer.getBounds());
    });

    this.map = map;
  }
}
