import { Component, NgZone, OnDestroy } from '@angular/core';
import { AlertController, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, IonButtons, IonFab, IonFabButton, IonLoading, IonSpinner, NavController, ToastController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { addCircleOutline, addOutline, downloadOutline, globeOutline, imageOutline, layersOutline, locate, locationOutline, mapOutline, removeOutline, stopCircleOutline, trashOutline, walkOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

// Declara L como una variable global para que TypeScript no se queje.
// Leaflet y Leaflet-draw se cargan globalmente a través de angular.json
declare var L: any;

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

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonButtons, IonFab, IonFabButton, IonLoading, IonSpinner, HttpClientModule]
})

export class MapaPage implements OnDestroy {

  private map: any | null = null;
  private userCircle: any | null = null;
  private pulseCircle: any | null = null;
  private pulseInterval: any = null;
  private peruLayer: any | null = null;
  private drawnItems: any | null = null; // FeatureGroup para elementos dibujados
  private locationWatchId: string | null = null;
  private satelliteLayer: any | null = null;
  private lightLayer: any | null = null;
  private vertexMarkers: any | null = null;
  private walkingPolyline: any | null = null;
  private crosshairMarker: any | null = null;
  private watchId: string | null = null;
  private fixedPathDistance = 0;
  private polygonVertices: any[] = [];

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
  public isDrawingPolygon = false;
  public showInitialSpinner = true;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private navCtrl: NavController,
    private toastController: ToastController,
    private zone: NgZone
  ) {
    addIcons({ mapOutline, locationOutline, locate, trashOutline, globeOutline, addOutline, removeOutline, imageOutline, layersOutline, walkOutline, stopCircleOutline, addCircleOutline, downloadOutline, checkmarkCircleOutline });
  }

  ionViewDidEnter() {
    // Muestra un spinner inicial durante 5 segundos por estética
    setTimeout(() => {
      this.showInitialSpinner = false;
    }, 5000);

    if (!this.map) {
      // Usamos un timeout para asegurarnos de que el DOM de Ionic esté 100% listo.
      // Aumentamos ligeramente el tiempo para dar margen al renderizado del FAB
      setTimeout(() => this.initMap(), 400);
    } else {
      setTimeout(() => {
        this.map?.invalidateSize();
        // Al volver a la página, limpiamos los polígonos existentes y recargamos los guardados
        // para reflejar cualquier cambio (ej. un nuevo polígono guardado).
        if (this.drawnItems) {
          this.drawnItems.clearLayers();
        }
        this.loadSavedPolygons();
      }, 200);
    }
  }

  ngOnDestroy() {
    if (this.locationWatchId) {
      Geolocation.clearWatch({ id: this.locationWatchId });
    }
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
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
    // Limita el zoom-in para que no supere el nivel 10.
    if (this.map && this.map.getZoom() < 10) {
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

  async startDownloadProcess() {
    const alert = await this.alertController.create({
      header: 'Advertencia Importante',
      message: 'La descarga de mapas de proveedores como Google viola sus Términos de Servicio. Esta función es solo una demostración técnica y no debe usarse con fuentes de mapas protegidas. ¿Deseas continuar con una fuente de ejemplo (OpenStreetMap)?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Continuar',
          handler: () => {
            this.downloadTiles();
          }
        }
      ]
    });
    await alert.present();
  }

  async downloadTiles() {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    const minZoom = this.map.getZoom();
    const maxZoom = minZoom + 2; // Descargar 2 niveles de zoom

    const confirmation = await this.alertController.create({
        header: 'Confirmar Descarga',
        message: `Se iniciará la descarga del área visible para los niveles de zoom ${minZoom} a ${maxZoom}. Esto puede tardar y consumir datos.`,
        buttons: [
            { text: 'Cancelar', role: 'cancel' },
            { text: 'Aceptar', handler: async () => {
                this.isLoading = true;
                for (let z = minZoom; z <= maxZoom; z++) {
                  const tiles = this.getTilesInBounds(bounds, z);
                  console.log(`Zoom ${z}: ${tiles.length} teselas a descargar.`);

                  for (const tile of tiles) {
                    // URL de la tesela (¡NO USAR CON GOOGLE!)
                    const tileUrl = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;

                    // Ruta local para guardar
                    const localPath = `offline-tiles/${tile.z}/${tile.x}/${tile.y}.png`;

                    try {
                      // Aquí iría la lógica real de descarga y guardado con Capacitor Filesystem
                      // Por ahora, solo simulamos para no violar términos de servicio.
                      console.log(`Simulando descarga y guardado: ${localPath}`);
                      await new Promise(resolve => setTimeout(resolve, 10)); // Pequeña pausa

                    } catch (error) {
                      console.error(`Error descargando ${tileUrl}`, error);
                    }
                  }
                }
                this.isLoading = false;
                const finalAlert = await this.alertController.create({ header: 'Éxito', message: 'Descarga (simulada) completada.', buttons: ['OK'] });
                await finalAlert.present();
            }}
        ]
    });
    await confirmation.present();
  }

  // Función para calcular las teselas dentro de un área
  getTilesInBounds(bounds: any, zoom: number) {
    const tiles = [];
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    const lat2tile = (lat: number, zoom: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const lon2tile = (lon: number, zoom: number) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));

    const startX = lon2tile(southWest.lng, zoom);
    const startY = lat2tile(northEast.lat, zoom);
    const endX = lon2tile(northEast.lng, zoom);
    const endY = lat2tile(southWest.lat, zoom);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        tiles.push({ z: zoom, x: x, y: y });
      }
    }
    return tiles;
  }

  toggleDrawingMode() {
    this.isDrawingPolygon = !this.isDrawingPolygon;

    if (this.isDrawingPolygon) {
      this.startDrawingByWalking();
    } else {
      this.stopDrawingByWalking();
    }
  }

  addPolygonPoint() {
    if (!this.crosshairMarker) {
      console.warn('No se puede añadir punto, la ubicación aún no está disponible.');
      return;
    }

    const pointToAdd = this.crosshairMarker.getLatLng();
    let segmentDistance = 0;

    // Calcular y acumular la distancia del nuevo segmento
    if (this.polygonVertices.length > 0) {
      const lastVertex = this.polygonVertices[this.polygonVertices.length - 1];
      segmentDistance = lastVertex.distanceTo(pointToAdd);
      this.fixedPathDistance += segmentDistance;
    }

    // 1. Añadir el vértice a la lista
    this.polygonVertices.push(pointToAdd);

    // 2. Actualizar la polilínea que une los vértices
    this.walkingPolyline?.setLatLngs(this.polygonVertices);

    // 3. Añadir un marcador visual en el vértice con una etiqueta
    const pointNumber = this.polygonVertices.length;
    const tooltipContent = `Punto: ${pointNumber}<br>Dist: ${segmentDistance.toFixed(1)} m`;

    L.circleMarker(pointToAdd, {
        color: '#ff0000',
        radius: 5,
        weight: 2,
        fillOpacity: 0.8
    }).bindTooltip(tooltipContent, {
      permanent: true,
      direction: 'right',
      offset: [10, 0],
      className: 'vertex-tooltip'
    }).addTo(this.vertexMarkers);
  }

  private async startDrawingByWalking() {
    // Si no tenemos una ubicación GPS inicial, no podemos empezar a dibujar.
    if (!this.gpsData.lat) {
      console.error('No se pudo iniciar el modo de dibujo: ubicación GPS no disponible.');
      // Revertimos el estado del botón para que el usuario pueda intentarlo de nuevo.
      this.isDrawingPolygon = false;
      return;
    }

    // 1. Limpiar estado de dibujo anterior
    this.polygonVertices = [];
    this.vertexMarkers.clearLayers();
    this.fixedPathDistance = 0;
    if (this.walkingPolyline) {
      this.map.removeLayer(this.walkingPolyline);
    }

    // 2. Inicializar nueva polilínea para los bordes
    this.walkingPolyline = L.polyline([], { color: '#ff0000', weight: 3 }).addTo(this.map);

    // 3. Opciones para el seguimiento GPS
    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    this.isLoading = true;
    try {
      // 4. Usar la última posición conocida del GPS como punto de partida.
      // Esto evita la espera y el posible timeout de getCurrentPosition.
      const initialPoint = L.latLng(this.gpsData.lat, this.gpsData.lng);

      // 5. Crear o mover la "mira" (crosshair) a esa posición inicial
      if (!this.crosshairMarker) {
        const crosshairIcon = L.divIcon({
          className: 'crosshair-icon',
          html: '+',
          iconSize: [30, 30]
        });
        this.crosshairMarker = L.marker(initialPoint, { icon: crosshairIcon, interactive: false }).addTo(this.map);
        this.crosshairMarker.bindTooltip('0.0 m', {
          permanent: true,
          direction: 'top',
          offset: L.point(0, -15),
          className: 'distance-tooltip'
        }).openTooltip();
      } else {
        this.crosshairMarker.setLatLng(initialPoint);
      }
      this.map.panTo(initialPoint);

      // 6. Ahora, iniciar el seguimiento continuo para actualizar la posición de la mira
      this.watchId = await Geolocation.watchPosition(watchOptions, (position, err) => {
        if (err || !position) {
          console.error('Error en watchPosition', err);
          this.toggleDrawingMode(); // Detener si hay un error de GPS
          return;
        }

        const newPoint = L.latLng(position.coords.latitude, position.coords.longitude);

        if (this.crosshairMarker) {
          this.crosshairMarker.setLatLng(newPoint);

          // Calcular distancia en tiempo real y actualizar tooltip
          let liveDistance = 0;
          if (this.polygonVertices.length > 0) {
            const lastVertex = this.polygonVertices[this.polygonVertices.length - 1];
            liveDistance = lastVertex.distanceTo(newPoint);
          }
          const totalDistance = this.fixedPathDistance + liveDistance;
          this.crosshairMarker.setTooltipContent(`${totalDistance.toFixed(1)} m`);
        }
        this.map.panTo(newPoint);
      });
    } catch (e) {
      console.error('No se pudo iniciar el modo de dibujo. Verifique los permisos de ubicación.', e);
      // Si falla (ej. permisos denegados), revertir el estado y limpiar
      if (this.isDrawingPolygon) {
        this.toggleDrawingMode();
      }
    } finally {
      this.isLoading = false;
    }
  }

  private stopDrawingByWalking() {
    // 1. Detener seguimiento de ubicación
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }

    // 2. Convertir a polígono si es válido
    if (this.polygonVertices.length > 2) {
      const polygon = L.polygon(this.polygonVertices, { color: '#ff0000', fillColor: '#ff0000', fillOpacity: 0.2, weight: 3 });
      this.drawnItems.addLayer(polygon);

      // Actualizar las coordenadas GPS con la última posición conocida antes de abrir el modal
      if (this.crosshairMarker) {
        const lastKnownPosition = this.crosshairMarker.getLatLng();
        this.gpsData.lat = lastKnownPosition.lat;
        this.gpsData.lng = lastKnownPosition.lng;
      }
      this.navigateToRegisterData(polygon.toGeoJSON());
    } else {
      this.presentToast('Dibujo cancelado: se necesitan al menos 3 puntos.', 'warning');
    }

    // 3. Limpiar elementos temporales del mapa
    if (this.walkingPolyline) {
      this.map.removeLayer(this.walkingPolyline);
      this.walkingPolyline = null;
    }
    if (this.crosshairMarker) {
      this.map.removeLayer(this.crosshairMarker);
      this.crosshairMarker = null;
    }
    this.vertexMarkers.clearLayers();
    this.polygonVertices = []; // Resetear para la próxima vez
  }

  navigateToRegisterData(geoJSON: any) {
    console.log('Polígono creado, navegando a la página de registro con:', geoJSON);
    this.navCtrl.navigateForward('/mapa/registerdata', {
      state: {
        geojson: geoJSON
      }
    });
  }

  private async editPolygonInfo(key: string) {
    if (!key) return;
    const { value } = await Preferences.get({ key });
    if (value) {
      const geojson = JSON.parse(value);
      // Ejecutamos la navegación dentro de la zona de Angular para garantizar
      // que la detección de cambios se active correctamente, especialmente en móvil.
      this.zone.run(() => {
        this.navCtrl.navigateForward('/mapa/registerdata', {
          state: {
            geojson: geojson,
            key: key // Pasamos la clave para saber que estamos editando
          }
        });
      });
    }
  }

  private async loadSavedPolygons() {
    if (!this.drawnItems) return;

    // 1. Obtener todas las claves de Preferences
    const { keys } = await Preferences.keys();
    const polygonKeys = keys.filter(key => key.startsWith('polygon_'));

    // 2. Iterar sobre cada clave, obtener el GeoJSON y añadirlo al mapa
    for (const key of polygonKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const geojson = JSON.parse(value);

          const polygonLayer = L.geoJSON(geojson, {
            style: {
              color: '#3388ff', // Color azul para polígonos guardados
              weight: 3,
              opacity: 0.7,
              fillColor: '#3388ff',
              fillOpacity: 0.2
            },
            onEachFeature: (feature: any, layer: any) => {
              // La forma robusta: construir el popup con las utilidades de Leaflet
              if (feature.properties) {
                // 1. Crear el contenedor principal del popup
                const popupContainer = L.DomUtil.create('div', 'custom-popup-class');

                // 2. Añadir el contenido (nombre, descripción, fecha)
                popupContainer.innerHTML = `
                  <strong>${feature.properties.name || 'Polígono sin nombre'}</strong>
                  <p style="margin: 5px 0;">${feature.properties.description || 'Sin descripción.'}</p>
                  <small>Creado: ${new Date(feature.properties.createdAt).toLocaleString()}</small>
                `;

                // 3. Crear el contenedor y el botón de "Editar"
                const buttonContainer = L.DomUtil.create('div', '', popupContainer);
                buttonContainer.style.textAlign = 'right';
                buttonContainer.style.marginTop = '10px';

                const editButton = L.DomUtil.create('button', '', buttonContainer);
                editButton.innerText = 'Editar';
                // Añadimos una clase para poder darle estilos si queremos
                editButton.classList.add('popup-edit-button');

                // 4. Adjuntar el evento de clic de forma segura con L.DomEvent
                L.DomEvent.on(editButton, 'click', (ev: MouseEvent) => {
                  L.DomEvent.stop(ev); // Previene que el clic se propague al mapa
                  this.editPolygonInfo(key);
                });

                layer.bindPopup(popupContainer);
              }
            }
          });
          this.drawnItems.addLayer(polygonLayer);
        } catch (e) {
          console.error(`Error al procesar el polígono guardado (key: ${key})`, e);
        }
      }
    }
  }

  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    toast.present();
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
          fillOpacity: 1, // Hacemos el punto sólido para mejor visibilidad
          radius: 5,
          weight: 2,
        }).addTo(this.map);

        this.pulseCircle = L.circle([lat, lng], {
          color: 'transparent',
          fillColor: '#3880ff',
          fillOpacity: 0.5,
          radius: 10, // Radio inicial consistente con la animación
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
    // Asignamos el icono por defecto a los marcadores de Leaflet
    L.Marker.prototype.options.icon = iconDefault;

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

    // Inicializamos el FeatureGroup para los elementos dibujados
    this.drawnItems = new L.FeatureGroup();
    this.drawnItems.addTo(map);

    // Inicializamos el FeatureGroup para los marcadores de vértices
    this.vertexMarkers = new L.FeatureGroup();
    this.vertexMarkers.addTo(map);

    // Creamos un control para editar y borrar, pero no para dibujar nuevas formas.
    const editControl = new L.Control.Draw({
      position: 'topright',
      edit: {
        featureGroup: this.drawnItems,
        remove: false,
      },
      draw: false // Desactivamos las herramientas de dibujo manual
    });
    //map.addControl(editControl);

    // Eventos para los elementos dibujados (útil si se editan/borran con leaflet-draw)
    map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      this.drawnItems?.addLayer(layer);
      console.log('Feature created:', layer.toGeoJSON());
    });

    map.on(L.Draw.Event.DELETED, (event: any) => {
      console.log('Features deleted:', event.layers.toGeoJSON());
    });

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
      // Establecemos el zoom mínimo al que se ajusta el mapa para ver todo el país.
      map.setMinZoom(map.getZoom());
    });

    this.map = map;

    // Iniciamos el seguimiento continuo de la ubicación del usuario.
    this.startLocationWatch();

    // Cargamos los polígonos guardados en el dispositivo
    this.loadSavedPolygons();
  }
}
