import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadMuseum } from './museums';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Resolve the museum profile (MUSEUM_ID / ?museum=) before the first render so
// prompts and branding are consistent. loadMuseum() never rejects.
loadMuseum().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});