import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plus, Minus, Trash2, Save, Upload, Download, Info } from 'lucide-react'
import type { CustomDeck } from '../../game/custom-deck'
import {
  DECK_SIZE_REQUIRED,
  MAX_FLIP_CARDS,
  MAX_COPIES_PER_CARD,
  loadCustomDecks,
  saveCustomDecks,
  exportDeck,
  importDeck,
} from '../../game/custom-deck'
import {
  getCardPoolEntry,
  normalizeCardNumber,
  type CardPoolEntry,
} from '../../game/card-pool'
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
  { value: 'wild', label: '萬用' },
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
  { value: 'U', label: 'U' },
  { value: 'R', label: 'R' },
  { value: 'SR', label: 'SR' },
  { value: 'SSR', label: 'SSR' },
  { value: 'UR', label: 'UR' },
  { value: 'SEC', label: 'SEC' },
  { value: 'SUR', label: 'SUR' },
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
  { value: 'BOOSTER PACK [Age of Heroes and Kingdoms]', label: 'BS3' },
]

export function DeckEditorModal({
  initialDeck,
  onSave,
  onClose,
}: DeckEditorModalProps) {
  const editor = useDeckEditor()
  const { loadDeck } = editor
  const [tooltipCard, setTooltipCard] = useState<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    initialDeck
      ? JSON.stringify({ name: initialDeck.name, entries: initialDeck.entries })
      : JSON.stringify({ name: editor.deckName, entries: editor.deckEntries }),
  )
  const hasUnsavedChanges =
    JSON.stringify({ name: editor.deckName, entries: editor.deckEntries }) !==
    savedSnapshot

  useEffect(() => {
    if (initialDeck) {
      loadDeck(initialDeck)
    }
  }, [initialDeck, loadDeck])

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
    if (editor.deckEntries.length === 0) return

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
    setSavedSnapshot(JSON.stringify({ name: deck.name, entries: deck.entries }))
    onSave(deck)
  }, [editor, initialDeck, onSave])

  const handleRequestClose = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('目前牌組有尚未儲存的變更，確定要放棄並關閉嗎？')
    ) {
      return
    }
    onClose()
  }, [hasUnsavedChanges, onClose])

  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importText, setImportText] = useState('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const statusTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showStatus = (msg: string) => {
    setStatusMsg(msg)
    clearTimeout(statusTimeout.current)
    statusTimeout.current = setTimeout(() => setStatusMsg(null), 2500)
  }

  const handleExport = useCallback(() => {
    if (editor.deckEntries.length === 0) {
      showStatus('牌組是空的，無可匯出')
      return
    }
    const now = new Date().toISOString()
    const deck: CustomDeck = {
      id: `export-${Date.now()}`,
      name: editor.deckName || '未命名牌組',
      entries: editor.deckEntries,
      createdAt: now,
      updatedAt: now,
    }
    const json = exportDeck(deck)
    navigator.clipboard.writeText(json).then(
      () => showStatus('已複製牌組資料到剪貼簿'),
      () => showStatus('複製失敗，請手動選取文字'),
    )
  }, [editor])

  const handleImport = useCallback(() => {
    const result = importDeck(importText)
    if (result.error) {
      showStatus(result.error)
      return
    }
    if (result.deck) {
      if (
        hasUnsavedChanges &&
        !window.confirm(
          '匯入將覆蓋目前編輯中尚未儲存的牌組內容，確定要繼續嗎？',
        )
      ) {
        return
      }
      editor.setDeckName(result.deck.name)
      editor.clearDeck()
      for (const entry of result.deck.entries) {
        for (let i = 0; i < entry.count; i++) {
          editor.addCard(entry.cardNumber)
        }
      }
      setShowImportDialog(false)
      setImportText('')
      showStatus(`已匯入牌組「${result.deck.name}」`)
    }
  }, [editor, importText, hasUnsavedChanges])

  const filteredPool = editor.getFilteredPool()
  const deckStats = editor.deckValidation.stats

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="deck-editor-modal" role="dialog">
        <button
          className="close-modal"
          type="button"
          title="關閉"
          onClick={handleRequestClose}
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
              <select
                value={editor.filterLevel ?? ''}
                onChange={(e) =>
                  editor.setFilterLevel(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">全部等級</option>
                <option value="1">Lv.1</option>
                <option value="2">Lv.2</option>
                <option value="3">Lv.3</option>
              </select>
              <select
                value={editor.filterHp ?? ''}
                onChange={(e) =>
                  editor.setFilterHp(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">全部 HP</option>
                <option value="1">HP 1</option>
                <option value="2">HP 2</option>
                <option value="3">HP 3</option>
                <option value="4">HP 4</option>
                <option value="5">HP 5</option>
                <option value="6">HP 6</option>
              </select>
              <select
                value={editor.filterEffect ?? ''}
                onChange={(e) =>
                  editor.setFilterEffect(e.target.value || null)
                }
              >
                <option value="">全部效果</option>
                <option value="activate">啟動</option>
                <option value="blocker">阻擋者</option>
                <option value="on-play">登場時</option>
                <option value="your-turn">你的回合</option>
                <option value="once-per-turn">每回合一次</option>
              </select>
            </div>
            <div className="deck-editor-pool-grid">
              {filteredPool.map((entry) => {
                const baseCardNumber = normalizeCardNumber(entry.cardNumber)
                const ownCount = editor.deckEntries
                  .filter((e) => e.cardNumber === entry.cardNumber)
                  .reduce((sum, e) => sum + e.count, 0)
                const totalForBase = editor.deckEntries
                  .filter(
                    (e) => normalizeCardNumber(e.cardNumber) === baseCardNumber,
                  )
                  .reduce((sum, e) => sum + e.count, 0)
                const atMax = totalForBase >= MAX_COPIES_PER_CARD
                const showCount = ownCount

                return (
                  <div
                    key={entry.cardNumber}
                    className={`deck-editor-pool-card${atMax ? ' at-max' : ''}`}
                  >
                    <button
                      type="button"
                      className="deck-editor-pool-card-btn"
                      title={`${baseCardNumber} ${entry.name}（點擊加入 1 張）`}
                      disabled={atMax}
                      onClick={() => editor.addCard(entry.cardNumber)}
                    >
                      <CardPoolImage entry={entry} />
                    </button>
                    {showCount > 0 && (
                      <span className="deck-editor-pool-count" aria-hidden="true">
                        {showCount}
                      </span>
                    )}
                    <button
                      type="button"
                      className="deck-editor-pool-info-btn"
                      title="卡片詳細與數量調整"
                      onClick={() =>
                        setTooltipCard(
                          tooltipCard === baseCardNumber ? null : baseCardNumber,
                        )
                      }
                    >
                      <Info aria-hidden="true" />
                    </button>
                    {tooltipCard === baseCardNumber && (
                      <div className="deck-editor-tooltip" ref={tooltipRef}>
                        <div className="deck-editor-tooltip-header">
                          <span className="deck-editor-tooltip-number">
                            {baseCardNumber}
                          </span>
                          <span className="deck-editor-tooltip-name">
                            {entry.name}
                          </span>
                        </div>
                        <div className="deck-editor-tooltip-actions">
                          <button
                            type="button"
                            className="deck-editor-tooltip-btn"
                            disabled={showCount === 0}
                            onClick={() => {
                              editor.removeCard(entry.cardNumber)
                            }}
                          >
                            <Minus aria-hidden="true" />
                          </button>
                          <span className="deck-editor-tooltip-count">
                            {showCount}
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
                {deckStats.totalCards} / {DECK_SIZE_REQUIRED} 張
                （{editor.getDeckTotalCards()} 種）
              </span>
            </div>
            <div className="deck-editor-stats">
              <span>FLIP：{deckStats.flipCards} / {MAX_FLIP_CARDS}</span>
              <span>餅乾卡：{deckStats.cookieCards}</span>
              <span>物品卡：{deckStats.itemCards}</span>
              <span>陷阱卡：{deckStats.trapCards}</span>
              <span>場景卡：{deckStats.stageCards}</span>
            </div>
            <div className="deck-editor-io-bar">
              <button type="button" className="deck-editor-io-btn" onClick={handleExport}>
                <Download aria-hidden="true" />
                匯出
              </button>
              <button type="button" className="deck-editor-io-btn" onClick={() => setShowImportDialog(true)}>
                <Upload aria-hidden="true" />
                匯入
              </button>
            </div>
            <div className="deck-editor-deck-list">
              {editor.deckEntries.map((entry) => {
                const baseCardNumber = normalizeCardNumber(entry.cardNumber)
                const poolEntry = getCardPoolEntry(entry.cardNumber)
                const totalForBase = editor.deckEntries
                  .filter(
                    (e) => normalizeCardNumber(e.cardNumber) === baseCardNumber,
                  )
                  .reduce((sum, e) => sum + e.count, 0)
                const atBaseMax = totalForBase >= MAX_COPIES_PER_CARD
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
                      {baseCardNumber}
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
                        disabled={atBaseMax}
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
                onClick={() => {
                  if (
                    hasUnsavedChanges &&
                    !window.confirm(
                      '確定要清空目前牌組的所有卡牌嗎？尚未儲存的變更將會遺失。',
                    )
                  ) {
                    return
                  }
                  editor.clearDeck()
                }}
              >
                <Trash2 aria-hidden="true" />
                清空
              </button>
              <button
                type="button"
                className={
                  editor.deckValidation.valid
                    ? 'deck-editor-save-btn'
                    : 'deck-editor-save-btn is-draft'
                }
                disabled={editor.deckEntries.length === 0}
                title={
                  editor.deckValidation.valid
                    ? undefined
                    : '牌組尚未合法，將以草稿狀態儲存，可稍後再調整。'
                }
                onClick={handleSave}
              >
                <Save aria-hidden="true" />
                {editor.deckValidation.valid ? '儲存牌組' : '儲存草稿'}
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
        {statusMsg && <div className="deck-editor-status">{statusMsg}</div>}
        {showImportDialog && (
          <div className="deck-editor-import-overlay">
            <div className="deck-editor-import-dialog">
              <span className="deck-editor-import-title">匯入牌組</span>
              <p className="deck-editor-import-hint">貼上牌組 JSON 資料</p>
              <textarea
                className="deck-editor-import-textarea"
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"name":"我的牌組","entries":[{"cardNumber":"ST4-001","count":2}]}'
              />
              <div className="deck-editor-import-actions">
                <button
                  type="button"
                  className="deck-editor-import-cancel"
                  onClick={() => {
                    setShowImportDialog(false)
                    setImportText('')
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="deck-editor-import-confirm"
                  disabled={!importText.trim()}
                  onClick={handleImport}
                >
                  匯入
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
