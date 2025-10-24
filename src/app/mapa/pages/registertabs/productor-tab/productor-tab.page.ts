import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonButton, IonIcon } from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { search } from 'ionicons/icons';

@Component({
  selector: 'app-productor-tab',
  templateUrl: './productor-tab.page.html',
  styleUrls: ['./productor-tab.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonButton, IonIcon]
})
export class ProductorTabPage {

  // Hacemos público el servicio para poder usarlo en el template
  constructor(public registerDataService: RegisterDataService) {
    addIcons({ search });
  }

  // El método searchDni ahora se llama desde el servicio
  searchDni() {
    this.registerDataService.searchDni();
  }
}
