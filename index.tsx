import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

const loadingElement = document.getElementById('app-loading');
if (loadingElement) {
  loadingElement.style.display = 'none';
}
