import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonList,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonButtons,
  IonCardSubtitle,
  IonCardTitle,
  AlertController,
  LoadingController,
  ToastController,
  IonIcon,
} from '@ionic/angular/standalone';
import { Router} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { App } from '@capacitor/app';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonButtons,
    CommonModule,
    FormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonInput,
    IonItem,
    IonIcon,
    IonList,
    ReactiveFormsModule,
  ],
})
export class LoginPage implements OnInit {
  private formBuilder: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private loadingController: LoadingController = inject(LoadingController);
  private toastController: ToastController = inject(ToastController);
  private alertController: AlertController = inject(AlertController);

  public formLogin: FormGroup = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  passwordType: string = 'password';
  passwordIcon: string = 'eye-off';

  constructor() {
    addIcons({ eye, eyeOff });
  }

  ngOnInit() {
    this.checkAppExpiration();
  }

  /**
   * Verifica si la fecha actual ha superado la fecha de caducidad de la aplicación.
   * Si ha expirado, muestra una alerta y cierra la aplicación.
   */
  private async checkAppExpiration() {
    // La aplicación funcionará hasta el 30 de junio de 2026, inclusive.
    // Expirará a las 00:00 del 01 de julio de 2026.
    const expirationDate = new Date('2026-04-30T00:00:00');
    const currentDate = new Date();

    if (currentDate >= expirationDate) {
      const alert = await this.alertController.create({
        header: 'Aplicación Expirada',
        message: 'Esta versión de la aplicación ha caducado. Por favor, contacte al administrador para obtener una versión actualizada.',
        backdropDismiss: false, // Impide que el usuario cierre la alerta haciendo clic fuera.
        buttons: [{
          text: 'Cerrar Aplicación',
          handler: () => App.exitApp()
        }]
      });
      await alert.present();
    }
  }

  /**
   * Este método del ciclo de vida de Ionic se ejecuta cada vez que la página está a punto de entrar en la vista.
   * Es un lugar más adecuado que ngOnInit para operaciones que deben ocurrir cada vez que se muestra la página.
   */
  async ionViewWillEnter() {
    const lastEmail = await this.authService.getLastEmail();
    if (lastEmail) {
      this.formLogin.patchValue({ email: lastEmail });
    }
  }

  async login() {
    if (this.formLogin.invalid) {
      this.showToast('Por favor, ingrese un correo y contraseña válidos.');
      return;
    }
    const loading = await this.loadingController.create({ message: 'Ingresando...' });
    await loading.present();

    try {
      const { email, password } = this.formLogin.value;
      const result = await this.authService.login(email, password);
      // Comprobamos si el resultado tiene la propiedad 'offlineSuccess'
      if (result && 'offlineSuccess' in result) {
        this.router.navigateByUrl('/mapa', { replaceUrl: true });
      } else {
        this.router.navigateByUrl('/mapa', { replaceUrl: true });
      }
    } catch (error: any) {
      this.showToast(error.message);
    } finally {
      loading.dismiss();
    }
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message, duration: 3000, color: 'danger', position: 'middle'
    });
    toast.present();
  }

  togglePassword(): void {
    this.passwordType = this.passwordType === 'text' ? 'password' : 'text';
    this.passwordIcon = this.passwordIcon === 'eye-off' ? 'eye' : 'eye-off';
  }
}
