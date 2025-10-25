import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonList, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/angular/standalone';
import { Router} from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { IUser } from '../models/user.model';


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
  ]
})
export class LoginPage {

  private formBuilder: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);



  public formLogin: FormGroup = this.formBuilder.group({
    email: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor() { }

  login(){
    const user: IUser = this.formLogin.value;
    this.authService.login(user.email, user.password).then(
      () => {
        this.router.navigateByUrl('/mapa');

      }
    ).catch(() => {

    })
  }

}
