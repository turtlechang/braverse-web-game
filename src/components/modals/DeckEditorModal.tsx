import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plus, Minus, Trash2, Save } from 'lucide-react'
import type { CustomDeck } from '../../game/custom-deck'
import {
  DECK_SIZE_MIN,
  DECK_SIZE_MAX,
  MAX_COPIES_PER_CARD,
  loadCustomDecks,
  saveCustomDecks,
} from '../../game/custom-deck'
import { getCardPoolEntry, type CardPoolEntry } from '../../game/card-pool'
import { useDeckEditor } from '../../hooks/useDeckEditor'
import './GameModals.css'

function CardPoolImage({ entry }: { entry: CardPoolEntry }) {
  const [failed, setFailed] = useState(false)

  if (failed || !entry.imageUrl) {
    return (
      <div className="card-pool-img-fallback">
        <span>{entry.type.toUpperCase()}</span>
        {entry.type === 'cookie' && <small>LV{entry.level}</small>}
      </div>
    )
  }

  return (
    <img
      className="card-pool-img"
      src={entry.imageUrl}
      alt={entry.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export interface DeckEditorModalProps {
  initialDeck?: CustomDeck
  onSave: (deck: CustomDeck) => void
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: null, label: '全部顏色' },
  { value: 'red', label: '紅色' },
  { value: 'yellow', label: '黃色' },
  { value: 'green', label: '綠色' },
  { value: 'blue', label: '藍色' },
  { value: 'purple', label: '紫色' },
  { value: 'black', label: '黑色' },
]

const TYPE_OPTIONS = [
  { value: null, label: '全部類型' },
  { value: 'cookie', label: '餅乾' },
  { value: 'item', label: '物品' },
  { value: 'trap', label: '陷阱' },
  { value: 'stage', label: '場景' },
  { value: 'flip', label: 'FLIP' },
]

const RARITY_OPTIONS = [
  { value: null, label: '全部稀有度' },
  { value: 'C', label: 'C' },
  { value: 'UC', label: 'UC' },
  { value: 'R', label: 'R' },
  { value: 'SR', label: 'SR' },
  { value: 'SSR', label: 'SSR' },
]

const SERIES_OPTIONS = [
  { value: null, label: '全部系列' },
  { value: 'Starter Deck RED', label: 'Starter Deck RED' },
  { value: 'Starter Deck YELLOW', label: 'Starter Deck YELLOW' },
  { value: 'Starter Deck GREEN', label: 'Starter Deck GREEN' },
  { value: 'Starter Deck BLUE', label: 'Starter Deck BLUE' },
  { value: 'Starter Deck PURPLE', label: 'Starter Deck PURPLE' },
  { value: 'BOOSTER PACK [BRAVE BEGINNING] BS1', label: 'BS1' },
  { value: 'BOOSTER PACK [BRAVE BEGINNING] BS2', label: 'BS2' },
]

export function DeckEditorModal({
  initialDeck,
  onSave,
  onClose,
}: DeckEditorModalProps) {
  const editor = useDeckEditor()
  const [tooltipCard, setTooltipCard] = useState<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tooltipCard) return

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltipCard(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [tooltipCard])

  const handleSave = useCallback(() => {
    if (!editor.deckValidation.valid) return

    const now = new Date().toISOString()
    const deck: CustomDeck = {
      id: initialDeck?.id ?? `custom-${Date.now()}`,
      name: editor.deckName,
      entries: editor.deckEntries,
      createdAt: initialDeck?.createdAt ?? now,
      updatedAt: now,
    }

    const existing = loadCustomDecks()
    const idx = existing.findIndex((d) => d.id === deck.id)
    if (idx >= 0) {
      existing[idx] = deck
    } else {
      existing.push(deck)
    }
    saveCustomDecks(existing)
    onSave(deck)
  }, [editor, initialDeck, onSave])

  const filteredPool = editor.getFilteredPool()

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="deck-editor-modal" role="dialog">
        <button
          className="close-modal"
          type="button"
          title="關閉"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <div className="deck-editor-layout">
          <div className="deck-editor-pool">
            <span className="deck-editor-section-label">卡池瀏覽</span>
            <input
              type="text"
              className="deck-editor-search"
              placeholder="搜尋卡名或卡號..."
              value={editor.searchText}
              onChange={(e) => editor.setSearchText(e.target.value)}
            />
            <div className="deck-editor-filters">
              <select
                value={editor.filterColor ?? ''}
                onChange={(e) =>
                  editor.setFilterColor(e.target.value || null)
                }
              >
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={editor.filterType ?? ''}
                onChange={(e) =>
                  editor.setFilterType(e.target.value || null)
                }
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={editor.filterRarity ?? ''}
                onChange={(e) =>
                  editor.setFilterRarity(e.target.value || null)
                }
              >
                {RARITY_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={editor.filterSeries ?? ''}
                onChange={(e) =>
                  editor.setFilterSeries(e.target.value || null)
                }
              >
                {SERIES_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="deck-editor-pool-grid">
              {filteredPool.map((entry) => {
                const currentCount =
                  editor.deckEntries.find(
                    (e) => e.cardNumber === entry.cardNumber,
                  )?.count ?? 0
                const atMax = currentCount >= MAX_COPIES_PER_CARD

                return (
                  <div
                    key={entry.cardNumber}
                    className={`deck-editor-pool-card${atMax ? ' at-max' : ''}`}
                  >
                    <button
                      type="button"
                      className="deck-editor-pool-card-btn"
                      onClick={() =>
                        setTooltipCard(
                          tooltipCard === entry.cardNumber ? null : entry.cardNumber,
                        )
                      }
                    >
                      <CardPoolImage entry={entry} />
                    </button>
                    {tooltipCard === entry.cardNumber && (
                      <div className="deck-editor-tooltip" ref={tooltipRef}>
                        <div className="deck-editor-tooltip-header">
                          <span className="deck-editor-tooltip-number">
                            {entry.cardNumber}
                          </span>
                          <span className="deck-editor-tooltip-name">
                            {entry.name}
                          </span>
                        </div>
                        <div className="deck-editor-tooltip-actions">
                          <button
                            type="button"
                            className="deck-editor-tooltip-btn"
                            disabled={currentCount === 0}
                            onClick={() => {
                              editor.removeCard(entry.cardNumber)
                            }}
                          >
                            <Minus aria-hidden="true" />
                          </button>
                          <span className="deck-editor-tooltip-count">
                            {currentCount}
                          </span>
                          <button
                            type="button"
                            className="deck-editor-tooltip-btn"
                            disabled={atMax}
                            onClick={() => {
                              editor.addCard(entry.cardNumber)
                            }}
                          >
                            <Plus aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {filteredPool.length === 0 && (
                <div className="deck-editor-empty">
                  沒有符合條件的卡牌
                </div>
              )}
            </div>
          </div>
          <div className="deck-editor-deck">
            <span className="deck-editor-section-label">目前牌組</span>
            <input
              type="text"
              className="deck-editor-name-input"
              value={editor.deckName}
              onChange={(e) => editor.setDeckName(e.target.value)}
              placeholder="牌組名稱"
            />
            <div className="deck-editor-deck-header">
              <span>
                {editor.getDeckTotalCount()} / {DECK_SIZE_MIN}~{DECK_SIZE_MAX} 張
                （{editor.getDeckTotalCards()} 種）
              </span>
            </div>
            <div className="deck-editor-deck-list">
              {editor.deckEntries.map((entry) => {
                const poolEntry = getCardPoolEntry(entry.cardNumber)
                return (
                  <div
                    key={entry.cardNumber}
                    className="deck-editor-deck-entry"
                  >
                    {poolEntry?.imageUrl ? (
                      <img
                        className="deck-editor-deck-thumb"
                        src={poolEntry.imageUrl}
                        alt={poolEntry.name}
                      />
                    ) : (
                      <div className="deck-editor-deck-thumb deck-editor-deck-thumb-fallback">
                        {poolEntry?.type?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="deck-editor-deck-entry-number">
                      {entry.cardNumber}
                    </span>
                    <span className="deck-editor-deck-entry-name">
                      {poolEntry?.name ?? entry.cardNumber}
                    </span>
                    <div className="deck-editor-deck-entry-controls">
                      <button
                        type="button"
                        className="deck-editor-count-btn"
                        onClick={() =>
                          editor.removeCard(entry.cardNumber)
                        }
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span className="deck-editor-deck-entry-count">
                        {entry.count}
                      </span>
                      <button
                        type="button"
                        className="deck-editor-count-btn"
                        disabled={entry.count >= MAX_COPIES_PER_CARD}
                        onClick={() =>
                          editor.addCard(entry.cardNumber)
                        }
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {editor.deckEntries.length === 0 && (
                <div className="deck-editor-empty">
                  尚未加入任何卡牌
                </div>
              )}
            </div>
            <div className="deck-editor-deck-actions">
              <button
                type="button"
                className="deck-editor-clear-btn"
                onClick={editor.clearDeck}
              >
                <Trash2 aria-hidden="true" />
                清空
              </button>
              <button
                type="button"
                className="deck-editor-save-btn"
                disabled={!editor.deckValidation.valid}
                onClick={handleSave}
              >
                <Save aria-hidden="true" />
                儲存牌組
              </button>
            </div>
            {editor.deckValidation.errors.length > 0 && (
              <div className="deck-editor-errors">
                {editor.deckValidation.errors.map((err) => (
                  <div key={err} className="deck-editor-error">
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
