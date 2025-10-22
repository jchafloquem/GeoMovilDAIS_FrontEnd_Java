import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'GeoMovilDAIS',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // --- AÑADE ESTA SECCIÓN ---
    allowNavigation: [
      "api.decolecta.com"
    ]
    // -------------------------
  }
};

export default config;
