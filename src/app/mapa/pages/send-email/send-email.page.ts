import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonBackButton,
  IonButtons
} from '@ionic/angular/standalone'; // LoadingController no es standalone, se inyecta
import { LoadingController } from '@ionic/angular';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-send-email',
  templateUrl: './send-email.page.html',
  styleUrls: ['./send-email.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons
  ]
})
export class SendEmailPage {
  destinatarioEmail: string = '';

  constructor(
    private apiService: ApiService,
    private loadingCtrl: LoadingController
  ) { }

  async enviarReporte() {
    if (!this.destinatarioEmail || !this.destinatarioEmail.includes('@')) {
      alert('Por favor, introduce un email de destino válido.');
      return;
    }

    // TODO: Reemplazar esto con la lógica para obtener el GeoJSON real del mapa
    const miGeoJSON = { "type": "FeatureCollection", "features": [{ "type": "Feature", "properties": { "id": "1", "nombre": "Punto de interés" }, "geometry": { "type": "Point", "coordinates": [-77.0428, -12.0464] } }] };

    const asunto = 'Reporte Geográfico - GeoDAIS';
    const cuerpo = 'Hola,\n\nSe adjunta el reporte geográfico generado desde la aplicación.\n\nSaludos.';
    const nombreArchivo = `reporte-${new Date().toISOString().split('T')[0]}.geojson`;

    const loading = await this.loadingCtrl.create({
      message: 'Enviando reporte...',
    });
    await loading.present();

    try {
      const exito = await this.apiService.enviarGeoJsonPorSendGrid(
        this.destinatarioEmail,
        asunto,
        cuerpo,
        miGeoJSON,
        nombreArchivo
      );

      if (exito) {
        alert('¡Reporte enviado exitosamente!');
      } else {
        alert('Error: No se pudo enviar el reporte. Revisa la consola para más detalles.');
      }
    } catch (error) {
      alert('Error de conexión. No se pudo comunicar con el servicio de envío.');
    } finally {
      await loading.dismiss();
    }
  }
}
