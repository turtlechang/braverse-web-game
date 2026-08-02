import { AlertTriangle, Copy, FlaskConical, Pencil, Play, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react'
import type { AiLevel, DeckChoice } from '../game'
import type { DeckValidationResult } from '../game/custom-deck'
import type { CustomDeck } from '../game/custom-deck'
import { validateCustomDeck } from '../game/custom-deck'

export type AiDeckChoice = 'random' | Exclude<DeckChoice, 'custom'>

const AI_DECK_OPTIONS: { value: AiDeckChoice; label: string }[] = [
  { value: 'bs3-green-lily', label: '第三彈綠色・聖百合餅乾' },
  { value: 'bs3-blue-sorbet', label: '第三彈藍色・PR 雪酪' },
  { value: 'bs3-red-pitaya', label: '第三彈紅色・火龍果龍族餅乾' },
  { value: 'bs3-purple-dark-cacao', label: '第三彈紫色・黑可可餅乾' },
  { value: 'bs3-purple-dark-cacao-fighting', label: '第三彈紫色・黑可可餅乾（打架流）' },
  { value: 'bs3-yellow-counter', label: '第三彈黃色・反擊流' },
]

const AI_LEVEL_OPTIONS: { value: AiLevel; label: string; hint: string }[] = [
  { value: 1, label: 'Lv.1 隨機出招', hint: '從合法動作中隨機挑選，不主動使用技能。' },
  { value: 2, label: 'Lv.2 基礎戰術', hint: '會出牌、用技能並攻擊較脆弱的目標。' },
  { value: 3, label: 'Lv.3 評估戰局', hint: '對每個可行動作評分後選擇最佳選項，會優先斬殺。' },
  { value: 4, label: 'Lv.4 兩層前瞻', hint: '模擬對手回應後再評分，並考量破壞區風險與高威脅目標。' },
]

interface MainMenuProps {
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
  onCreateDeck: () => void
  onEditDeck: (deck: CustomDeck) => void
  onDuplicateDeck: (deck: CustomDeck) => void
  onDeleteDeck: (deck: CustomDeck) => void
  onRefreshDecks: () => void
}

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export function MainMenu({
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
  onCreateDeck,
  onEditDeck,
  onDuplicateDeck,
  onDeleteDeck,
  onRefreshDecks,
}: MainMenuProps) {
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null
  const hasDecks = decks.length > 0

  return (
    <main className="main-menu-shell">
      <section className="main-menu-panel" aria-labelledby="main-menu-title">
        <div className="main-menu-heading">
          <h1
            id="main-menu-title"
            className="main-menu-brand-title"
            aria-label="薑餅人對戰卡牌 Braverse"
          >
            <span className="main-menu-brand-line main-menu-brand-line-top">
              薑餅人
            </span>
            <span className="main-menu-brand-line main-menu-brand-line-main">
              對戰卡牌
            </span>
            <span className="main-menu-brand-badge">BRAVERSE</span>
          </h1>
          <p>
            {hasDecks
              ? '選擇一副合法牌組後開始對戰；AI 對手的牌組與等級可在下方指定，或維持隨機。'
              : '歡迎！請先建立一副自訂牌組，即可開始對戰或線上對戰。'}
          </p>
        </div>

        <div className="main-menu-actions">
          {hasDecks ? (
            <button
              type="button"
              className="main-menu-primary"
              onClick={onStartBattle}
            >
              <Play aria-hidden="true" />
              對戰入口
            </button>
          ) : (
            <>
              <button
                type="button"
                className="main-menu-primary main-menu-create-first"
                onClick={onCreateDeck}
              >
                <Plus aria-hidden="true" />
                建立第一副牌組
              </button>
              <button
                type="button"
                className="main-menu-disabled-cta"
                disabled
              >
                <Play aria-hidden="true" />
                對戰入口
              </button>
              <p className="main-menu-disabled-reason">
                尚無自訂牌組，請先建立牌組後再開始對戰。
              </p>
            </>
          )}
          <button
            type="button"
            disabled={!hasDecks}
            onClick={onOpenOnlineMatch}
            data-testid="open-online-match"
          >
            <Wifi aria-hidden="true" />
            線上對戰
          </button>
          {!hasDecks && (
            <p className="main-menu-disabled-reason">
              尚無自訂牌組，請先建立牌組後再開始線上對戰。
            </p>
          )}
          <button
            type="button"
            onClick={onCreateDeck}
            data-testid="open-deck-editor"
          >
            <Pencil aria-hidden="true" />
            {hasDecks ? '牌組編輯器' : '開啟牌組編輯器'}
          </button>
        </div>

        <div className="main-menu-status-grid">
          <section className="main-menu-status">
            <span>目前玩家牌組</span>
            <strong>{selectedDeck?.name ?? '尚未選擇牌組'}</strong>
            {selectedValidation ? (
              <div className="main-menu-stat-row">
                <span>{selectedValidation.stats.totalCards} / 60 張</span>
                <span>FLIP {selectedValidation.stats.flipCards} / 16</span>
                <span>餅乾卡 {selectedValidation.stats.cookieCards}</span>
                <span>物品卡 {selectedValidation.stats.itemCards}</span>
                <span>陷阱卡 {selectedValidation.stats.trapCards}</span>
                <span>場景卡 {selectedValidation.stats.stageCards}</span>
              </div>
            ) : (
              <p>請先建立或選擇一副自訂牌組。</p>
            )}
            {(battleError || selectedValidation?.errors.length) && (
              <div className="main-menu-errors" role="alert">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>{battleError ?? '目前牌組尚未合法'}</strong>
                  <ul>
                    {(selectedValidation?.errors ?? []).map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="main-menu-status">
            <span>AI 對手</span>
            <div className="main-menu-ai-options">
              <label>
                牌組
                <select
                  value={aiDeckChoice}
                  onChange={(event) =>
                    onSelectAiDeck(event.target.value as AiDeckChoice)
                  }
                >
                  {AI_DECK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                等級
                <select
                  value={aiLevel}
                  onChange={(event) =>
                    onSelectAiLevel(Number(event.target.value) as AiLevel)
                  }
                >
                  {AI_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              {
                AI_LEVEL_OPTIONS.find((option) => option.value === aiLevel)
                  ?.hint
              }
            </p>
          </section>
        </div>

        <section className="main-menu-decks" aria-label="已儲存牌組">
          <div className="main-menu-section-title">
            <span>已儲存牌組</span>
            <button type="button" onClick={onCreateDeck}>
              新增牌組
            </button>
          </div>
          {decks.length === 0 ? (
            <div className="main-menu-empty">
              尚未有自訂牌組。請進入牌組編輯器建立第一副牌組。
            </div>
          ) : (
            <div className="main-menu-deck-list">
              {decks.map((deck) => {
                const validation = validateCustomDeck(deck.entries)
                return (
                  <article
                    key={deck.id}
                    className={
                      deck.id === selectedDeckId
                        ? 'main-menu-deck-card is-selected'
                        : 'main-menu-deck-card'
                    }
                  >
                    <button
                      type="button"
                      className="main-menu-deck-select"
                      onClick={() => onSelectDeck(deck.id)}
                    >
                      <strong>{deck.name}</strong>
                      <span
                        title={
                          validation.isValid
                            ? undefined
                            : validation.errors.join('\n')
                        }
                      >
                        {validation.isValid ? '合法' : '需調整'}
                      </span>
                    </button>
                    <div className="main-menu-deck-meta">
                      <span>{validation.stats.totalCards} 張</span>
                      <span>FLIP {validation.stats.flipCards}</span>
                      <span>餅乾 {validation.stats.cookieCards}</span>
                      <span>物品 {validation.stats.itemCards}</span>
                      <span>陷阱 {validation.stats.trapCards}</span>
                      <span>場景 {validation.stats.stageCards}</span>
                      <span>{formatUpdatedAt(deck.updatedAt)}</span>
                    </div>
                    <div className="main-menu-deck-actions">
                      <button
                        type="button"
                        className="main-menu-edit-deck"
                        onClick={() => onEditDeck(deck)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="main-menu-edit-deck"
                        title="建立一份相同內容的新牌組"
                        onClick={() => onDuplicateDeck(deck)}
                      >
                        <Copy aria-hidden="true" />
                        複製
                      </button>
                      <button
                        type="button"
                        className="main-menu-edit-deck main-menu-delete-deck"
                        onClick={() => onDeleteDeck(deck)}
                      >
                        <Trash2 aria-hidden="true" />
                        刪除
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
      <footer className="main-menu-footer">
        <details className="main-menu-dev-tools-details">
          <summary className="main-menu-dev-tools-label">開發者工具</summary>
          <nav className="main-menu-dev-tools" aria-label="開發者工具">
            <button type="button" onClick={onOpenTestScenario}>
              <FlaskConical aria-hidden="true" />
              測試對局設定
            </button>
            <button type="button" onClick={onRefreshDecks}>
              <RefreshCw aria-hidden="true" />
              重新讀取
            </button>
          </nav>
        </details>
        <p className="main-menu-disclaimer">
          本作品為非官方粉絲研究專案，與 Devsisters Corporation
          無任何關聯、合作或授權；CookieRun: Braverse
          卡牌與圖像之著作權均屬 Devsisters 所有。
        </p>
      </footer>
    </main>
  )
}
