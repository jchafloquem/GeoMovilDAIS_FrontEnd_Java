import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonImg,
  IonContent,
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [
    IonImg,
    IonContent,
    CommonModule,
    FormsModule,
    RouterModule
  ]
})
export class WelcomePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
