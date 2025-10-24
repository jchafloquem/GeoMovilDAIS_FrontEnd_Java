import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { ToastController, NavController, AlertController, LoadingController } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';
import * as L from 'leaflet';

import { ApiService, MidagriProductor, ReniecResponse } from './api.service';

// Reutilizamos la interfaz de propiedades
interface GeoJsonProperties {
  name: string;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string;
  celular_participante: string;
  txt_codigoautogenerado: string;
  fec_registro: string;
  txt_actagraria: string;
  num_superficie: string;
  txt_regtenencia: string;
  txt_sexo: string;
  txt_departamento: string;
  txt_provincia: string;
  txt_distrito: string;
  photos: string[];
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegisterDataService {

  // --- Estado Reactivo con BehaviorSubjects ---
  private readonly _geojson = new BehaviorSubject<any>(null);
  readonly geojson$ = this._geojson.asObservable();

  private readonly _editKey = new BehaviorSubject<string | null>(null);
  readonly editKey$ = this._editKey.asObservable();

  private readonly _photosForDisplay = new BehaviorSubject<string[]>([]);
  readonly photosForDisplay$ = this._photosForDisplay.asObservable();

  private readonly _savedPhotoUris = new BehaviorSubject<string[]>([]);

  private readonly _formData = new BehaviorSubject({
    dni: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    celular_participante: '',
    txt_codigoautogenerado: '',
    fec_registro: '',
    txt_actagraria: '',
    num_superficie: '',
    txt_regtenencia: '',
    txt_sexo: '',
    txt_departamento: '',
    txt_provincia: '',
    txt_distrito: '',
    perimetro: '',
    area: '',
    altitud: '',
    centroide: '',
    geometryTypeLabel: '',
  });
  readonly formData$ = this._formData.asObservable();

  constructor(
    private router: Router,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private zone: NgZone,
    private apiService: ApiService
  ) { }

  // --- Métodos de Inicialización y Carga ---

  public async loadInitialData(key: string | null, navigationState: any) {
    this.resetState();

    if (key) {
      // MODO EDICIÓN
      this._editKey.next(key);
      console.log('Modo edición por URL. Clave:', key);
      const { value } = await Preferences.get({ key });
      if (value) {
        const geojson = JSON.parse(value);
        this._geojson.next(geojson);
        this.calculateGeometryData();
        if (geojson?.properties) {
          this.loadFormDataFromProperties(geojson.properties);
          if (geojson.properties.photos && Array.isArray(geojson.properties.photos)) {
            this._savedPhotoUris.next(geojson.properties.photos);
            await this.loadPhotosForDisplay();
          }
        }
      } else {
        console.error('No se encontró el polígono para la clave:', key);
        const toast = await this.toastController.create({ message: 'Error: No se pudo cargar el polígono para editar.', duration: 3000, color: 'danger' });
        await toast.present();
        this.navCtrl.navigateBack('/mapa');
      }
    } else if (navigationState && navigationState.geojson) {
      // MODO CREACIÓN
      const geojson = navigationState.geojson;
      this._geojson.next(geojson);
      this.calculateGeometryData();
      console.log('Modo creación de nuevo polígono.');
    } else {
      console.warn('Página de registro abierta sin GeoJSON para crear o clave para editar.');
    }
  }

  private resetState() {
    this._geojson.next(null);
    this._editKey.next(null);
    this._photosForDisplay.next([]);
    this._savedPhotoUris.next([]);
    this._formData.next({
      dni: '', nombres: '', apellido_paterno: '', apellido_materno: '',
      fecha_nacimiento: '', celular_participante: '', txt_codigoautogenerado: '',
      fec_registro: '', txt_actagraria: '',
      num_superficie: '', txt_regtenencia: '', txt_sexo: '',
      txt_departamento: '', txt_provincia: '', txt_distrito: '',
      perimetro: '', area: '', altitud: '', centroide: '',
      geometryTypeLabel: '',
    });
  }

  private loadFormDataFromProperties(properties: any) {
    const currentData = this._formData.getValue();
    currentData.dni = properties.dni || '';
    currentData.nombres = properties.nombres || '';
    currentData.apellido_paterno = properties.apellido_paterno || '';
    currentData.apellido_materno = properties.apellido_materno || '';
    currentData.fecha_nacimiento = properties.fecha_nacimiento || '';
    currentData.celular_participante = properties.celular_participante || '';
    currentData.txt_codigoautogenerado = properties.txt_codigoautogenerado || '';
    currentData.fec_registro = properties.fec_registro || '';
    currentData.txt_actagraria = properties.txt_actagraria || '';
    currentData.num_superficie = properties.num_superficie || '';
    currentData.txt_regtenencia = properties.txt_regtenencia || '';
    currentData.txt_sexo = properties.txt_sexo || '';
    currentData.txt_departamento = properties.txt_departamento || '';
    currentData.txt_provincia = properties.txt_provincia || '';
    currentData.txt_distrito = properties.txt_distrito || '';

    if (!currentData.nombres && properties.name) {
      currentData.nombres = properties.name;
    }
    this._formData.next(currentData);
  }

  // --- Lógica de Negocio (extraída de registerdata.page.ts) ---

  public async searchDni() {
    const currentFormData = this._formData.getValue();
    if (!currentFormData.dni || currentFormData.dni.length !== 8) {
      const toast = await this.toastController.create({ message: 'Por favor, ingrese un DNI válido de 8 dígitos.', duration: 2000, color: 'warning' });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({ message: 'Buscando DNI...' });
    await loading.present();

    try {
      currentFormData.nombres = '';
      currentFormData.apellido_paterno = '';
      currentFormData.apellido_materno = '';
      this.fillMidagriWithNoData(true);

      let reniecSuccess = false;
      let midagriSuccess = false;

      try {
        const reniecData: ReniecResponse | null = await this.apiService.getReniecData(currentFormData.dni);
        if (reniecData) {
          currentFormData.nombres = (reniecData.first_name || '').toUpperCase();
          currentFormData.apellido_paterno = (reniecData.first_last_name || '').toUpperCase();
          currentFormData.apellido_materno = (reniecData.second_last_name || '').toUpperCase();
          reniecSuccess = true;
        }
      } catch (err: any) {
        console.error('Error al consultar RENIEC:', err.message || err);
      }

      try {
        const productor: MidagriProductor | null = await this.apiService.getMidagriData(currentFormData.dni);
        if (productor) {
          currentFormData.txt_codigoautogenerado = productor.txt_codigoautogenerado || '';
          if (productor.fec_registro) {
            const date = new Date(productor.fec_registro);
            if (!isNaN(date.getTime())) {
              currentFormData.fec_registro = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            } else {
              currentFormData.fec_registro = productor.fec_registro;
            }
          }
          currentFormData.txt_actagraria = productor.txt_actagraria || '';
          currentFormData.num_superficie = productor.num_superficie || '';
          currentFormData.txt_regtenencia = productor.txt_regtenencia || '';
          currentFormData.txt_sexo = productor.txt_sexo || '';
          currentFormData.txt_departamento = productor.txt_departamento || '';
          currentFormData.txt_provincia = productor.txt_provincia || '';
          currentFormData.txt_distrito = productor.txt_distrito || '';
          midagriSuccess = true;
        }
      } catch (midagriError: any) {
        console.error('Error al consultar MIDAGRI:', midagriError.message || midagriError);
      }

      this._formData.next(currentFormData); // Actualiza el estado

      let toastMessage = '';
      let toastColor = 'danger';
      if (reniecSuccess && midagriSuccess) {
        toastMessage = 'Datos de RENIEC y MIDAGRI cargados.';
        toastColor = 'success';
      } else if (reniecSuccess) {
        toastMessage = 'Datos de RENIEC cargados. No se encontraron en MIDAGRI.';
        toastColor = 'warning';
        this.fillMidagriWithNoData();
      } else if (midagriSuccess) {
        toastMessage = 'Datos de MIDAGRI cargados. No se encontraron en RENIEC.';
        toastColor = 'warning';
        const data = this._formData.getValue();
        data.nombres = 'Sin datos';
        data.apellido_paterno = 'Sin datos';
        data.apellido_materno = 'Sin datos';
        this._formData.next(data);
      } else {
        toastMessage = 'DNI no encontrado en ninguna de las fuentes.';
        toastColor = 'danger';
      }
      const toast = await this.toastController.create({ message: toastMessage, duration: 3000, color: toastColor });
      await toast.present();

    } finally {
      await loading.dismiss();
    }
  }

  public async saveData() {
    const geojson = this._geojson.getValue();
    if (!geojson) {
      console.error('No hay GeoJSON para guardar.');
      return;
    }

    const isEditing = !!this._editKey.getValue();
    const geometryType = geojson.geometry.type.toLowerCase();
    let keyPrefix = 'polygon';
    if (geometryType.includes('point')) keyPrefix = 'point';
    else if (geometryType.includes('linestring')) keyPrefix = 'linestring';

    const key = isEditing ? this._editKey.getValue()! : `${keyPrefix}_${new Date().getTime()}`;
    const formData = this._formData.getValue();
    const fullName = `${formData.nombres} ${formData.apellido_paterno} ${formData.apellido_materno}`.trim();

    const newProperties: GeoJsonProperties = {
      ...geojson.properties,
      name: fullName,
      dni: formData.dni,
      nombres: formData.nombres,
      apellido_paterno: formData.apellido_paterno,
      apellido_materno: formData.apellido_materno,
      fecha_nacimiento: formData.fecha_nacimiento,
      celular_participante: formData.celular_participante,
      txt_codigoautogenerado: formData.txt_codigoautogenerado,
      fec_registro: formData.fec_registro,
      txt_actagraria: formData.txt_actagraria,
      num_superficie: formData.num_superficie,
      txt_regtenencia: formData.txt_regtenencia,
      txt_sexo: formData.txt_sexo,
      txt_departamento: formData.txt_departamento,
      txt_provincia: formData.txt_provincia,
      txt_distrito: formData.txt_distrito,
      photos: this._savedPhotoUris.getValue()
    };

    if (isEditing) {
      newProperties.updatedAt = new Date().toISOString();
    } else {
      newProperties.createdAt = new Date().toISOString();
    }
    geojson.properties = newProperties;

    await Preferences.set({ key, value: JSON.stringify(geojson) });

    const toast = await this.toastController.create({
      message: isEditing ? 'Información actualizada con éxito' : 'Registro guardado con éxito',
      duration: 2000,
      color: 'success'
    });
    await toast.present();
    this.navCtrl.navigateBack('/mapa');
  }

  // --- Lógica de Fotos ---

  public async takePicture() {
    if (this._photosForDisplay.getValue().length >= 6) {
      const toast = await this.toastController.create({ message: 'Límite de 6 fotos alcanzado.', duration: 2000, color: 'warning' });
      await toast.present();
      return;
    }

    const permissions = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
      const toast = await this.toastController.create({ message: 'Se necesitan permisos de cámara y galería.', duration: 3000, color: 'warning' });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({ message: 'Procesando foto...' });
    await loading.present();

    try {
      const image = await Camera.getPhoto({
        quality: 90, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera
      });
      if (!image.base64String) return;

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      const coords = position.coords;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        throw new Error('Coordenadas inválidas o nulas recibidas del GPS.');
      }

      const date = new Date();
      const textLines = [
        `Lat: ${coords.latitude.toFixed(5)} Lon: ${coords.longitude.toFixed(5)}`,
        `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
      ];

      const imageWithOverlayBase64 = await this.addTextOverlayToImage(`data:image/jpeg;base64,${image.base64String}`, textLines);
      const fileName = `photo_${new Date().getTime()}.jpeg`;

      const savedFile = await Filesystem.writeFile({
        path: fileName, data: imageWithOverlayBase64, directory: Directory.Data
      });

      try {
        await Filesystem.writeFile({
          path: `GeoDAIS/${fileName}`, data: imageWithOverlayBase64, directory: Directory.Documents, recursive: true
        });
        const toast = await this.toastController.create({ message: 'Copia de la foto guardada en la galería.', duration: 3000, color: 'success' });
        await toast.present();
      } catch (publicSaveError: any) {
        console.error('Error al guardar en almacenamiento público:', publicSaveError.message);
      }

      const currentSavedUris = this._savedPhotoUris.getValue();
      this._savedPhotoUris.next([...currentSavedUris, savedFile.uri]);
      const currentDisplayPhotos = this._photosForDisplay.getValue();
      this._photosForDisplay.next([...currentDisplayPhotos, Capacitor.convertFileSrc(savedFile.uri)]);

    } catch (error: any) {
      const errorMessage = error.message || JSON.stringify(error);
      console.error('Error al tomar la foto:', errorMessage);
      const toast = await this.toastController.create({ message: `Error: ${errorMessage}`, duration: 5000, color: 'danger' });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  public async deletePhoto(index: number) {
    const alert = await this.alertController.create({
      header: 'Confirmar', message: '¿Estás seguro de que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            const uris = this._savedPhotoUris.getValue();
            const displayPhotos = this._photosForDisplay.getValue();
            const uriToDelete = uris[index];
            try {
              await Filesystem.deleteFile({ path: uriToDelete });
            } catch (e) {
              console.warn('No se pudo eliminar el archivo:', uriToDelete, e);
            }
            uris.splice(index, 1);
            displayPhotos.splice(index, 1);
            this._savedPhotoUris.next(uris);
            this._photosForDisplay.next(displayPhotos);
          }
        }
      ]
    });
    await alert.present();
  }

  // --- Métodos Privados de Ayuda (Helper) ---

  private async loadPhotosForDisplay() {
    const displayPhotos: string[] = [];
    for (const fileUri of this._savedPhotoUris.getValue()) {
      displayPhotos.push(Capacitor.convertFileSrc(fileUri));
    }
    this._photosForDisplay.next(displayPhotos);
  }

  private fillMidagriWithNoData(clearOnly: boolean = false) {
    const value = clearOnly ? '' : 'Sin datos';
    const data = this._formData.getValue();
    data.txt_codigoautogenerado = value;
    data.fec_registro = value;
    data.txt_actagraria = value;
    data.num_superficie = value;
    data.txt_regtenencia = value;
    data.txt_sexo = value;
    data.txt_departamento = value;
    data.txt_provincia = value;
    data.txt_distrito = value;
    this._formData.next(data);
  }

  private calculateGeometryData() {
    const geojson = this._geojson.getValue();
    if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return;

    const geometryType = geojson.geometry.type;
    const data = this._formData.getValue();

    if (geometryType === 'Point') {
      data.geometryTypeLabel = 'Punto';
      const coords = geojson.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      data.centroide = `Lat: ${coords[1].toFixed(5)}, Lon: ${coords[0].toFixed(5)}`;
      data.altitud = (coords[2] !== undefined) ? `${coords[2].toFixed(2)} msnm` : 'No disponible';
      data.area = 'N/A (Punto)';
      data.perimetro = 'N/A (Punto)';
    } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      data.geometryTypeLabel = 'Línea';
      const coords = geometryType === 'LineString' ? geojson.geometry.coordinates : geojson.geometry.coordinates[0];
      if (!coords || coords.length < 2) return;
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));
      let length = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        length += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      data.perimetro = `${length.toFixed(2)} m`;
      data.area = 'N/A (Línea)';
      const center = L.polyline(latlngs).getBounds().getCenter();
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      this.calculateAverageAltitude(coords);
    } else { // Polygon or MultiPolygon
      data.geometryTypeLabel = 'Polígono'; 
      let coords = (geometryType === 'Polygon') ? geojson.geometry.coordinates[0] : geojson.geometry.coordinates[0][0];
      if (!coords || coords.length < 3) return;
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));
      const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
      data.area = `${(areaM2 / 10000).toFixed(4)} ha`;
      let perimeter = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        perimeter += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      if (latlngs.length > 0 && latlngs[0].distanceTo(latlngs[latlngs.length - 1]) > 1) {
        perimeter += latlngs[latlngs.length - 1].distanceTo(latlngs[0]);
      }
      data.perimetro = `${perimeter.toFixed(2)} m`;
      const center = L.polygon(latlngs).getBounds().getCenter();
      data.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;
      this.calculateAverageAltitude(coords);
    }
    this._formData.next(data);
  }

  private calculateAverageAltitude(coords: any[]) {
    const altitudes = coords.map((c: any[]) => c[2]).filter((alt: number | undefined) => alt !== undefined && typeof alt === 'number');
    const data = this._formData.getValue();
    if (altitudes.length > 0) {
      const sum = altitudes.reduce((a, b) => a + b, 0);
      data.altitud = `${(sum / altitudes.length).toFixed(2)} msnm`;
    } else {
      data.altitud = 'No disponible';
    }
    this._formData.next(data);
  }

  private addTextOverlayToImage(base64ImageData: string, textLines: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          if (img.width === 0 || img.height === 0) return reject(new Error('La imagen se cargó pero sus dimensiones son 0.'));
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No se pudo obtener el contexto 2D del canvas.'));

          const MAX_DIMENSION = 1920;
          let targetWidth = img.width, targetHeight = img.height;
          if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
              targetWidth = MAX_DIMENSION;
            } else {
              targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
              targetHeight = MAX_DIMENSION;
            }
          }
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const fontSize = Math.max(28, Math.floor(Math.min(targetWidth, targetHeight) / 35));
          const padding = fontSize * 0.7;
          const lineHeight = fontSize * 1.25;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.textAlign = 'left';

          const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
          const bgHeight = (lineHeight * textLines.length) + padding;
          const bgWidth = textWidth + (padding * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, canvas.height - bgHeight, bgWidth, bgHeight);

          ctx.fillStyle = 'white';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 5;
          let y = canvas.height - padding;
          for (let i = textLines.length - 1; i >= 0; i--) {
            ctx.fillText(textLines[i], padding, y);
            y -= lineHeight;
          }
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (err) => reject(new Error(`Error al cargar la imagen: ${JSON.stringify(err)}`));
      img.src = base64ImageData;
    });
  }
}
