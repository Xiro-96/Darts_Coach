import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-Fähigkeit: Service Worker registrieren (aktualisiert sich automatisch)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({ immediate: true });
}
