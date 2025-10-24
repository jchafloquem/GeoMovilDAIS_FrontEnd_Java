import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput } from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';

@Component({
  selector: 'app-agrarios-tab',
  templateUrl: './agrarios-tab.page.html',
  styleUrls: ['./agrarios-tab.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonInput]
})
export class AgrariosTabPage {
  constructor(public registerDataService: RegisterDataService) { }
}

