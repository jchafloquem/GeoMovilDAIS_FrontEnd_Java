import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GpsData {
  lat: number | null;
  lng: number | null;
  alt: number | null;
  vel: number | null;
  accH: number | null;
  accV: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class GpsDataService {
  private readonly initialGpsData: GpsData = {
    lat: null, lng: null, alt: null, vel: null, accH: null, accV: null,
  };

  private gpsDataSource = new BehaviorSubject<GpsData>(this.initialGpsData);
  public currentGpsData = this.gpsDataSource.asObservable();

  updateGpsData(data: GpsData) {
    this.gpsDataSource.next(data);
  }
}

