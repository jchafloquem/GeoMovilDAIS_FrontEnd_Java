import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
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
import { RegisterDataService } from '../../../../services/register-data.service';
import { AuthService } from '../../../../services/auth.service';
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
  public userRole: 'default' | 'polygon-only' | 'other-crops' | 'point-polygon' | 'animal-crops' = 'default';

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

  /**
   * Devuelve true si el cultivo debe ser ocultado en el selector para este usuario.
   * Úsalo en el HTML con: <ion-select-option *ngIf="!isRestricted('APICOLA')">...
   */
  public isRestricted(cropValue: string): boolean {
    if (this.userRole !== 'other-crops') return false;

    const restricted = ['APICOLA', 'ACUICOLA', 'AVICOLA'];
    if (!restricted.includes(cropValue.toUpperCase())) return false;

    // Verificamos si la geometría actual es un polígono
    let isPolygon = false;
    this.registerDataService.geojson$.pipe(take(1)).subscribe(geo => {
      isPolygon = !!geo?.geometry.type.toLowerCase().includes('polygon');
    });

    return isPolygon;
  }
}
