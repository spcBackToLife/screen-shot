import React from 'react';
import ReactDOM from 'react-dom/client'; // Using React 18 createRoot
import App from './src/App'; // Adjust path if App.tsx is elsewhere

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount React app");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log to confirm renderer is loaded
console.log('renderer.tsx loaded and React app initiated.');
