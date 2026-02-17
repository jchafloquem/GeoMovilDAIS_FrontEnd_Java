// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // CORRECCIÓN: Se elimina el segmento '/v1' que no corresponde con la configuración del backend.
  // La URL base debe terminar en '/api' para que coincida con el @RequestMapping del controlador.
  // Asegúrate de que la IP '192.168.26.12' sea la de tu máquina donde corre el backend.
  apiUrl: 'http://192.168.26.12:8080/geodaismovil/api',
  firebase: {
      apiKey: "AIzaSyBxuC9v9dbaQyR2jS9NkBeKeOo86EsGhvY",
      authDomain: "geomovildais.firebaseapp.com",
      projectId: "geomovildais",
      storageBucket: "geomovildais.firebasestorage.app",
      messagingSenderId: "553060227607",
      appId: "1:553060227607:web:1105c2b7f35c1bc00cda52"
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
