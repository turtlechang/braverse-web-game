import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FlaskConical,
  Pencil,
  RefreshCw,
  Trash2,
  Swords,
  Users,
  Layers,
} from 'lucide-react'
import { isBs8CandidateStagingDeck } from '../game'
import { getDeckFormatLabel } from '../game/deck-rules'
import { getCardPoolEntry } from '../game/card-pool'
import type { AiLevel } from '../game'
import type { DeckValidationResult } from '../game/custom-deck'
import type { CustomDeck } from '../game/custom-deck'
import type { AiDeckChoice } from './MainMenu'

interface MainMenuMasterDuelProps {
  decks: CustomDeck[]
  selectedDeckId: string | null
  selectedValidation: DeckValidationResult | null
  battleError: string | null
  aiDeckChoice: AiDeckChoice
  aiLevel: AiLevel
  onSelectAiDeck: (choice: AiDeckChoice) => void
  onSelectAiLevel: (level: AiLevel) => void
  onSelectDeck: (deckId: string) => void
  onStartBattle: () => void
  onOpenOnlineMatch: () => void
  onOpenTestScenario: () => void
  onOpenMyDecks: () => void
  onEditDeck: (deck: CustomDeck) => void
  onDuplicateDeck: (deck: CustomDeck) => void
  onDeleteDeck: (deck: CustomDeck) => void
  onRefreshDecks: () => void
}

const fallbackHero = 'https://cookierunbraverse.com/data/en_storage/2HgB5QrG10BzWXr00hCI0w.webp'

