import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonList, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { GpsData, GpsDataService } from 'src/app/services/gps-data.service';

@Component({
  selector: 'app-skyplot',
  templateUrl: './skyplot.page.html',
  styleUrls: ['./skyplot.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonList, IonItem, IonLabel, IonNote]
})
export class SkyplotPage implements OnInit, OnDestroy {
  public gpsData: GpsData = {
    lat: null, lng: null, alt: null, vel: null, accH: null, accV: null,
  };
  private gpsSubscription: Subscription | undefined;

  constructor(private gpsDataService: GpsDataService) { }

  ngOnInit() {
    this.gpsSubscription = this.gpsDataService.currentGpsData.subscribe(data => {
      this.gpsData = data;
    });
  }

  ngOnDestroy() {
    if (this.gpsSubscription) {
      this.gpsSubscription.unsubscribe();
    }
  }
}

