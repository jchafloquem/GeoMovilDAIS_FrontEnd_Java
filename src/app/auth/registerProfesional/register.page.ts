import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { CommonModule } from '@angular/common';

const USER_PROFILE_KEY = 'userProfile';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonButtons,
    IonBackButton, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonList, IonItem, IonInput, IonButton
  ],
})
export class RegisterPage implements OnInit {
  profileForm!: FormGroup;
  isProfileRegistered = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.profileForm = this.formBuilder.group({
      dni: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]], // DNI de 8 dígitos
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidoPaterno: ['', [Validators.required, Validators.minLength(2)]],
      apellidoMaterno: ['', [Validators.required, Validators.minLength(2)]],
      celular: ['', [Validators.required, Validators.pattern('^[0-9]{9,15}$')]], // Pattern para 9 a 15 dígitos
      email: ['', [Validators.required, Validators.email]],
    });

    this.loadProfile();
  }

  /**
   * Verifica si el perfil del usuario ya existe en el dispositivo.
   * Si es así, carga los datos y pone el formulario en modo de solo lectura.
   */
  async loadProfile() {
    const { value } = await Preferences.get({ key: USER_PROFILE_KEY });
    if (value) {
      this.isProfileRegistered = true;
      const profileData = JSON.parse(value);
      this.profileForm.patchValue(profileData);
      this.profileForm.disable(); // Deshabilita el formulario para que sea de solo lectura
    }
  }

  async saveProfile() {
    if (this.profileForm.invalid) {
      this.showToast('Por favor, complete todos los campos correctamente.');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Guardando perfil...',
    });
    await loading.present();

    try {
      const profileData = this.profileForm.value;

      // Convertir los campos de texto a mayúsculas antes de guardar
      profileData.dni = profileData.dni?.toUpperCase();
      profileData.nombres = profileData.nombres?.toUpperCase();
      profileData.apellidoPaterno = profileData.apellidoPaterno?.toUpperCase();
      profileData.apellidoMaterno = profileData.apellidoMaterno?.toUpperCase();
      // El email se mantiene en minúsculas por convención

      // Guardar los datos en el dispositivo de forma oculta
      await Preferences.set({
        key: USER_PROFILE_KEY,
        value: JSON.stringify(profileData)
      });

      this.showToast('Perfil guardado exitosamente en el dispositivo.', 'success');
      this.router.navigateByUrl('/mapa', { replaceUrl: true }); // Redirige al mapa y previene volver atrás

    } catch (error: any) {
      console.error('Error al guardar el perfil:', error);
      this.showToast('Ocurrió un error al guardar tu perfil.');
    } finally {
      loading.dismiss();
    }
  }

  goToMap() {
    this.router.navigateByUrl('/mapa');
  }

  async showToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'middle',
    });
    toast.present();
  }
}
