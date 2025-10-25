import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';


import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

/* Librerías de Leaflet */
import 'leaflet'; // Importa Leaflet primero
import 'leaflet-draw'; // Luego Leaflet Draw
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from './environments/environment';


bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideFirebaseApp( () => initializeApp(environment.firebase)),
    provideAuth(() => getAuth())


  ],
});



