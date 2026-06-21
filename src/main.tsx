import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { GameErrorBoundary } from './components/errors/GameErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  </StrictMode>,
)
