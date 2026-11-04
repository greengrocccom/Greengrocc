import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/admin.css';
import './styles/workspace.css';
import App from './App.jsx';
import { initializeAdminTheme } from './utils/adminTheme';

initializeAdminTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
