import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  NavController
} from '@ionic/angular/standalone';
import { shapesOutline, locationOutline, analyticsOutline, createOutline, trashOutline, listOutline, imageOutline, ellipsisVerticalOutline, close, mapOutline, listCircleOutline, arrowBackCircleOutline, lockClosed, eyeOutline } from 'ionicons/icons';
import { RegisterDataService, SavedRecordSummary } from 'src/app/services/register-data.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonButtons,
    IonCard,
    IonThumbnail,
    IonImg,
    IonButton]
})
export class ListPage {
  public savedItems: SavedRecordSummary[] = [];

  constructor(
    private navCtrl: NavController,
    private alertController: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private registerDataService: RegisterDataService
  ) {
    addIcons({
      arrowBackCircleOutline,
      listCircleOutline,
      listOutline,
      imageOutline,
      ellipsisVerticalOutline,
      mapOutline,
      shapesOutline,
      locationOutline,
      analyticsOutline,
      createOutline,
      trashOutline,
      close,
      lockClosed,
      eyeOutline
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  ionViewWillEnter() {
    this.loadSavedItems();
  }

  async loadSavedItems() {
    this.savedItems = await this.registerDataService.getSortedSavedRecords();
  }

  editItem(item: SavedRecordSummary) {
    this.navCtrl.navigateForward(`/mapa/registerdata/${item.key}`);
  }

  async presentActionSheet(item: SavedRecordSummary, index: number, event: Event) {
    event.stopPropagation(); // Evita que el click se propague al card

    const buttons = [];

    // 1. Botón Editar / Ver
    if (item.uploaded) {
      buttons.push({
        text: 'Ver (Solo Lectura)',
        icon: 'eye-outline',
        handler: () => {
          this.editItem(item);
        }
      });
    } else {
      buttons.push({
        text: 'Editar',
        icon: 'create-outline',
        handler: () => {
          this.editItem(item);
        }
      });
    }

    // 2. Botón Eliminar (Solo si NO ha sido enviado)
    if (!item.uploaded) {
      buttons.push({
        text: 'Eliminar',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => {
          this.deleteItem(item, index);
        }
      });
    }

    // 3. Botón Cancelar (Siempre visible)
    buttons.push({
      text: 'Cancelar',
      icon: 'close',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: item.uploaded ? `${item.name} (Enviado)` : item.name,
      buttons: buttons
    });
    await actionSheet.present();
  }

  async deleteItem(item: SavedRecordSummary, index: number) {
    // Protección extra: No permitir borrar si está subido (aunque el botón esté oculto)
    if (item.uploaded) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar el registro "${item.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.registerDataService.deleteRecord(item.key);
            this.savedItems.splice(index, 1); // Elimina del array para actualizar la UI
          }
        }
      ]
    });
    await alert.present();
  }
}
