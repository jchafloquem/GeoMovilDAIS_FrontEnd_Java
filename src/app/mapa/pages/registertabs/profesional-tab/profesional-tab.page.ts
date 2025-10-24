import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-profesional-tab',
  templateUrl: './profesional-tab.page.html',
  styleUrls: ['./profesional-tab.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ProfesionalTabPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
