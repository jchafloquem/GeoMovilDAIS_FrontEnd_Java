import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'mapa',
    loadComponent: () => import('./mapa/mapa.page').then( m => m.MapaPage)
  },
  {
    // Ruta padre para las pestañas de registro
    path: 'mapa/registerdata',
    loadComponent: () => import('./mapa/pages/registertabs/registertabs/registertabs.page').then(m => m.RegistertabsPage),
    children: [
      {
        path: 'productor',
        loadComponent: () => import('./mapa/pages/registertabs/productor-tab/productor-tab.page').then(m => m.ProductorTabPage)
      },
      {
        path: 'agrarios',
        loadComponent: () => import('./mapa/pages/registertabs/agrarios-tab/agrarios-tab.page').then(m => m.AgrariosTabPage)
      },
      {
        path: 'geometricos',
        loadComponent: () => import('./mapa/pages/registertabs/geometricos-tab/geometricos-tab.page').then(m => m.GeometricosTabPage)
      },
      {
        path: 'fotos',
        loadComponent: () => import('./mapa/pages/registertabs/fotos-tab/fotos-tab.page').then(m => m.FotosTabPage)
      },
      {
        path: '',
        redirectTo: 'productor',
        pathMatch: 'full'
      }
    ]
  },
  {
    // Ruta para el modo edición, también apunta al componente padre de las pestañas
    path: 'mapa/registerdata/:key',
    loadComponent: () => import('./mapa/pages/registertabs/registertabs/registertabs.page').then(m => m.RegistertabsPage),
    // Los children se heredan, pero es buena práctica definirlos para claridad
    children: [
      { path: 'productor', loadComponent: () => import('./mapa/pages/registertabs/productor-tab/productor-tab.page').then(m => m.ProductorTabPage) },
      { path: 'agrarios', loadComponent: () => import('./mapa/pages/registertabs/agrarios-tab/agrarios-tab.page').then(m => m.AgrariosTabPage) },
      { path: 'geometricos', loadComponent: () => import('./mapa/pages/registertabs/geometricos-tab/geometricos-tab.page').then(m => m.GeometricosTabPage) },
      { path: 'fotos', loadComponent: () => import('./mapa/pages/registertabs/fotos-tab/fotos-tab.page').then(m => m.FotosTabPage) },
      { path: 'profesional-tab', loadComponent: () => import('./mapa/pages/registertabs/profesional-tab/profesional-tab.page').then( m => m.ProfesionalTabPage)},
      { path: '', redirectTo: 'productor', pathMatch: 'full' }
    ]
  },
  {
    path: 'mapa/list',
    loadComponent: () => import('./mapa/pages/list/list.page').then( m => m.ListPage)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
