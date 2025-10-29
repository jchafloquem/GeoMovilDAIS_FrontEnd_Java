import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionSheetController, AlertController, IonBackButton, IonButton, IonButtons, IonCard, IonContent, IonHeader, IonIcon, IonImg, IonItem, IonLabel, IonList, IonThumbnail, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { shapesOutline, locationOutline, analyticsOutline, createOutline, trashOutline, listOutline, imageOutline, ellipsisVerticalOutline, close, mapOutline, listCircleOutline } from 'ionicons/icons';
import { RegisterDataService, SavedRecordSummary } from 'src/app/services/register-data.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonList, IonItem, IonLabel, IonIcon, IonBackButton, IonButtons, IonCard, IonThumbnail, IonImg, IonButton]
})
export class ListPage {
  public savedItems: SavedRecordSummary[] = [];

  constructor(
    private navCtrl: NavController,
    private alertController: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private registerDataService: RegisterDataService
  ) {
    addIcons({listCircleOutline,listOutline,imageOutline,ellipsisVerticalOutline,mapOutline,shapesOutline,locationOutline,analyticsOutline,createOutline,trashOutline,close});
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

    const actionSheet = await this.actionSheetCtrl.create({
      header: item.name,
      buttons: [
        {
          text: 'Editar',
          icon: 'create-outline',
          handler: () => {
            this.editItem(item);
          }
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.deleteItem(item, index);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async deleteItem(item: SavedRecordSummary, index: number) {
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
