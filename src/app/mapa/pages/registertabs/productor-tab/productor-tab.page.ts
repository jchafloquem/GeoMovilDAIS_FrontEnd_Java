import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, IonItemDivider, IonLabel, AlertController } from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { search, cameraOutline, trashOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-productor-tab',
  templateUrl: './productor-tab.page.html',
  styleUrls: ['./productor-tab.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, IonItemDivider, IonLabel]
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
}
