import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { I18nProvider } from './lib/i18n.tsx';
import { SessionGate } from './components/SessionGate.tsx';
import './styles/tokens.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta el nodo #root en index.html');

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <SessionGate>
        <App />
      </SessionGate>
    </I18nProvider>
  </StrictMode>,
);
