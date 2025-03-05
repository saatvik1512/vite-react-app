import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './output.css'
import App2 from './App2.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App2 />
  </StrictMode>,
)
