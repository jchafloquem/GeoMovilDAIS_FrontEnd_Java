import { Component, CUSTOM_ELEMENTS_SCHEMA, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { camera, closeCircle, search, mapOutline, arrowBackCircleOutline } from 'ionicons/icons';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonButton,
  IonList,
  IonItem,
  IonInput,
  ToastController,
  NavController,
  IonImg,
  IonIcon,
  AlertController,
  LoadingController,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core'; // Eliminamos HttpResponse ya que no se usa directamente aquí para llamadas API
import { ApiService, MidagriProductor, ReniecResponse } from 'src/app/services/api.service';
import { register } from 'swiper/element/bundle';
import * as L from 'leaflet';

// Interfaz para las propiedades del GeoJSON, asegura un tipado fuerte.
interface GeoJsonProperties {
  name: string;
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
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



@Component({
  selector: 'app-registerdata',
  templateUrl: './registerdata.page.html',
  styleUrls: ['./registerdata.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonButtons, IonBackButton, IonButton, RouterLink, IonList, IonItem, IonInput, IonImg, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RegisterdataPage implements OnInit {

  public geojson: any;
  public editKey: string | null = null;
  public photosForDisplay: string[] = [];
  private savedPhotoUris: string[] = [];
  // Opciones para el carrusel de fotos
  public slideOpts = {
    slidesPerView: 1.5,
    spaceBetween: 10,
    centeredSlides: true,
  };
  public formData = {
    dni: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
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
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private zone: NgZone, // Inyectar NgZone
    private apiService: ApiService // Inyectar el nuevo ApiService
  ) {
    addIcons({arrowBackCircleOutline,mapOutline,search,camera,closeCircle});
    register();
  }

  ngOnInit() {
  }

  ionViewWillEnter() {
    this.initializeFromRoute();
  }

  private async initializeFromRoute() {
    // 1. Reseteamos el estado para asegurar una página limpia en cada visita.
    this.geojson = null;
    this.editKey = null;
    this.photosForDisplay = [];
    this.savedPhotoUris = [];
    this.formData = {
      dni: '',
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
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
    };

    // 2. Determinamos si estamos en modo EDICIÓN (vía URL) o CREACIÓN (vía state).
    const keyFromUrl = this.route.snapshot.paramMap.get('key');

    if (keyFromUrl) {
      // MODO EDICIÓN: Cargamos los datos desde Preferences usando la clave de la URL.
      this.editKey = keyFromUrl;
      console.log('Modo edición por URL. Clave:', this.editKey);

      const { value } = await Preferences.get({ key: this.editKey });
      if (value) {
        this.geojson = JSON.parse(value);
        this.calculateGeometryData(); // Calculate data from GeoJSON
        if (this.geojson?.properties) {
          // Cargar datos del formulario
          this.formData.dni = this.geojson.properties.dni || '';
          this.formData.nombres = this.geojson.properties.nombres || '';
          this.formData.apellido_paterno = this.geojson.properties.apellido_paterno || '';
          this.formData.apellido_materno = this.geojson.properties.apellido_materno || '';
          this.formData.txt_codigoautogenerado = this.geojson.properties.txt_codigoautogenerado || '';
          this.formData.fec_registro = this.geojson.properties.fec_registro || '';
          this.formData.txt_actagraria = this.geojson.properties.txt_actagraria || '';
          this.formData.num_superficie = this.geojson.properties.num_superficie || '';
          this.formData.txt_regtenencia = this.geojson.properties.txt_regtenencia || '';
          this.formData.txt_sexo = this.geojson.properties.txt_sexo || '';
          this.formData.txt_departamento = this.geojson.properties.txt_departamento || '';
          this.formData.txt_provincia = this.geojson.properties.txt_provincia || '';
          this.formData.txt_distrito = this.geojson.properties.txt_distrito || '';

          // Fallback para datos antiguos que solo tienen la propiedad 'name'
          if (!this.formData.nombres && this.geojson.properties.name) {
            // Colocamos el nombre completo en el campo de nombres como fallback.
            // El usuario puede volver a consultar el DNI para separarlos.
            this.formData.nombres = this.geojson.properties.name;
          }

          if (this.geojson.properties.photos && Array.isArray(this.geojson.properties.photos)) {
            this.savedPhotoUris = this.geojson.properties.photos;
            await this.loadPhotosForDisplay();
          }
        }
      } else {
        console.error('No se encontró el polígono para la clave:', this.editKey);
        const toast = await this.toastController.create({
          message: 'Error: No se pudo cargar el polígono para editar.',
          duration: 3000,
          color: 'danger'
        });
        await toast.present();
        this.navCtrl.navigateBack('/mapa');
      }
    } else {
      // MODO CREACIÓN: Obtenemos el GeoJSON de la navegación.
      const state = history.state;
      if (state && state.geojson) {
        this.geojson = state.geojson;
        this.calculateGeometryData(); // Calculate data from GeoJSON
        console.log('Modo creación de nuevo polígono.');
      } else {
        console.warn('Página de registro abierta sin GeoJSON para crear o clave para editar.');
      }
    }
  }

  private async loadPhotosForDisplay() {
    this.photosForDisplay = [];
    console.log('Iniciando carga de fotos para display. savedPhotoUris:', this.savedPhotoUris);
    for (const fileUri of this.savedPhotoUris) {
      // Convierte la URI del archivo guardado a una URL que el navegador pueda mostrar
      const convertedUri = Capacitor.convertFileSrc(fileUri);
      this.photosForDisplay.push(convertedUri);
      console.log('Foto convertida para display:', convertedUri);
    }
    console.log('Fotos cargadas para display:', this.photosForDisplay);
  }

  async searchDni() {
    if (!this.formData.dni || this.formData.dni.length !== 8) {
      const toast = await this.toastController.create({
        message: 'Por favor, ingrese un DNI válido de 8 dígitos.',
        duration: 2000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Buscando DNI...',
    });
    await loading.present();

    try {
      // 1. Limpiar datos previos antes de una nueva búsqueda.
      this.formData.nombres = '';
      this.formData.apellido_paterno = '';
      this.formData.apellido_materno = '';
      this.fillMidagriWithNoData(true); // Limpiar campos de Midagri

      let reniecSuccess = false;
      let midagriSuccess = false;

      // 2. Consultar RENIEC
      try {
        // Usamos el servicio para obtener los datos de RENIEC
        const reniecData: ReniecResponse | null = await this.apiService.getReniecData(this.formData.dni);
        if (reniecData) {
          this.formData.nombres = (reniecData.first_name || '').toUpperCase();
          this.formData.apellido_paterno = (reniecData.first_last_name || '').toUpperCase();
          this.formData.apellido_materno = (reniecData.second_last_name || '').toUpperCase();
          reniecSuccess = true;
          console.log('RENIEC: Datos encontrados y cargados correctamente.');
        }
      } catch (err: any) {
        console.error('Error al consultar RENIEC (se continuará con MIDAGRI):', err.message || err);
      }

      // 3. Consultar MIDAGRI (se ejecuta siempre, sin importar el resultado de RENIEC)
      try {
        // Usamos el servicio para obtener los datos de MIDAGRI
        const productor: MidagriProductor | null = await this.apiService.getMidagriData(this.formData.dni);

        if (productor) {
          this.formData.txt_codigoautogenerado = productor.txt_codigoautogenerado || '';
          // Formatear la fecha de registro a dd/mm/aaaa
          if (productor.fec_registro) {
            const date = new Date(productor.fec_registro);
            if (!isNaN(date.getTime())) {
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexados
              const year = date.getFullYear();
              this.formData.fec_registro = `${day}/${month}/${year}`;
            } else {
              this.formData.fec_registro = productor.fec_registro; // Fallback si la fecha no es válida
            }
          }
          this.formData.txt_actagraria = productor.txt_actagraria || '';
          this.formData.num_superficie = productor.num_superficie || '';
          this.formData.txt_regtenencia = productor.txt_regtenencia || '';
          this.formData.txt_sexo = productor.txt_sexo || '';
          this.formData.txt_departamento = productor.txt_departamento || '';
          this.formData.txt_provincia = productor.txt_provincia || '';
          this.formData.txt_distrito = productor.txt_distrito || '';
          midagriSuccess = true;
          console.log('MIDAGRI: Datos encontrados y cargados correctamente.');
        } else {
          console.log('MIDAGRI: No se encontraron datos válidos en la respuesta.');
        }
      } catch (midagriError: any) { // Capturamos errores lanzados por el servicio
        console.error('Error al consultar MIDAGRI (excepción):', midagriError.message || midagriError); // Registramos el mensaje de error específico del servicio
      }

      // 4. Determinar el mensaje final basado en los resultados
      let toastMessage = '';
      let toastColor = 'danger';

      if (reniecSuccess && midagriSuccess) {
        toastMessage = 'Datos de RENIEC y MIDAGRI cargados.';
        toastColor = 'success';
      } else if (reniecSuccess) {
        toastMessage = 'Datos de RENIEC cargados. No se encontraron en MIDAGRI.';
        toastColor = 'warning';
        this.fillMidagriWithNoData(); // Rellenar con "Sin datos"
      } else if (midagriSuccess) {
        toastMessage = 'Datos de MIDAGRI cargados. No se encontraron en RENIEC.';
        toastColor = 'warning';
        this.formData.nombres = 'Sin datos';
        this.formData.apellido_paterno = 'Sin datos';
        this.formData.apellido_materno = 'Sin datos';
      } else {
        toastMessage = 'DNI no encontrado en ninguna de las fuentes.';
        toastColor = 'danger';
      }

      const toast = await this.toastController.create({
        message: toastMessage,
        duration: 3000,
        color: toastColor
      });
      await toast.present();

    } finally {
      // Esto asegura que el loading se cierre siempre.
      await loading.dismiss();
    }
  }

  async takePicture() {
    if (this.photosForDisplay.length >= 6) {
      const toast = await this.toastController.create({ message: 'Límite de 6 fotos alcanzado.', duration: 2000, color: 'warning' });
      await toast.present();
      return;
    }

    // 1. Solicitar permisos de cámara y galería antes de continuar.
    // Esto es crucial para que el guardado en directorios públicos funcione en Android.
    const permissions = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
      const toast = await this.toastController.create({
        message: 'Se necesitan permisos de cámara y galería para usar esta función.',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Procesando foto...',
    });
    await loading.present();

    try {
      // 2. Tomar la foto
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (!image.base64String) return;

      // 3. Obtener coordenadas y fecha/hora para la marca de agua
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 segundos de tiempo de espera
        maximumAge: 0   // No usar una posición en caché para forzar una nueva lectura
      };
      const position = await Geolocation.getCurrentPosition(geoOptions);
      const coords = position.coords;

      // Verificación y depuración: Asegurarse de que las coordenadas son válidas
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        throw new Error('Coordenadas inválidas o nulas recibidas del GPS.');
      }
      // Este log es crucial para depurar. Revisa la consola del dispositivo.
      console.log(`Coordenadas obtenidas para la foto: Lat ${coords.latitude}, Lon ${coords.longitude}`);

      const date = new Date();
      const textLines = [
        `Lat: ${coords.latitude.toFixed(5)} Lon: ${coords.longitude.toFixed(5)}`,
        `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
      ];

      // 4. Añadir la marca de agua a la imagen
      const imageWithOverlayBase64 = await this.addTextOverlayToImage(`data:image/jpeg;base64,${image.base64String}`, textLines);

      const fileName = `photo_${new Date().getTime()}.jpeg`;

      // 5. Guardar la nueva imagen en el almacenamiento PRIVADO de la app (para uso interno)
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: imageWithOverlayBase64,
        directory: Directory.Data
      });

      // 6. Guardar una copia en el almacenamiento PÚBLICO para que sea visible en la galería.
      try {
        // Usamos Directory.Documents, que es el directorio público correcto y compatible
        // con las restricciones de "Scoped Storage" de Android moderno.
        // La carpeta 'GeoDAIS' se creará aquí si no existe.
        await Filesystem.writeFile({
          path: `GeoDAIS/${fileName}`,
          data: imageWithOverlayBase64,
          directory: Directory.Documents,
          recursive: true // Esencial para crear la carpeta GeoDAIS
        });
        const toast = await this.toastController.create({
          message: 'Copia de la foto guardada en la galería (Álbum GeoDAIS).',
          duration: 3000,
          color: 'success'
        });
        await toast.present();
      } catch (publicSaveError: any) {
        const errorMessage = publicSaveError.message || JSON.stringify(publicSaveError);
        console.error('Error al guardar en almacenamiento público:', errorMessage);
        const toast = await this.toastController.create({
          message: `No se pudo guardar la copia pública. Error: ${errorMessage}`,
          duration: 5000,
          color: 'danger'
        });
        await toast.present();
      }

      // 7. Añadir la URI del archivo PRIVADO a nuestras listas para la UI.
      this.savedPhotoUris.push(savedFile.uri);
      this.photosForDisplay.push(Capacitor.convertFileSrc(savedFile.uri));

    } catch (error: any) {
      // Hacemos el mensaje de error más específico para depuración
      const errorMessage = error.message || JSON.stringify(error);
      console.error('Error al tomar la foto:', errorMessage);
      const toast = await this.toastController.create({
        message: `Error: ${errorMessage}`,
        duration: 5000, // Más tiempo para poder leerlo
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async deletePhoto(index: number) {
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: '¿Estás seguro de que quieres eliminar esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            const uriToDelete = this.savedPhotoUris[index];
            try {
              // Eliminar el archivo del dispositivo
              await Filesystem.deleteFile({ path: uriToDelete });
            } catch (e) {
              console.warn('No se pudo eliminar el archivo, puede que ya no exista:', uriToDelete, e);
            }
            // Eliminar de las listas
            this.savedPhotoUris.splice(index, 1);
            this.photosForDisplay.splice(index, 1);
          }
        }
      ]
    });
    await alert.present();
  }

  async saveData() {
    if (!this.geojson) {
      console.error('No hay GeoJSON para guardar.');
      return;
    }

    const isEditing = !!this.editKey;
    // Determina el tipo de geometría para generar la clave correcta
    const geometryType = this.geojson.geometry.type.toLowerCase();
    let keyPrefix = 'polygon'; // Default
    if (geometryType.includes('point')) {
      keyPrefix = 'point';
    } else if (geometryType.includes('linestring')) {
      keyPrefix = 'linestring';
    }

    const key = isEditing ? this.editKey! : `${keyPrefix}_${new Date().getTime()}`;

    // Añadimos los datos del formulario a las propiedades del GeoJSON
    const fullName = `${this.formData.nombres} ${this.formData.apellido_paterno} ${this.formData.apellido_materno}`.trim();
    const newProperties: GeoJsonProperties = {
      ...this.geojson.properties, // Mantiene propiedades existentes si las hubiera
      name: fullName,
      dni: this.formData.dni,
      nombres: this.formData.nombres,
      apellido_paterno: this.formData.apellido_paterno,
      apellido_materno: this.formData.apellido_materno,
      txt_codigoautogenerado: this.formData.txt_codigoautogenerado,
      fec_registro: this.formData.fec_registro,
      txt_actagraria: this.formData.txt_actagraria,
      num_superficie: this.formData.num_superficie,
      txt_regtenencia: this.formData.txt_regtenencia,
      txt_sexo: this.formData.txt_sexo,
      txt_departamento: this.formData.txt_departamento,
      txt_provincia: this.formData.txt_provincia,
      txt_distrito: this.formData.txt_distrito,
      photos: this.savedPhotoUris // Guardamos las URIs de las fotos
    };

    if (isEditing) {
      newProperties.updatedAt = new Date().toISOString();
    } else {
      newProperties.createdAt = new Date().toISOString();
    }
    this.geojson.properties = newProperties;

    // Guardamos el objeto GeoJSON como un string en Preferences
    await Preferences.set({
      key: key,
      value: JSON.stringify(this.geojson)
    });
    const toastMessage = isEditing
      ? 'Información actualizada con éxito'
      : 'Registro guardado con éxito';
    const toast = await this.toastController.create({
      message: toastMessage,
      duration: 2000,
      color: 'success'
    });
    await toast.present();
    this.navCtrl.navigateBack('/mapa');
  }

  private addTextOverlayToImage(base64ImageData: string, textLines: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          if (img.width === 0 || img.height === 0) {
            return reject(new Error('La imagen se cargó pero sus dimensiones son 0.'));
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('No se pudo obtener el contexto 2D del canvas.'));
          }

          // 1. Redimensionar la imagen para evitar problemas de memoria y rendimiento.
          const MAX_DIMENSION = 1920; // Límite para la dimensión más grande (ancho o alto)
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
            if (targetWidth > targetHeight) { // Imagen horizontal
              targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
              targetWidth = MAX_DIMENSION;
            } else { // Imagen vertical o cuadrada
              targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
              targetHeight = MAX_DIMENSION;
            }
          }

          // 2. Dibuja la imagen redimensionada en el canvas
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // 3. Configuración de estilo profesional, basado en las nuevas dimensiones
          const fontSize = Math.max(28, Math.floor(Math.min(targetWidth, targetHeight) / 35));
          const padding = fontSize * 0.7;
          const lineHeight = fontSize * 1.25;

          ctx.font = `bold ${fontSize}px sans-serif`; // Usar fuente genérica para compatibilidad
          ctx.textBaseline = 'bottom';
          ctx.textAlign = 'left';

          // 4. Dibuja un fondo semitransparente para el texto
          const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
          const bgHeight = (lineHeight * textLines.length) + padding;
          const bgWidth = textWidth + (padding * 2);
          const bgX = 0;
          const bgY = canvas.height - bgHeight;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

          // 5. Dibuja el texto (blanco con sombra)
          ctx.fillStyle = 'white';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 5;

          // Dibujar las líneas de texto de abajo hacia arriba
          let y = canvas.height - padding;
          for (let i = textLines.length - 1; i >= 0; i--) {
            ctx.fillText(textLines[i], padding, y);
            y -= lineHeight;
          }

          // 6. Devolver la imagen procesada como un data URL completo.
          // El plugin Filesystem debería ser capaz de manejarlo directamente.
          resolve(canvas.toDataURL('image/jpeg', 0.9));

        } catch (e) {
          reject(e);
        }
      };

      img.onerror = (err) => {
        reject(new Error(`Error al cargar la imagen: ${JSON.stringify(err)}`));
      };

      img.src = base64ImageData;
    });
  }

  private fillMidagriWithNoData(clearOnly: boolean = false) {
    const value = clearOnly ? '' : 'Sin datos';
    this.formData.txt_codigoautogenerado = value;
    this.formData.fec_registro = value;
    this.formData.txt_actagraria = value;
    this.formData.num_superficie = value;
    this.formData.txt_regtenencia = value;
    this.formData.txt_sexo = value;
    this.formData.txt_departamento = value;
    this.formData.txt_provincia = value;
    this.formData.txt_distrito = value;
  }

  private calculateGeometryData() {
    if (!this.geojson || !this.geojson.geometry || !this.geojson.geometry.coordinates) {
      return;
    }

    const geometryType = this.geojson.geometry.type;

    // --- INICIO: Lógica para Puntos ---
    if (geometryType === 'Point') {
      const coords = this.geojson.geometry.coordinates;
      if (!coords || coords.length < 2) {
        return;
      }

      const lon = coords[0];
      const lat = coords[1];
      const alt = coords[2]; // The 'z' coordinate (x, y, z)

      this.formData.centroide = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;

      if (alt !== undefined && typeof alt === 'number') {
        this.formData.altitud = `${alt.toFixed(2)} msnm`;
      } else {
        this.formData.altitud = 'No disponible';
      }

      this.formData.area = 'N/A (Punto)';
      this.formData.perimetro = 'N/A (Punto)';
      return; // Termina el cálculo para Puntos
    }
    // --- FIN: Lógica para Puntos ---

    // --- INICIO: Lógica para Líneas ---
    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      const coords = geometryType === 'LineString' ? this.geojson.geometry.coordinates : this.geojson.geometry.coordinates[0];
      if (!coords || coords.length < 2) {
        return;
      }
      const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));

      // 1. Longitud (usaremos el campo 'perimetro')
      let length = 0;
      for (let i = 0; i < latlngs.length - 1; i++) {
        length += latlngs[i].distanceTo(latlngs[i + 1]);
      }
      this.formData.perimetro = `${length.toFixed(2)} m`;

      // 2. Área no aplica
      this.formData.area = 'N/A (Línea)';

      // 3. Punto Central
      const lineForCenter = L.polyline(latlngs);
      const center = lineForCenter.getBounds().getCenter();
      this.formData.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;

      // 4. Altitud (igual que polígono)
      this.calculateAverageAltitude(coords);
      return; // Termina el cálculo para Líneas
    }
    // --- FIN: Lógica para Puntos ---

    // Handle both Polygon and MultiPolygon
    let coords = [];

    if (geometryType === 'Polygon') {
      coords = this.geojson.geometry.coordinates[0];
    } else if (geometryType === 'MultiPolygon') {
      // For MultiPolygon, let's take the first polygon for simplicity
      coords = this.geojson.geometry.coordinates[0][0];
    }

    if (!coords || coords.length < 3) {
      return;
    }

    const latlngs: L.LatLng[] = coords.map((c: any) => L.latLng(c[1], c[0]));

    // 1. Area
    const areaM2 = L.GeometryUtil.geodesicArea(latlngs);
    const areaHa = areaM2 / 10000;
    this.formData.area = `${areaHa.toFixed(4)} ha`;

    // 2. Perimetro
    let perimeter = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      perimeter += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    // Add distance from last to first point to close the polygon
    if (latlngs.length > 0 && latlngs[0].distanceTo(latlngs[latlngs.length - 1]) > 1) {
      perimeter += latlngs[latlngs.length - 1].distanceTo(latlngs[0]);
    }
    this.formData.perimetro = `${perimeter.toFixed(2)} m`;

    // 3. Centroide
    const polygonForCentroid = L.polygon(latlngs);
    const center = polygonForCentroid.getBounds().getCenter();
    this.formData.centroide = `Lat: ${center.lat.toFixed(5)}, Lon: ${center.lng.toFixed(5)}`;

    // 4. Altitud Promedio
    this.calculateAverageAltitude(coords);
  }

  private calculateAverageAltitude(coords: any[]) {
    // Check if coordinates have altitude data (a third value in the array [lon, lat, alt])
    const altitudes = coords
      .map((c: any[]) => c[2]) // Get the third element (altitude)
      .filter((alt: number | undefined) => alt !== undefined && typeof alt === 'number'); // Filter out undefined or non-numeric values

    if (altitudes.length > 0) {
      const sum = altitudes.reduce((a, b) => a + b, 0);
      const avgAltitude = sum / altitudes.length;
      this.formData.altitud = `${avgAltitude.toFixed(2)} msnm`;
    } else {
      // Fallback if no altitude data is present in the GeoJSON coordinates
      this.formData.altitud = 'No disponible';
    }
  }
}