export function MainMenuMasterDuel({
  decks,
  selectedDeckId,
  selectedValidation,
  battleError,
  aiDeckChoice,
  aiLevel,
  onSelectAiDeck,
  onSelectAiLevel,
  onSelectDeck,
  onStartBattle,
  onOpenOnlineMatch,
  onOpenTestScenario,
  onOpenMyDecks,
  onEditDeck,
  onDuplicateDeck,
  onDeleteDeck,
  onRefreshDecks,
}: MainMenuMasterDuelProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false)

  const hasDecks = decks.length > 0
  const hasSelectedDeck =
    hasDecks && decks.some((deck) => deck.id === selectedDeckId)
  const selectedDeck = hasSelectedDeck
    ? decks.find((deck) => deck.id === selectedDeckId) ??
      decks[0]
    : decks[0]
  const selectedDeckIndex = selectedDeck
    ? decks.findIndex((deck) => deck.id === selectedDeck.id)
    : -1
  const selectedDeckMeta = selectedValidation
    ? selectedValidation
    : null

  const heroUrl = useMemo(() => {
    if (!selectedDeck?.entries.length) {
      return fallbackHero
    }

    const entry = selectedDeck.entries.find((candidate) =>
      getCardPoolEntry(candidate.cardNumber)?.imageUrl,
    )
    return entry ? getCardPoolEntry(entry.cardNumber)!.imageUrl : fallbackHero
  }, [selectedDeck])

  const selectDeckByOffset = (delta: number) => {
    if (!hasDecks || selectedDeckIndex < 0 || decks.length <= 1) return
    const next = (selectedDeckIndex + delta + decks.length) % decks.length
    onSelectDeck(decks[next].id)
  }


  return (
    <main className="main-menu-shell main-menu-master-duel">
      <div className="main-menu-md-hero" aria-hidden="true">
        <span className="main-menu-md-hero-label">YOUR DECK · 你的牌組</span>
        <div className="main-menu-md-hero-glow" />
        <img
          key={heroUrl}
          className="main-menu-md-hero-card"
          src={heroUrl}
          alt=""
          onLoad={(event) => { event.currentTarget.style.backgroundImage = 'none' }}
          onError={(event) => {
            if (!event.currentTarget.src.endsWith('/card-back.png')) {
              event.currentTarget.src = '/card-back.png'
            }
          }}
        />
        <div className="main-menu-md-hero-caption"><strong>{selectedDeck?.name ?? '從第一副牌組開始'}</strong><span>每一張卡，都是下一場對戰的可能。</span></div>
      </div>

      <div className="main-menu-md-left">
        <h1
          className="main-menu-md-brand"
          aria-label="薑餅人對戰卡牌 Braverse"
        >
          <span className="main-menu-md-brand-line main-menu-md-brand-top">
            薑餅人
          </span>
          <span className="main-menu-md-brand-line main-menu-md-brand-main">
            對戰卡牌
          </span>
          <span className="main-menu-md-brand-badge">BRAVERSE</span>
        </h1>


        <section className="main-menu-md-loadout" aria-label="目前牌組">
          <div className="main-menu-md-loadout-head">
            <span className="main-menu-md-eyebrow">目前玩家牌組</span>
            {selectedDeck && (
              <span className="main-menu-md-counter">
                {selectedDeckIndex + 1} / {decks.length}
              </span>
            )}
          </div>

          {selectedDeck ? (
            <>
              <div className="main-menu-md-switcher">
                <button
                  type="button"
                  className="main-menu-md-arrow"
                  disabled={decks.length < 2}
                  aria-label="上一副牌組"
                  onClick={() => selectDeckByOffset(-1)}
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
                <div className="main-menu-md-deckname" title={selectedDeck.name}>
                  <span>
                    {isBs8CandidateStagingDeck(selectedDeck)
                      ? '[BS8 候選驗收] '
                      : ''}
                    {selectedDeck.name}
                  </span>
                  <span
                    className={`main-menu-md-tag ${
                      selectedDeckMeta?.isValid ? 'ok' : 'warn'
                    }`}
                  >
                    {selectedDeckMeta?.isValid ? '合法' : '需調整'}
                  </span>
                </div>
                <button
                  type="button"
                  className="main-menu-md-arrow"
                  disabled={decks.length < 2}
                  aria-label="下一副牌組"
                  onClick={() => selectDeckByOffset(1)}
                >
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>

              <div className="main-menu-md-chips">
                <span>{selectedDeckMeta?.stats.totalCards ?? 0} / 60 張</span>
                <span>FLIP {selectedDeckMeta?.stats.flipCards ?? 0} / 16</span>
                <span>餅乾 {selectedDeckMeta?.stats.cookieCards ?? 0}</span>
                <span>物品 {selectedDeckMeta?.stats.itemCards ?? 0}</span>
                <span>陷阱 {selectedDeckMeta?.stats.trapCards ?? 0}</span>
                <span>場景 {selectedDeckMeta?.stats.stageCards ?? 0}</span>
              </div>

              {selectedDeckMeta && selectedDeckMeta.errors.length > 0 && (
                <div className="main-menu-md-errors" role="alert">
                  <span aria-hidden="true">⚠</span>
                  <div>
                    <strong>目前牌組尚未合法</strong>
                    <ul>
                      {selectedDeckMeta.errors.map((error: string) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {battleError && (
                <p className="main-menu-md-reason">{battleError}</p>
              )}

              <div className="main-menu-md-detail">
                <span>{getDeckFormatLabel(selectedDeck.format ?? 'standard')}</span>
                <span>
                  更新：{new Intl.DateTimeFormat('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(selectedDeck.updatedAt))}
                </span>
              </div>

              <div className="main-menu-md-actions">
                <button
                  type="button"
                  onClick={() => onEditDeck(selectedDeck)}
                  data-testid="open-deck-editor"
                >
                  <Pencil aria-hidden="true" />
                  編輯牌組
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateDeck(selectedDeck)}
                >
                  <Copy aria-hidden="true" />
                  複製
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDeck(selectedDeck)}
                >
                  <Trash2 aria-hidden="true" />
                  刪除
                </button>
              </div>
            </>
          ) : (
            <p className="main-menu-md-empty">尚未有自訂牌組。</p>
          )}

          <div className="main-menu-md-ai" role="group" aria-label="對手設定">
            <label>
              AI 牌組
              <select
                value={aiDeckChoice}
                onChange={(event) =>
                  onSelectAiDeck(event.target.value as AiDeckChoice)
                }
              >
                <option value="random">隨機</option>
                <option value="bs9-red-truth">BS9 紅｜Truth Aggro</option>
                <option value="bs9-yellow-prophecy">BS9 黃｜Prophecy Control</option>
                <option value="bs9-green-support">BS9 綠｜Support Engine</option>
                <option value="bs9-blue-deceit">BS9 藍｜Deceit Tempo</option>
                <option value="bs9-purple-mill">BS9 紫｜Mill Control</option>
                <option value="bs7-red-arena">BS7 紅｜Arena</option>
                <option value="bs7-yellow-arena">BS7 黃｜Arena</option>
                <option value="bs7-green-arena">BS7 綠｜Arena</option>
                <option value="bs7-blue-arena">BS7 藍｜Arena</option>
                <option value="bs7-purple-arena">BS7 紫｜Arena</option>
              </select>
            </label>
            <label>
              AI 等級
              <select
                value={aiLevel}
                onChange={(event) =>
                  onSelectAiLevel(Number(event.target.value) as AiLevel)
                }
              >
                <option value={1}>Lv.1</option>
                <option value={2}>Lv.2</option>
                <option value={3}>Lv.3</option>
                <option value={4}>Lv.4</option>
                <option value={5}>Lv.5</option>
              </select>
            </label>
          </div>
        </section>

        <nav className="main-menu-md-nav" aria-label="主選單">
          <button
            type="button"
            className="main-menu-md-navitem lv1 primary"
            onClick={onStartBattle}
            disabled={!hasDecks}
            data-testid="start-ai-battle"
            aria-label="AI 對戰"
          >
            <Swords aria-hidden="true" />
            <span><strong>AI 對戰</strong><small>準備就緒，開始挑戰</small></span>
            <ArrowRight className="main-menu-md-launch-arrow" aria-hidden="true" />
            {selectedDeckMeta && !selectedDeckMeta.isValid && (
              <span className="main-menu-md-badge" aria-hidden="true">
                !
              </span>
            )}
          </button>
          {!hasDecks && (
            <p className="main-menu-md-reason">
              尚無自訂牌組，請先建立牌組後再開始對戰。
            </p>
          )}

          <button
            type="button"
            className="main-menu-md-navitem lv2"
            onClick={onOpenOnlineMatch}
            disabled={!hasDecks}
            data-testid="open-online-match"
            aria-label="線上對戰"
          >
            <Users aria-hidden="true" />
            <span><strong>線上對戰</strong><small>建立或加入好友房</small></span>
          </button>
          {!hasDecks && (
            <p className="main-menu-md-reason">
              建立房間或加入房間，與好友進行對戰。
            </p>
          )}

          <button
            type="button"
            className="main-menu-md-navitem lv2"
            onClick={onOpenMyDecks}
            data-testid="open-my-decks"
            aria-label={hasDecks ? '管理牌組' : '建立第一副牌組'}
          >
            <Layers aria-hidden="true" />
            <span><strong>{hasDecks ? '管理牌組' : '建立第一副牌組'}</strong><small>編輯與整理收藏</small></span>
          </button>
        </nav>

        <footer className="main-menu-md-footer">
          <details
            className="main-menu-md-dev-tools"
            open={devToolsOpen}
            onToggle={(event) =>
              setDevToolsOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary className="main-menu-md-utility-label">開發者工具</summary>
            <nav className="main-menu-md-utility" aria-label="開發者工具">
              <button type="button" onClick={() => onOpenTestScenario()}>
                <FlaskConical aria-hidden="true" />
                測試對局設定
              </button>
              <button type="button" onClick={onRefreshDecks}>
                <RefreshCw aria-hidden="true" />
                重新讀取
              </button>
            </nav>
          </details>

          <p className="main-menu-md-disclaimer">
            本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權；CookieRun:
            Braverse 卡牌與圖像之著作權均屬 Devsisters 所有。
          </p>
        </footer>
      </div>
    </main>
  )
}
