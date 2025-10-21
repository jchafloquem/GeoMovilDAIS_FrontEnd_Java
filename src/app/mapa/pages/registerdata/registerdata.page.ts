import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { camera, closeCircle } from 'ionicons/icons';
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
  AlertController
} from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';


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
    name: '',
    description: ''
  };

  constructor(
    private router: Router,
    private toastController: ToastController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private zone: NgZone // Inyectar NgZone
  ) {
    addIcons({ camera, closeCircle });
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;
    if (state) {
      // Ejecutamos la lógica de inicialización dentro de la zona de Angular
      // para asegurar que los cambios en las propiedades del componente
      // sean detectados y la vista se actualice correctamente en el dispositivo.
      this.zone.run(async () => {
        this.geojson = state['geojson'];
        this.editKey = state['key'] || null; // Capturamos la clave si existe

        if (this.editKey && this.geojson?.properties) {
          console.log('Modo edición detectado. Clave:', this.editKey);
          console.log('GeoJSON recibido para edición:', this.geojson);
          console.log('Propiedades del GeoJSON:', this.geojson.properties);

          this.formData.name = this.geojson.properties.name || '';
          this.formData.description = this.geojson.properties.description || '';
          console.log('Formulario pre-llenado: Nombre=', this.formData.name, 'Descripción=', this.formData.description);

          if (this.geojson.properties.photos && Array.isArray(this.geojson.properties.photos)) {
            this.savedPhotoUris = this.geojson.properties.photos;
            await this.loadPhotosForDisplay(); // Usar await aquí
          }
        } else {
          console.log('Modo creación de nuevo polígono.');
        }
      });
    }
  }

  ngOnInit() {
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

  async takePicture() {
    if (this.photosForDisplay.length >= 6) {
      const toast = await this.toastController.create({ message: 'Límite de 6 fotos alcanzado.', duration: 2000, color: 'warning' });
      await toast.present();
      return;
    }

    try {
      // 1. Tomar la foto
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (!image.base64String) return;

      // 2. Obtener coordenadas y fecha/hora para la marca de agua
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

      // 3. Añadir la marca de agua a la imagen
      const imageWithOverlayBase64 = await this.addTextOverlayToImage(`data:image/jpeg;base64,${image.base64String}`, textLines);

      // 4. Guardar la nueva imagen en el sistema de archivos del dispositivo
      const fileName = `photo_${new Date().getTime()}.jpeg`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: imageWithOverlayBase64,
        directory: Directory.Data // Almacenamiento privado de la app
      });

      // 5. Añadir a las listas para la UI y para guardar en el GeoJSON
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
    const newProperties: any = {
      ...this.geojson.properties, // Mantiene propiedades existentes si las hubiera
      name: this.formData.name,
      description: this.formData.description,
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

          // 1. Dibuja la imagen original
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);

          // 2. Configuración de estilo profesional
          const fontSize = Math.max(28, Math.floor(Math.min(img.width, img.height) / 35));
          const padding = fontSize * 0.7;
          const lineHeight = fontSize * 1.25;

          ctx.font = `bold ${fontSize}px sans-serif`; // Usar fuente genérica para compatibilidad
          ctx.textBaseline = 'bottom';
          ctx.textAlign = 'left';

          // 3. Dibuja un fondo semitransparente para el texto
          const textWidth = Math.max(...textLines.map(line => ctx.measureText(line).width));
          const bgHeight = (lineHeight * textLines.length) + padding;
          const bgWidth = textWidth + (padding * 2);
          const bgX = 0;
          const bgY = canvas.height - bgHeight;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

          // 4. Dibuja el texto (blanco con sombra)
          ctx.fillStyle = 'white';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 5;

          // Dibujar las líneas de texto de abajo hacia arriba
          let y = canvas.height - padding;
          for (let i = textLines.length - 1; i >= 0; i--) {
            ctx.fillText(textLines[i], padding, y);
            y -= lineHeight;
          }

          // 5. Devolver la imagen procesada
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
}
