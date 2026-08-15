import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tablet-layout.css'
import { GameErrorBoundary } from './components/errors/GameErrorBoundary'
import { getStoredTheme } from './styles/themeStorage'

const searchParams = new URLSearchParams(window.location.search)
const mockupId = searchParams.get('mockup')
const browserSwiss = searchParams.get('browser-swiss') === '1'
const queryTheme = searchParams.get('theme')
const initialTheme =
  queryTheme === 'tactical' ||
  queryTheme === 'tactical-clean' ||
  queryTheme === 'tactical-mono' ||
  queryTheme === 'low-glare' ||
  queryTheme === 'broadcast'
    ? queryTheme
    : getStoredTheme()
document.documentElement.dataset.theme = initialTheme

// ?mockup=<id> 時才動態載入 UI reference mockup，正式遊戲路徑不包含 mockup 代碼
const MockupGallery = mockupId
  ? lazy(() => import('./ui-reference/MockupGallery'))
  : null
const BrowserSwissTournament = browserSwiss
  ? lazy(() => import('./components/BrowserSwissTournament').then((module) => ({ default: module.BrowserSwissTournament })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mockupId && MockupGallery ? (
      <GameErrorBoundary>
        <Suspense
          fallback={
            <div className="tactical-surface" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
                <span style={{ fontSize: '.9rem', opacity: .7 }}>載入中…</span>
              </div>
            </div>
          }
        >
          <MockupGallery mockupId={mockupId} />
        </Suspense>
      </GameErrorBoundary>
    ) : browserSwiss && BrowserSwissTournament ? (
      <GameErrorBoundary>
        <Suspense
          fallback={
            <div className="tactical-surface" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
              載入 Browser Swiss harness…
            </div>
          }
        >
          <BrowserSwissTournament />
        </Suspense>
      </GameErrorBoundary>
    ) : (
      <GameErrorBoundary>
        <App />
      </GameErrorBoundary>
    )}
  </StrictMode>,
)
