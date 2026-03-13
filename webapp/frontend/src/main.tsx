import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BackgroundProvider } from './contexts/BackgroundContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackgroundProvider>
      <App />
    </BackgroundProvider>
  </StrictMode>,
)
