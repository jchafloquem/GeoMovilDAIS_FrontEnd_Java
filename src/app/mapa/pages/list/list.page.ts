import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionSheetController, AlertController, IonBackButton, IonButton, IonButtons, IonCard, IonContent, IonHeader, IonIcon, IonImg, IonItem, IonLabel, IonList, IonThumbnail, IonTitle, IonToolbar, NavController } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { addIcons } from 'ionicons';
import { shapesOutline, locationOutline, analyticsOutline, createOutline, trashOutline, listOutline, imageOutline, ellipsisVerticalOutline, close, mapOutline, listCircleOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';

interface SavedItem {
  key: string;
  name: string;
  type: string;
  icon: string;
  createdAt: string;
  thumbnail?: string;
}

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonList, IonItem, IonLabel, IonIcon, IonBackButton, IonButtons, IonCard, IonThumbnail, IonImg, IonButton]
})
export class ListPage {

  public savedItems: SavedItem[] = [];

  constructor(
    private navCtrl: NavController,
    private alertController: AlertController,
    private actionSheetCtrl: ActionSheetController
  ) {
    addIcons({listCircleOutline,listOutline,imageOutline,ellipsisVerticalOutline,mapOutline,shapesOutline,locationOutline,analyticsOutline,createOutline,trashOutline,close});
  }

  ionViewWillEnter() {
    this.loadSavedItems();
  }

  async loadSavedItems() {
    this.savedItems = [];
    const { keys } = await Preferences.keys();
    const geometryKeys = keys.filter(key => key.startsWith('polygon_') || key.startsWith('point_') || key.startsWith('linestring_'));

    for (const key of geometryKeys) {
      const { value } = await Preferences.get({ key });
      if (value) {
        const geojson = JSON.parse(value);
        const props = geojson.properties || {};
        const geometryType = geojson.geometry?.type || 'Unknown';
        let thumbnailUrl: string | undefined = undefined;

        if (props.photos && props.photos.length > 0) {
          thumbnailUrl = Capacitor.convertFileSrc(props.photos[0]);
        }

        this.savedItems.push({
          key: key,
          name: props.name || 'Registro sin nombre',
          type: geometryType,
          icon: this.getIconForType(geometryType),
          createdAt: props.createdAt ? new Date(props.createdAt).toLocaleDateString('es-PE') : 'Fecha no disponible',
          thumbnail: thumbnailUrl
        });
      }
    }

    // Ordenar por fecha de creación, los más nuevos primero
    this.savedItems.sort((a, b) => {
      const dateA = a.createdAt !== 'Fecha no disponible' ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt !== 'Fecha no disponible' ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  getIconForType(type: string): string {
    if (type.includes('Polygon')) return 'shapes-outline';
    if (type.includes('LineString')) return 'analytics-outline';
    if (type.includes('Point')) return 'location-outline';
    return 'help-circle-outline';
  }

  editItem(item: SavedItem) {
    this.navCtrl.navigateForward(`/mapa/registerdata/${item.key}`);
  }

  async presentActionSheet(item: SavedItem, index: number, event: Event) {
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

  async deleteItem(item: SavedItem, index: number) {
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
            await Preferences.remove({ key: item.key });
            this.savedItems.splice(index, 1); // Elimina del array para actualizar la UI
          }
        }
      ]
    });
    await alert.present();
  }
}
