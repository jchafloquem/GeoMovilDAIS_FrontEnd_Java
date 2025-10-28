import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mapOutline,
  personAddOutline,
  cameraOutline,
  cloudOfflineOutline,
  documentTextOutline,
  gitBranchOutline,
  codeSlashOutline,
  mailOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonButtons, IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonIcon, IonLabel, IonNote]
})
export class AboutPage implements OnInit {

  public version = '1.0.0';

  constructor() {
    addIcons({
      mapOutline,
      personAddOutline,
      cameraOutline,
      cloudOfflineOutline,
      documentTextOutline,
      gitBranchOutline,
      codeSlashOutline,
      mailOutline
    });
  }

  ngOnInit() {
  }

}
