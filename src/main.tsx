import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { GameErrorBoundary } from './components/errors/GameErrorBoundary'
import { MockupGallery } from './ui-reference/MockupGallery'

// ?mockup=<id> 檢視 UI reference mockup（docs/ui-reference/），供設計審查；無參數時照常進入遊戲
const mockupId = new URLSearchParams(window.location.search).get('mockup')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mockupId ? (
      <MockupGallery mockupId={mockupId} />
    ) : (
      <GameErrorBoundary>
        <App />
      </GameErrorBoundary>
    )}
  </StrictMode>,
)
