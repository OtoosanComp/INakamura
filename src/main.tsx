import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { requestPersistence } from './lib/db';
import { isNative } from './lib/platform';
import './styles.css';

// Nunca recargar sola (podría borrar una venta a medias): avisamos y la vendedora decide cuándo.
// En el APK los archivos vienen dentro de la app: no hace falta service worker.
const updateSW = isNative()
  ? async () => {}
  : registerSW({
      immediate: true,
      onNeedReload() {
        window.dispatchEvent(new Event('otoo-update'));
      }
    });
(window as unknown as { otooUpdate: () => void }).otooUpdate = () => {
  updateSW(true);
  window.location.reload();
};
requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
