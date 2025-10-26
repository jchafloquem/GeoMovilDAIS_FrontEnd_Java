import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { search, cameraOutline, trashOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-productor-tab',
  templateUrl: './productor-tab.page.html',
  styleUrls: ['./productor-tab.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
  ]
})
export class ProductorTabPage {

  // Hacemos público el servicio para poder usarlo en el template
  constructor(
    public registerDataService: RegisterDataService,
    private alertController: AlertController
  ) {
    addIcons({ search, cameraOutline, trashOutline });
  }

  // El método searchDni ahora se llama desde el servicio
  searchDni() {
    this.registerDataService.searchDni();
  }

  takeDniPhoto(side: 'front' | 'back') {
    this.registerDataService.takeDniPicture(side);
  }

  async deleteDniPhoto(side: 'front' | 'back', event: MouseEvent) {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: '¿Eliminar esta foto del DNI?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', handler: () => this.registerDataService.deleteDniPicture(side) }
      ]
    });
    await alert.present();
  }

  getCapacitorFileSrc(path: string): string {
    if (!path) return '';
    return Capacitor.convertFileSrc(path);
  }

  /**
   * Ejemplo de cómo usar la validación antes de continuar.
   * Podrías llamar a este método desde un botón "Siguiente" o "Guardar".
   */
  async checkAndProceed() {
    const validation = this.registerDataService.isProductorTabValid();
    if (validation.isValid) {
      console.log('Datos del productor válidos para guardar offline.');
      // Aquí iría la lógica para pasar a la siguiente pestaña o guardar.
    } else {
      // Usamos un toast para notificar del primer campo faltante de forma menos intrusiva.
      this.registerDataService.showToast(`Falta completar: ${validation.missing[0]}`, 'warning');
    }
  }
}
