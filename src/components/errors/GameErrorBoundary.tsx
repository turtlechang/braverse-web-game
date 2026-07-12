import { Component, type ErrorInfo, type ReactNode } from 'react'
import { serializeReplayIssueBundle } from '../../game/replay-issue-bundle'
import { buildIssueBundleFromProvider } from '../../hooks/issueBundleSource'
import { copyTextToClipboard } from '../copyTextToClipboard'

interface GameErrorBoundaryProps {
  children: ReactNode
}

interface GameErrorBoundaryState {
  hasError: boolean
  /** 崩潰當下立即序列化的問題包；provider 未註冊（如主選單崩潰）時為 null。 */
  issueBundleJson: string | null
  copyResult: 'idle' | 'copied' | 'failed'
}

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = {
    hasError: false,
    issueBundleJson: null,
    copyResult: 'idle',
  }

  static getDerivedStateFromError(): Partial<GameErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Braverse render failed.', error, info)
    // 立即建包：子樹此時已卸載，靠 provider 閉包保留的最後對局狀態建構。
    try {
      const bundle = buildIssueBundleFromProvider(error.message)
      if (bundle) {
        this.setState({ issueBundleJson: serializeReplayIssueBundle(bundle) })
      }
    } catch (bundleError) {
      console.error('無法建立問題包。', bundleError)
    }
  }

  handleCopyIssueBundle = () => {
    const { issueBundleJson } = this.state
    if (!issueBundleJson) return
    void copyTextToClipboard(issueBundleJson).then((ok) => {
      this.setState({ copyResult: ok ? 'copied' : 'failed' })
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { issueBundleJson, copyResult } = this.state

    return (
      <main className="game-error-boundary" role="alert">
        <section className="game-error-card">
          <p className="game-error-eyebrow">BRAVERSE</p>
          <h1>遊戲畫面發生錯誤</h1>
          <p>目前對局無法繼續顯示。重新載入後會建立新的本機對局。</p>
          {issueBundleJson && (
            <>
              <button type="button" onClick={this.handleCopyIssueBundle}>
                {copyResult === 'copied'
                  ? '已複製問題包'
                  : copyResult === 'failed'
                    ? '複製失敗，請再試一次'
                    : '複製問題包'}
              </button>
              <p className="game-error-hint">
                問題包含對局狀態與指令紀錄，貼給開發者即可重現此問題。
              </p>
            </>
          )}
          <button type="button" onClick={() => window.location.reload()}>
            重新載入遊戲
          </button>
        </section>
      </main>
    )
  }
}
