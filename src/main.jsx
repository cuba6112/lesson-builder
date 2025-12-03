// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode removed to prevent double-invocation of effects in dev mode.
// Double-invocations cause duplicate connection checks and can double-create
// controllers/streams, significantly impacting performance.
createRoot(document.getElementById('root')).render(
  <App />
)
