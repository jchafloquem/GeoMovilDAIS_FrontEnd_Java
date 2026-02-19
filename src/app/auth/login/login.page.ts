import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';
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
  IonIcon,
  IonCardTitle,
  LoadingController,
  ToastController,

} from '@ionic/angular/standalone';
import { Router} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';


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
  passwordType: string = 'password';
  passwordIcon: string = 'eye-off';


  private formBuilder: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private loadingController: LoadingController = inject(LoadingController);
  private toastController: ToastController = inject(ToastController);

  public formLogin: FormGroup = this.formBuilder.group({

    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });


  togglePassword():void {
    this.passwordType = this.passwordType === 'text' ? 'password' : 'text';
    this.passwordIcon = this.passwordIcon === 'eye-off' ? 'eye' : 'eye-off';
  }

  constructor() {
    addIcons({ eye, eyeOff })

   }

  async ngOnInit() {
    const email = await this.authService.getLastEmail();
    if (email) {
      this.formLogin.patchValue({ email });
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
}
