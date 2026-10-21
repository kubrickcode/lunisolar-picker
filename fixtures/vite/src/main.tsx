import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BirthDateForm } from './BirthDateForm';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html is missing #root');

createRoot(rootElement).render(
  <StrictMode>
    <BirthDateForm onSubmitValues={(values) => console.info(values)} />
  </StrictMode>,
);
