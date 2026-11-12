import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/popup/App';
import '@/popup/popup.css';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
