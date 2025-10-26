import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
} from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';

// Define una interfaz para el perfil del profesional
interface ProfessionalProfile {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  email: string;
}

const USER_PROFILE_KEY = 'userProfile';

@Component({
  selector: 'app-profesional-tab',
  templateUrl: './profesional-tab.page.html',
  styleUrls: ['./profesional-tab.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
  ]
})
export class ProfesionalTabPage implements OnInit {
  public professionalProfile: ProfessionalProfile | null = null;

  constructor() { }

  ngOnInit() {
    this.loadProfessionalProfile();
  }

  async loadProfessionalProfile() {
    const { value } = await Preferences.get({ key: USER_PROFILE_KEY });
    if (value) {
      this.professionalProfile = JSON.parse(value);
    } else {
      console.warn('No se encontró el perfil del profesional (usuario de la app).');
    }
  }
}
