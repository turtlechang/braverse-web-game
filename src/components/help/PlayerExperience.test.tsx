/// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlayerGuideButton } from './PlayerGuide'
import { PhaseRail } from '../layout/PhaseRail'
import { MatchSoundControl } from '../battle/MatchSoundControl'
import { ResultModal } from '../modals/GameModals'
import { MainMenuMasterDuel } from '../MainMenuMasterDuel'
import { DeckEditorPage } from '../DeckEditorPage'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

let cleanup = async () => {}
async function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(() => root.render(node))
  cleanup = async () => { await act(() => root.unmount()); container.remove() }
  return container
}
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text)!
afterEach(async () => { await cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('player experience', () => {
  it('opens every lesson, closes on Escape and restores focus without advancing the game', async () => {
    await render(<PlayerGuideButton phase="support" />)
    const trigger = button('操作教學')
    trigger.focus()
    await act(() => trigger.click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('支援階段')
    for (let index = 0; index < 4; index++) await act(() => button('下一個說明').click())
    expect(document.querySelector('article')?.textContent).toContain('傷害與 FLIP')
    expect(document.querySelector('article')?.textContent).toContain('不是每次受傷都有 FLIP')
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    await act(() => trigger.click())
    expect(document.querySelector('article')?.textContent).toContain('說明 1 / 5')
  })

  it('lets a player skip a lesson without changing the turn', async () => {
    const advance = vi.fn()
    await render(<PhaseRail phase="main" turnNumber={3} isPlayerTurn disabled={false} onAdvance={advance} />)
    await act(() => button('操作教學').click())
    await act(() => button('略過／收起教學').click())
    expect(advance).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('你的回合')
  })

  it('shows opponent ownership and cannot advance a locked opponent turn', async () => {
    const advance = vi.fn()
    const container = await render(<PhaseRail phase="main" turnNumber={4} isPlayerTurn={false} disabled onAdvance={advance} />)
    expect(container.textContent).toContain('對手回合')
    const next = container.querySelector<HTMLButtonElement>('.next-phase-button')!
    expect(next.textContent).toContain('等待對手行動')
    await act(() => next.click())
    expect(advance).not.toHaveBeenCalled()
  })

  it('labels online exit honestly and keeps the log action available', async () => {
    const leave = vi.fn(), review = vi.fn()
    await render(<ResultModal winnerName="玩家" loserId="player-two" viewerPlayerId="player-one" reason="break-level-limit" turnNumber={9} deckSummary="紅色 Starter" restartLabel="返回大廳" onRestart={leave} onReviewLog={review} />)
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('第 9 回合')
    expect(document.body.textContent).toContain('紅色 Starter')
    await act(() => button('返回大廳').click())
    expect(leave).toHaveBeenCalledTimes(1)
    await act(() => button('查看對戰紀錄').click())
    expect(review).toHaveBeenCalledWith('對方休息區的等級達到 10。')
  })

  it('offers starter practice even when no custom deck exists', async () => {
    const practice = vi.fn()
    await render(<MainMenuMasterDuel decks={[]} selectedDeckId={null} selectedValidation={null} battleError={null} aiDeckChoice="random" aiLevel={1}
      onSelectAiDeck={vi.fn()} onSelectAiLevel={vi.fn()} onSelectDeck={vi.fn()} onStartBattle={vi.fn()} onOpenOnlineMatch={vi.fn()} onOpenTestScenario={vi.fn()} onOpenMyDecks={vi.fn()} onEditDeck={vi.fn()} onDuplicateDeck={vi.fn()} onDeleteDeck={vi.fn()} onRefreshDecks={vi.fn()} onStartPractice={practice} />)
    expect(document.querySelector<HTMLButtonElement>('[data-testid="start-ai-battle"]')?.disabled).toBe(true)
    await act(() => button('紅色起始牌組練習').click())
    expect(practice).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('Lv.1 熟悉操作')
  })

  it('clears combined search and filters while retaining the editable deck', async () => {
    const container = await render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />)
    const search = container.querySelector<HTMLInputElement>('[aria-label="搜尋卡名或卡號"]')!
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'no-such-card-000')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('沒有符合條件的卡牌')
    await act(() => button('清除搜尋與篩選').click())
    expect(search.value).toBe('')
    expect(container.textContent).not.toContain('沒有符合條件的卡牌')
    expect(container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-page-save"]')?.disabled).toBe(true)
  })

  it('keeps audio off and does not construct AudioContext without opt-in', async () => {
    const audio = vi.fn()
    vi.stubGlobal('AudioContext', audio)
    await render(<MatchSoundControl events={[{ id: '1', kind: 'impact', label: '傷害', duration: 100 }]} />)
    expect(button('音效：關').getAttribute('aria-pressed')).toBe('false')
    expect(audio).not.toHaveBeenCalled()
  })

  it('reports unsupported audio without preventing gameplay', async () => {
    vi.stubGlobal('AudioContext', undefined)
    await render(<MatchSoundControl events={[]} />)
    await act(() => button('音效：關').click())
    expect(document.body.textContent).toContain('目前無法播放音效')
    expect(button('音效：關').disabled).toBe(false)
  })

  it('requires a user gesture again for a saved audio preference', async () => {
    localStorage.setItem('braverse.sound-enabled', 'true')
    const audio = vi.fn()
    vi.stubGlobal('AudioContext', audio)
    await render(<MatchSoundControl events={[]} />)
    expect(button('音效：點此啟用').getAttribute('aria-pressed')).toBe('false')
    expect(audio).not.toHaveBeenCalled()
  })
})
