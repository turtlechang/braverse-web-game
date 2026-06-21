import { Component, type ErrorInfo, type ReactNode } from 'react'

interface GameErrorBoundaryProps {
  children: ReactNode
}

interface GameErrorBoundaryState {
  hasError: boolean
}

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Braverse render failed.', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="game-error-boundary" role="alert">
        <section className="game-error-card">
          <p className="game-error-eyebrow">BRAVERSE</p>
          <h1>遊戲畫面發生錯誤</h1>
          <p>目前對局無法繼續顯示。重新載入後會建立新的本機對局。</p>
          <button type="button" onClick={() => window.location.reload()}>
            重新載入遊戲
          </button>
        </section>
      </main>
    )
  }
}
