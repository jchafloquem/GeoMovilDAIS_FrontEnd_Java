export const environment = {
  production: true,
  // CORRECCIÓN CRÍTICA:
  // 1. Se elimina el segmento '/v1' que es incorrecto.
  // 2. La URL de producción NUNCA debe ser una IP local. Debe ser el dominio público
  //    y seguro (HTTPS) donde se desplegará tu backend.
  apiUrl: 'https://api.geodais.devida.gob.pe/api', // <-- ¡REEMPLAZAR CON LA URL DE PRODUCCIÓN REAL!
  firebase: {
    apiKey: "AIzaSyBxuC9v9dbaQyR2jS9NkBeKeOo86EsGhvY",
    authDomain: "geomovildais.firebaseapp.com",
    projectId: "geomovildais",
    storageBucket: "geomovildais.firebasestorage.app",
    messagingSenderId: "553060227607",
    appId: "1:553060227607:web:1105c2b7f35c1bc00cda52"
  }
};
