import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PauseModal } from '../modals/GameModals'
import { MatchToolbar } from './MatchToolbar'
import { PhaseRail } from './PhaseRail'

describe('desktop battle HUD', () => {
  it('keeps the phase rail focused on turn navigation', () => {
    const markup = renderToStaticMarkup(
      <PhaseRail
        phase="main"
        turnNumber={3}
        activePlayerName="玩家"
        isPlayerTurn
        disabled={false}
        onAdvance={() => undefined}
      />,
    )

    expect(markup).toContain('phase-rail')
    expect(markup).toContain('主要階段')
    expect(markup).toContain('結束主要階段')
    expect(markup).not.toContain('rail-ai-status')
    expect(markup).not.toContain('執行 20 場 AI 驗證')
  })

  it('renders the match toolbar as compact icon controls only', () => {
    const markup = renderToStaticMarkup(
      <MatchToolbar
        onReset={() => undefined}
        onViewDeck={() => undefined}
        onPause={() => undefined}
      />,
    )

    expect(markup).toContain('match-toolbar')
    expect(markup).toContain('重新開始')
    expect(markup).toContain('查看官方範例牌組')
    expect(markup).toContain('暫停資訊')
    expect(markup).not.toContain('match-status')
    expect(markup).not.toContain('deck-matchup')
  })

  it('moves AI diagnostics and the matchup into the pause modal', () => {
    const markup = renderToStaticMarkup(
      <PauseModal
        turnNumber={3}
        phaseLabel="主要階段"
        deckConfig={{ player: 'red', ai: 'green' }}
        aiActionCount={12}
        onRunSimulation={() => undefined}
        onResume={() => undefined}
      />,
    )

    expect(markup).toContain('玩家 紅色')
    expect(markup).toContain('AI 綠色')
    expect(markup).toContain('AI 已執行 12 個動作')
    expect(markup).toContain('執行 20 場 AI 驗證')
  })
})
