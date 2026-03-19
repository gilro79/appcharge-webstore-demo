import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ActivePlayerProvider } from './context/ActivePlayerContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActivePlayerProvider>
        <App />
      </ActivePlayerProvider>
    </BrowserRouter>
  </React.StrictMode>
);
