import React from 'react';
import { createRoot } from 'react-dom/client';
import Layout from './components/Layout';
import './styles.css';

const root = document.getElementById('root');
if (root) {
        createRoot(root).render(<Layout />);
}

