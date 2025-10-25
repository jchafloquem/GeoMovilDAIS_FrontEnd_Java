// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: '/v1', // Usar el proxy en desarrollo
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
