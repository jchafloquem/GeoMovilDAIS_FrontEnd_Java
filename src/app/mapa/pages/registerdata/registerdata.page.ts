import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  ToastController,
  NavController
} from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { Preferences } from '@capacitor/preferences';


@Component({
  selector: 'app-registerdata',
  templateUrl: './registerdata.page.html',
  styleUrls: ['./registerdata.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonButtons, IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, RouterLink, IonList, IonItem, IonLabel, IonInput]
})
export class RegisterdataPage implements OnInit {

  public geojson: any;
  public formData = {
    name: '',
    description: ''
  };

  constructor(private router: Router, private toastController: ToastController, private navCtrl: NavController) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['geojson']) {
      this.geojson = navigation.extras.state['geojson'];
      console.log('GeoJSON recibido en la página de registro:', this.geojson);
      // Aquí puedes procesar el geojson, por ejemplo, mostrarlo en un formulario o guardarlo.
    }
  }

  ngOnInit() {
  }

  async saveData() {
    if (!this.geojson) {
      console.error('No hay GeoJSON para guardar.');
      return;
    }

    // Añadimos los datos del formulario a las propiedades del GeoJSON
    this.geojson.properties = {
      ...this.geojson.properties, // Mantiene propiedades existentes si las hubiera
      name: this.formData.name,
      description: this.formData.description,
      createdAt: new Date().toISOString()
    };

    // Creamos una clave única para este polígono
    const key = `polygon_${new Date().getTime()}`;

    // Guardamos el objeto GeoJSON como un string en Preferences
    await Preferences.set({
      key: key,
      value: JSON.stringify(this.geojson)
    });

    const toast = await this.toastController.create({ message: 'Polígono guardado con éxito', duration: 2000, color: 'success' });
    await toast.present();
    this.navCtrl.navigateBack('/mapa');
  }
}
