import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonChip,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { AuthService } from 'src/app/services/auth.service';
import { addIcons } from 'ionicons';
import { mapOutline, analyticsOutline, ellipseOutline, shapesOutline, lockClosed } from 'ionicons/icons';

@Component({
  selector: 'app-geometricos-tab',
  templateUrl: './geometricos-tab.page.html',
  styleUrls: ['./geometricos-tab.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonChip,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ]
})
export class GeometricosTabPage implements OnInit {
  public userRole: 'default' | 'polygon-only' | 'other-crops' | 'point-polygon' = 'default';

  public geometryIcons: { [key: string]: string } = {
    'Polígono': 'map-outline',
    'Línea': 'analytics-outline',
    'Punto': 'ellipse-outline'
  };

  constructor(
    public registerDataService: RegisterDataService,
    private authService: AuthService
  ) {
    addIcons({lockClosed,mapOutline,analyticsOutline,ellipseOutline,shapesOutline});
  }

  async ngOnInit() {
    this.userRole = await this.authService.getUserRole();
  }
}
