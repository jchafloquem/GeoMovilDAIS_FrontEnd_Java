import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.devida.geomovildais',
  appName: 'GeoMovilDAIS',
  webDir: 'www',
  plugins:{
    CapacitorHttp:{
      enabled:true
    }
  },
  server: {
    androidScheme: 'https',
    allowNavigation: [
      "api.decolecta.com",
      "gateway.midagri.gob.pe"
    ]
    // -------------------------
  }
};

export default config;
