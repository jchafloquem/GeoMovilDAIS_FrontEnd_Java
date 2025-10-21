import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'mapa',
    loadComponent: () => import('./mapa/mapa.page').then( m => m.MapaPage)
  },
  {
    path: 'mapa/registerdata/:key',
    loadComponent: () => import('./mapa/pages/registerdata/registerdata.page').then( m => m.RegisterdataPage)
  },
  {
    path: 'mapa/registerdata',
    loadComponent: () => import('./mapa/pages/registerdata/registerdata.page').then( m => m.RegisterdataPage)
  },
  {
    path: '',
    redirectTo: 'mapa',
    pathMatch: 'full',
  },


];
