import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NavController, Platform } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack, arrowBackCircleOutline } from 'ionicons/icons';
import {
  IonIcon,
  IonHeader,
  IonToolbar,
  IonButtons,
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
import { Keyboard } from '@capacitor/keyboard';
import { CommonModule } from '@angular/common';

const USER_PROFILE_KEY = 'userProfile';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonButtons,
    IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonList, IonItem, IonInput, IonButton, IonIcon,
  ],
})
export class RegisterPage implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  isProfileRegistered = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private navCtrl: NavController,
    private platform: Platform,

  ) {
    addIcons({arrowBackCircleOutline,arrowBack});
  }

  goBack() {
    this.navCtrl.back();
  }

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
    this.initializeKeyboardListeners();
  }

  ngOnDestroy() {
    // Es una buena práctica remover los listeners cuando el componente se destruye
    // para evitar fugas de memoria.
    if (this.platform.is('capacitor')) {
      Keyboard.removeAllListeners();
    }
  }

  /**
   * Inicializa los listeners para reaccionar a los eventos del teclado y
   * ajustar la vista para que no cubra los inputs.
   */
 initializeKeyboardListeners() {
  if (this.platform.is('capacitor')) {
    Keyboard.addListener('keyboardWillShow', async (info) => {
      const content = document.querySelector('ion-content');
      if (content) {
        // 1. Añadimos el espacio abajo para que haya lugar donde scrollear
        content.style.setProperty('--padding-bottom', `${info.keyboardHeight}px`);

        // 2. Esperamos un poco a que el teclado termine de subir y hacemos scroll al input activo
        setTimeout(async () => {
          const activeElement = document.activeElement;
          if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    });

    Keyboard.addListener('keyboardWillHide', () => {
      const content = document.querySelector('ion-content');
      if (content) {
        content.style.removeProperty('--padding-bottom');
      }
    });
  }
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
      this.router.navigateByUrl('/login', { replaceUrl: true }); // Redirige al login y previene volver atrás

    } catch (error: any) {
      this.showToast('Ocurrió un error al guardar tu perfil.');
    } finally {
      loading.dismiss();
    }
  }

  goToLogin() {
    this.router.navigateByUrl('/login');
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
