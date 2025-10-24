import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, leafOutline, shapesOutline, cameraOutline, saveOutline, createOutline, pencilOutline, idCardOutline } from 'ionicons/icons';
import { RegisterDataService } from 'src/app/services/register-data.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-registertabs',
  templateUrl: './registertabs.page.html',
  styleUrls: ['./registertabs.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonButton]
})
export class RegistertabsPage implements OnInit {

  public pageTitle$: Observable<string>;

  constructor(
    private route: ActivatedRoute,
    public registerDataService: RegisterDataService // Hacemos público para usarlo en el template
  ) {
    addIcons({saveOutline,personOutline,leafOutline,shapesOutline,cameraOutline,idCardOutline,createOutline,pencilOutline});

    this.pageTitle$ = this.registerDataService.editKey$.pipe(
      map(key => key ? 'Editar Información' : 'Registrar Datos')
    );
  }

  ngOnInit() {
    // La inicialización se hace en ionViewWillEnter para que se ejecute cada vez que entramos a la página
  }

  ionViewWillEnter() {
    const keyFromUrl = this.route.snapshot.paramMap.get('key');
    // Pasamos la clave y el estado de navegación al servicio para que cargue los datos
    this.registerDataService.loadInitialData(keyFromUrl, history.state);
  }

  save() {
    this.registerDataService.saveData();
  }
}
