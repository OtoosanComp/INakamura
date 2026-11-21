import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.otoosan.otooqrpos',
  appName: 'Otoo QR POS',
  webDir: 'dist',
  android: {
    // Los enlaces externos (ticket público, WhatsApp, redes) se abren en el navegador/app correspondiente
    allowMixedContent: false
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover'
    }
  }
};

export default config;
