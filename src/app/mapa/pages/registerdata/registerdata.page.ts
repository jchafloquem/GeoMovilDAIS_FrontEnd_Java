import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { camera, closeCircle, search } from 'ionicons/icons';
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
  IonLabel,
  IonInput,
  ToastController,
  NavController,
  IonGrid,
  IonRow,
  IonCol,
  IonImg,
  IonIcon,
  AlertController,
  LoadingController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { environment } from '../../../../environments/environment';


@Component({
  selector: 'app-registerdata',
  templateUrl: './registerdata.page.html',
  styleUrls: ['./registerdata.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonButtons, IonBackButton, IonButton, RouterLink, IonList, IonItem, IonLabel, IonInput, IonGrid, IonRow, IonCol, IonImg, IonIcon]
})
export class RegisterdataPage implements OnInit {

  public geojson: any;
  public editKey: string | null = null;
  public photosForDisplay: string[] = [];
  private savedPhotoUris: string[] = [];
  public formData = {
    dni: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private zone: NgZone // Inyectar NgZone
  ) {
    addIcons({ camera, closeCircle, search });
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
    this.formData = { dni: '', nombres: '', apellido_paterno: '', apellido_materno: '' };

    // 2. Determinamos si estamos en modo EDICIÓN (vía URL) o CREACIÓN (vía state).
    const keyFromUrl = this.route.snapshot.paramMap.get('key');

    if (keyFromUrl) {
      // MODO EDICIÓN: Cargamos los datos desde Preferences usando la clave de la URL.
      this.editKey = keyFromUrl;
      console.log('Modo edición por URL. Clave:', this.editKey);

      const { value } = await Preferences.get({ key: this.editKey });
      if (value) {
        this.geojson = JSON.parse(value);
        if (this.geojson?.properties) {
          // Cargar datos del formulario
          this.formData.dni = this.geojson.properties.dni || '';
          this.formData.nombres = this.geojson.properties.nombres || '';
          this.formData.apellido_paterno = this.geojson.properties.apellido_paterno || '';
          this.formData.apellido_materno = this.geojson.properties.apellido_materno || '';

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
      // NOTA DE SEGURIDAD: El token no debería estar aquí en una app de producción.
      // Considera moverlo a variables de entorno para mayor seguridad.
      const token = 'sk_2622.FO9PZhk5V73qfhjWluim7DJ4gOCjG8al';
      // Usamos el plugin nativo de Cordova para evitar problemas de CORS en el dispositivo.
      const url = `${environment.apiUrl}/reniec/dni?numero=${this.formData.dni}`


      console.log('URL generada:', url);

      const response: HttpResponse = await CapacitorHttp.get({
        url,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = response.data;
      if (data && data.first_name) {
        this.formData.nombres = this.toTitleCase(data.first_name || '');
        this.formData.apellido_paterno = this.toTitleCase(data.first_last_name || '');
        this.formData.apellido_materno = this.toTitleCase(data.second_last_name || '');
        const toast = await this.toastController.create({
          message: 'Nombre completado.',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
      } else {
        const message = data.message || 'DNI no encontrado o respuesta inesperada.';
        const toast = await this.toastController.create({ message, duration: 3000, color: 'danger' });
        await toast.present();
      }
    } catch (err: any) {
      console.error('Error al buscar DNI:', err);
      let errorMessage = 'Error al consultar el DNI. Verifique su conexión.';
      if (err.message) {
        errorMessage = err.message;
      }
      const toast = await this.toastController.create({ message: errorMessage, duration: 4000, color: 'danger' });
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
    const key = isEditing ? this.editKey! : `polygon_${new Date().getTime()}`;

    // Añadimos los datos del formulario a las propiedades del GeoJSON
    const fullName = `${this.formData.nombres} ${this.formData.apellido_paterno} ${this.formData.apellido_materno}`.trim();
    const newProperties: any = {
      ...this.geojson.properties, // Mantiene propiedades existentes si las hubiera
      name: fullName, // Guardamos el nombre completo para compatibilidad y visualización rápida
      dni: this.formData.dni,
      nombres: this.formData.nombres,
      apellido_paterno: this.formData.apellido_paterno,
      apellido_materno: this.formData.apellido_materno,
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
    const toast = await this.toastController.create({
      message: isEditing ? 'Información actualizada con éxito' : 'Polígono guardado con éxito',
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

  private toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
  }
}
