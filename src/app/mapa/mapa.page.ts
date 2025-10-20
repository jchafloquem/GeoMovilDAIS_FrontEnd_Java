import { Component, OnDestroy } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, IonButtons, IonFab, IonFabButton, IonLoading } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import * as L from 'leaflet';
import { addIcons } from 'ionicons';
import { addOutline, globeOutline, imageOutline, layersOutline, locate, locationOutline, mapOutline, removeOutline, trashOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';

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
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonButtons, IonFab, IonFabButton, IonLoading, HttpClientModule]
})

export class MapaPage implements OnDestroy {

  private map: L.Map | null = null;
  private userCircle: L.Circle | null = null;
  private pulseCircle: L.Circle | null = null;
  private pulseInterval: any = null;
  private peruLayer: L.GeoJSON | null = null;
  private locationWatchId: string | null = null;
  private satelliteLayer: L.TileLayer | null = null;
  private lightLayer: L.TileLayer | null = null;

  public isLoading = false;
  public gpsData: any = {
    lat: null,
    lng: null,
    alt: null,
    vel: null,
    accH: null,
    accV: null,
  };

  public activeLayer: 'satellite' | 'streets' = 'satellite';

  constructor(private http: HttpClient) {
    addIcons({ mapOutline, locationOutline, locate, trashOutline, globeOutline, addOutline, removeOutline, imageOutline, layersOutline });
  }

  ionViewDidEnter() {
    if (!this.map) {
      // Usamos un timeout para asegurarnos de que el DOM de Ionic esté 100% listo.
      // Aumentamos ligeramente el tiempo para dar margen al renderizado del FAB
      setTimeout(() => this.initMap(), 400);
    } else {
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 200);
    }
  }

  ngOnDestroy() {
    if (this.locationWatchId) {
      Geolocation.clearWatch({ id: this.locationWatchId });
    }
    if (this.map) {
      // Limpiamos el intervalo para evitar fugas de memoria
      if (this.pulseInterval) {
        clearInterval(this.pulseInterval);
      }
      this.map.off();
      this.map.remove();
      this.map = null;
    }
  }

  clearLocation() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
    if (this.userCircle) {
      this.userCircle.remove();
      this.userCircle = null;
    }
    if (this.pulseCircle) {
      this.pulseCircle.remove();
      this.pulseCircle = null;
    }
  }

  zoomIn() {
    if (this.map) {
      this.map.zoomIn();
    }
  }

  zoomOut() {
    if (this.map) {
      this.map.zoomOut();
    }
  }

  switchLayer(layerName: 'satellite' | 'streets') {
    if (!this.map || !this.satelliteLayer || !this.lightLayer) return;

    if (layerName === 'satellite') {
      if (this.map.hasLayer(this.lightLayer)) {
        this.map.removeLayer(this.lightLayer);
      }
      if (!this.map.hasLayer(this.satelliteLayer)) {
        this.map.addLayer(this.satelliteLayer);
      }
    } else { // streets
      if (this.map.hasLayer(this.satelliteLayer)) {
        this.map.removeLayer(this.satelliteLayer);
      }
      if (!this.map.hasLayer(this.lightLayer)) {
        this.map.addLayer(this.lightLayer);
      }
    }
    this.activeLayer = layerName;
  }

  /**
   * Ajusta el zoom del mapa para mostrar la extensión completa de Perú.
   */
  zoomToPeru() {
    if (this.map && this.peruLayer) {
      this.map.fitBounds(this.peruLayer.getBounds());
    }
  }

  /**
   * Acción del botón: Muestra el indicador de carga y centra el mapa en el usuario.
   */
  async findAndCenterUser() {
    if (!this.map || this.gpsData.lat === null) {
      console.warn('Datos de ubicación aún no disponibles.');
      return;
    }

    this.isLoading = true;
    // Forzamos la actualización de la UI para mostrar el spinner antes de las operaciones del mapa.
    await new Promise(resolve => setTimeout(resolve, 20));

    try {
      const { lat, lng } = this.gpsData;

      // Si los marcadores no existen, los creamos.
      if (!this.userCircle) {
        this.userCircle = L.circle([lat, lng], {
          color: '#ffff',
          fillColor: '#0D9BD7',
          fillOpacity: 0.8, // Hacemos el punto sólido para mejor visibilidad
          radius: 5,
          weight: 2,
        }).addTo(this.map);

        this.pulseCircle = L.circle([lat, lng], {
          color: 'transparent',
          fillColor: '#3880ff',
          fillOpacity: 0.5,
          radius: 30, // Radio inicial consistente con la animación
          weight: 0,
        }).addTo(this.map);

        const maxRadius = 40;
        let radius = 10;
        this.pulseInterval = setInterval(() => {
          if (!this.pulseCircle) return;
          radius += 1.5;
          if (radius >= maxRadius) radius = 10;
          this.pulseCircle.setRadius(radius);
          this.pulseCircle.setStyle({ fillOpacity: 0.5 * (1 - (radius / maxRadius)) });
        }, 50);
      }

      this.map.setView([lat, lng], 18);
    } catch (error) {
      console.error('Error en la localización manual', error);
      // Aquí podrías mostrar una alerta al usuario
    } finally {
      this.isLoading = false;
    }
  }

  private async startLocationWatch() {
    try {
      this.locationWatchId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      }, (position, err) => {
        if (err) {
          console.error('Error en el seguimiento de la ubicación:', err);
          return;
        }
        if (position) {
          const { latitude, longitude, altitude, accuracy, altitudeAccuracy, speed } = position.coords;

          this.gpsData = {
            lat: latitude ? parseFloat(latitude.toFixed(4)) : 0,
            lng: longitude ? parseFloat(longitude.toFixed(4)) : 0,
            alt: altitude ? parseFloat(altitude.toFixed(4)) : 0,
            vel: speed ? parseFloat(speed.toFixed(2)) : 0,
            accH: accuracy ? parseFloat(accuracy.toFixed(4)) : 0,
            accV: altitudeAccuracy ? parseFloat(altitudeAccuracy.toFixed(2)) : 0,
          };

          // Si los marcadores existen, actualizamos su posición
          if (this.userCircle && this.pulseCircle) {
            const newLatLng = L.latLng(latitude, longitude);
            this.userCircle.setLatLng(newLatLng);
            this.pulseCircle.setLatLng(newLatLng);
          }
        }
      });
    } catch (error) {
      console.error('No se pudo iniciar el seguimiento de la ubicación', error);
    }
  }

  private initMap(): void {
    const map = L.map('map', {
      center: [-9.19, -75.0152],
      zoomControl: false,
      zoom: 10
    });

    this.lightLayer = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }
    );
    this.satelliteLayer = L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      { attribution: '&copy; Google', maxZoom: 20 }
    );

    // Añadimos la capa de mapa por defecto
    this.satelliteLayer.addTo(map);
    L.control.scale({position: 'topleft', metric: true, imperial: false, maxWidth: 100}).addTo(map);

    // Cargamos y añadimos el límite de Departamentos desde el archivo GeoJSON
    this.http.get('assets/data/departamentos.geojson').subscribe((data: any) => {
      this.peruLayer = L.geoJSON(data, {
        style: {
          color: '#ff7800', // Color de la línea
          weight: 2,       // Grosor de la línea
          opacity: 0.9,    // Opacidad
          fillColor: '#ff7800',
          fillOpacity: 0 // No rellenar el polígono
        }
      }).addTo(map);
      map.fitBounds(this.peruLayer.getBounds());
    });

    this.map = map;

    // Iniciamos el seguimiento continuo de la ubicación del usuario.
    this.startLocationWatch();
  }
}
