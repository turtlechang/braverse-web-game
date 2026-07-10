import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { GameErrorBoundary } from './components/errors/GameErrorBoundary'

// ?mockup=<id> 時才動態載入 UI reference mockup，正式遊戲路徑不包含 mockup 代碼
const mockupId = new URLSearchParams(window.location.search).get('mockup')
const MockupGallery = mockupId
  ? lazy(() => import('./ui-reference/MockupGallery'))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mockupId && MockupGallery ? (
      <GameErrorBoundary>
        <Suspense
          fallback={
            <div
              style={{
                position: 'fixed',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: '#07162f',
                color: '#eef9ff',
                fontFamily: "system-ui, 'Noto Sans TC', sans-serif",
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    margin: '0 auto 12px',
                    borderRadius: '50%',
                    border: '3px solid rgba(126,231,240,.25)',
                    borderTopColor: '#7ee7f0',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: '.9rem', opacity: .7 }}>載入中…</span>
              </div>
            </div>
          }
        >
          <MockupGallery mockupId={mockupId} />
        </Suspense>
      </GameErrorBoundary>
    ) : (
      <GameErrorBoundary>
        <App />
      </GameErrorBoundary>
    )}
  </StrictMode>,
)
