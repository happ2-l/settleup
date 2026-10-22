import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/ui/App';
import './app/ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
