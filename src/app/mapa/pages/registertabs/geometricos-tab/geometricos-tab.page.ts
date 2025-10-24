import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonChip, IonIcon } from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { addIcons } from 'ionicons';
import { mapOutline, analyticsOutline, ellipseOutline, shapesOutline } from 'ionicons/icons';

@Component({
  selector: 'app-geometricos-tab',
  templateUrl: './geometricos-tab.page.html',
  styleUrls: ['./geometricos-tab.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonChip, IonIcon]
})
export class GeometricosTabPage {
  public geometryIcons: { [key: string]: string } = {
    'Polígono': 'map-outline',
    'Línea': 'analytics-outline',
    'Punto': 'ellipse-outline'
  };

  constructor(public registerDataService: RegisterDataService) {
    addIcons({ mapOutline, analyticsOutline, ellipseOutline, shapesOutline });
  }
}