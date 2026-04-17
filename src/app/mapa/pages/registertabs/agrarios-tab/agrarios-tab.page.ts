import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonIcon } from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { lockClosed, barcodeOutline, calendarClearOutline, leafOutline, resizeOutline, keyOutline, transgenderOutline, mapOutline } from 'ionicons/icons';

@Component({
  selector: 'app-agrarios-tab',
  templateUrl: './agrarios-tab.page.html',
  styleUrls: ['./agrarios-tab.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput, IonIcon]
})
export class AgrariosTabPage {
  constructor(public registerDataService: RegisterDataService) {
    addIcons({lockClosed,barcodeOutline,calendarClearOutline,leafOutline,resizeOutline,keyOutline,transgenderOutline,mapOutline});
  }
}
