import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
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
      "api.decolecta.com"
    ]
    // -------------------------
  }
};

export default config;
