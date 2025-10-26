import { Component, inject } from '@angular/core';
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
  IonCardSubtitle,
  IonCardTitle,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { Router} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
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
    IonList,
    ReactiveFormsModule,
  ],
})
export class LoginPage {

  private formBuilder: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private loadingController: LoadingController = inject(LoadingController);
  private toastController: ToastController = inject(ToastController);

  public formLogin: FormGroup = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  constructor() { }

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
        console.log('Login offline exitoso');
        this.router.navigateByUrl('/mapa', { replaceUrl: true });
      } else {
        console.log('Login online exitoso:', result);
        this.router.navigateByUrl('/mapa', { replaceUrl: true });
      }
    } catch (error: any) {
      console.error('Error en el login:', error);
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
}
