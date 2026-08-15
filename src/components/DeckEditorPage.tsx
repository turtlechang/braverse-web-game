import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Download,
  Minus,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react'
import type { CustomDeck } from '../game/custom-deck'
import {
  DECK_SIZE_REQUIRED,
  MAX_FLIP_CARDS,
  exportDeck,
  importDeck,
  loadCustomDecks,
  saveCustomDecks,
} from '../game/custom-deck'
import {
  getCardPoolEntry,
  normalizeCardNumber,
  type CardPoolEntry,
} from '../game/card-pool'
import { CardEffectText } from './cards/CardVisuals'
import {
  DEFAULT_DECK_FORMAT,
  getCardRestriction,
  getDeckCopyLimit,
} from '../game/deck-rules'
import { useDeckEditor } from '../hooks/useDeckEditor'
import './DeckEditorPage.css'

interface DeckEditorPageProps {
  initialDeck?: CustomDeck
  onSave: (deck: CustomDeck) => void
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: '', label: '全部顏色' },
  { value: 'red', label: '紅色' },
  { value: 'yellow', label: '黃色' },
  { value: 'green', label: '綠色' },
  { value: 'blue', label: '藍色' },
  { value: 'purple', label: '紫色' },
  { value: 'black', label: '黑色' },
  { value: 'wild', label: '萬用' },
]

const TYPE_OPTIONS = [
  { value: '', label: '全部類型' },
  { value: 'cookie', label: '餅乾' },
  { value: 'item', label: '物品' },
  { value: 'trap', label: '陷阱' },
  { value: 'stage', label: '場景' },
  { value: 'flip', label: 'FLIP' },
]

const RARITY_OPTIONS = ['', 'C', 'U', 'R', 'SR', 'SSR', 'UR', 'SEC', 'SUR']

const MAIN_DECK_SECTIONS = [
  { id: 'cookie', label: '餅乾' },
  { id: 'flip', label: 'FLIP' },
  { id: 'item', label: '物品' },
  { id: 'trap', label: '陷阱' },
  { id: 'stage', label: '場景' },
] as const

const SERIES_OPTIONS = [
  { value: '', label: '全部系列' },
  { value: 'Starter Deck RED', label: 'Starter Deck RED' },
  { value: 'Starter Deck YELLOW', label: 'Starter Deck YELLOW' },
  { value: 'Starter Deck GREEN', label: 'Starter Deck GREEN' },
  { value: 'Starter Deck BLUE', label: 'Starter Deck BLUE' },
  { value: 'Starter Deck PURPLE', label: 'Starter Deck PURPLE' },
  { value: 'BOOSTER PACK [BRAVE BEGINNING] BS1', label: 'BS1' },
  { value: 'BOOSTER PACK [BRAVE BEGINNING] BS2', label: 'BS2' },
  { value: 'BS3', label: 'BS3' },
  { value: 'BS4', label: 'BS4' },
  { value: 'BS5', label: 'BS5' },
  { value: 'BS6', label: 'BS6' },
  { value: 'PROMOTION CARD', label: '特典卡' },
]

const cardTypeLabel: Record<CardPoolEntry['type'], string> = {
  cookie: '餅乾',
  item: '物品',
  trap: '陷阱',
  stage: '場景',
  flip: 'FLIP',
  extra: '額外',
  unknown: '未知',
}

const cardTone = (color: string | null) => {
  const value = color?.toLowerCase()
  if (value === 'red' || value === 'yellow' || value === 'green' || value === 'blue' || value === 'purple') {
    return value
  }
  return 'neutral'
}

function CardPoolImage({ entry, className = '' }: { entry: CardPoolEntry; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed || !entry.imageUrl) {
    return (
      <div className={`deck-page-card-fallback ${className}`}>
        <span>{cardTypeLabel[entry.type]}</span>
        {entry.type === 'cookie' && <small>LV{entry.level ?? '-'}</small>}
      </div>
    )
  }

  return (
    <img
      className={`deck-page-card-image ${className}`}
      src={entry.imageUrl}
      alt={entry.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

const countForBase = (entries: CustomDeck['entries'], cardNumber: string) => {
  const base = normalizeCardNumber(cardNumber)
  return entries
    .filter((entry) => normalizeCardNumber(entry.cardNumber) === base)
    .reduce((sum, entry) => sum + entry.count, 0)
}

const splitNormalAttackText = (attackText: string) => {
  const match = attackText.match(/^([\s\S]*?\{da\})\s*(\d+)([\s\S]*)$/i)

  if (!match) return null

  return {
    mainText: match[1],
    attackPower: Number(match[2]),
    followUpText: match[3].trim(),
  }
}

export function DeckEditorPage({ initialDeck, onSave, onClose }: DeckEditorPageProps) {
  const editor = useDeckEditor()
  const { loadDeck } = editor
  const [selectedCardNumber, setSelectedCardNumber] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    JSON.stringify(
      initialDeck
        ? {
            name: initialDeck.name,
            format: initialDeck.format ?? DEFAULT_DECK_FORMAT,
            entries: initialDeck.entries,
          }
        : {
            name: editor.deckName,
            format: editor.deckFormat,
            entries: editor.deckEntries,
          },
    ),
  )
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [showPoolFilters, setShowPoolFilters] = useState(false)
  const [importText, setImportText] = useState('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const statusTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const closeImportPanel = useCallback(() => {
    setShowImportPanel(false)
    setImportText('')
  }, [])

  const hasUnsavedChanges =
    JSON.stringify({
      name: editor.deckName,
      format: editor.deckFormat,
      entries: editor.deckEntries,
    }) !== savedSnapshot

  useEffect(() => {
    if (initialDeck) loadDeck(initialDeck)
  }, [initialDeck, loadDeck])

  useEffect(() => {
    if (!showImportPanel) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeImportPanel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeImportPanel, showImportPanel])

  const filteredPool = editor.getFilteredPool()
  const deckStats = editor.deckValidation.stats
  const activePoolFilterCount = [
    editor.filterType,
    editor.filterColor,
    editor.filterSeries,
    editor.filterRarity,
  ].filter(Boolean).length
  const deckCards = useMemo(
    () =>
      editor.deckEntries.flatMap((entry) => {
        const poolEntry = getCardPoolEntry(entry.cardNumber)
        return poolEntry ? [{ entry, poolEntry }] : []
      }),
    [editor.deckEntries],
  )
  const mainDeckSections = useMemo(
    () =>
      MAIN_DECK_SECTIONS.map((section) => {
        const cards = deckCards.filter(({ poolEntry }) => poolEntry.type === section.id)
        return {
          ...section,
          cards,
          totalCards: cards.reduce((total, { entry }) => total + entry.count, 0),
        }
      }),
    [deckCards],
  )
  const selectedCard = useMemo(() => {
    if (selectedCardNumber) {
      return getCardPoolEntry(selectedCardNumber) ?? null
    }
    return filteredPool[0] ?? null
  }, [filteredPool, selectedCardNumber])
  const normalAttack = useMemo(
    () =>
      selectedCard?.type === 'cookie' && selectedCard.attackText
        ? splitNormalAttackText(selectedCard.attackText)
        : null,
    [selectedCard],
  )
  const selectedCardSkillText = selectedCard?.skill.text?.trim() ?? ''
  const selectedCardFlipText =
    selectedCard?.flipText?.trim() ||
    (selectedCard?.type === 'flip' ? selectedCardSkillText : '')
  const selectedCardSkillDisplayText =
    selectedCard?.type === 'flip' ? '' : selectedCardSkillText

  const showStatus = (message: string) => {
    setStatusMsg(message)
    clearTimeout(statusTimeout.current)
    statusTimeout.current = setTimeout(() => setStatusMsg(null), 2600)
  }

  const handleSave = useCallback(() => {
    if (editor.deckEntries.length === 0) return

    const now = new Date().toISOString()
    const deck: CustomDeck = {
      id: initialDeck?.id ?? `custom-${Date.now()}`,
      name: editor.deckName,
      entries: editor.deckEntries,
      format: editor.deckFormat,
      createdAt: initialDeck?.createdAt ?? now,
      updatedAt: now,
    }
    const existing = loadCustomDecks()
    const index = existing.findIndex((entry) => entry.id === deck.id)
    if (index >= 0) existing[index] = deck
    else existing.push(deck)
    saveCustomDecks(existing)
    setSavedSnapshot(
      JSON.stringify({
        name: deck.name,
        format: deck.format ?? DEFAULT_DECK_FORMAT,
        entries: deck.entries,
      }),
    )
    onSave(deck)
  }, [editor, initialDeck, onSave])

  const handleRequestClose = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('目前牌組有尚未儲存的變更，確定要返回嗎？')
    ) {
      return
    }
    onClose()
  }, [hasUnsavedChanges, onClose])

  const handleClear = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm('清空會移除目前尚未儲存的牌組內容，確定要繼續嗎？')
    ) {
      return
    }
    editor.clearDeck()
  }, [editor, hasUnsavedChanges])

  const handleExport = useCallback(() => {
    if (editor.deckEntries.length === 0) {
      showStatus('牌組是空的，無可匯出')
      return
    }
    const now = new Date().toISOString()
    const deck: CustomDeck = {
      format: editor.deckFormat,
      id: `export-${Date.now()}`,
      name: editor.deckName || '未命名牌組',
      entries: editor.deckEntries,
      createdAt: now,
      updatedAt: now,
    }
    navigator.clipboard.writeText(exportDeck(deck)).then(
      () => showStatus('已複製牌組 JSON 到剪貼簿'),
      () => showStatus('複製失敗，請改用匯入／匯出檔案功能'),
    )
  }, [editor])

  const handleImport = () => {
    const result = importDeck(importText, { format: editor.deckFormat })
    if (result.error) {
      showStatus(result.error)
      return
    }
    if (!result.deck) return
    if (
      hasUnsavedChanges &&
      !window.confirm('匯入會覆蓋目前尚未儲存的牌組內容，確定要繼續嗎？')
    ) {
      return
    }
    editor.loadDeck(result.deck)
    closeImportPanel()
    showStatus(`已匯入牌組「${result.deck.name}」`)
  }

  return (
    <main className="deck-editor-page" data-testid="deck-editor-page">
      <header className="deck-editor-page-header">
        <button
          type="button"
          className="deck-editor-page-back"
          data-testid="deck-editor-page-back"
          onClick={handleRequestClose}
        >
          <ArrowLeft aria-hidden="true" />
          返回牌組
        </button>
        <div className="deck-editor-page-header-center">
          <div className="deck-editor-page-header-copy">
            <div className="deck-editor-page-title">
              <span>BRAVERSE / DECK LAB</span>
              <h1>牌組編輯器</h1>
            </div>
            <div className="deck-editor-page-validation deck-editor-page-header-validation" role="status">
              <span className={editor.deckValidation.valid ? 'is-valid' : 'is-pending'}>
                {editor.deckValidation.valid ? '牌組合法，可進入對戰' : '牌組尚未完成，仍可先儲存草稿'}
              </span>
              <small>點選牌組卡片查看詳細內容；使用 ＋／－調整張數。</small>
            </div>
          </div>
          <div className="deck-editor-page-pool-tools deck-editor-page-header-pool-tools">
            <div className="deck-editor-page-stat-chips">
              <span>餅乾 {deckStats.cookieCards}</span>
              <span>物品 {deckStats.itemCards}</span>
              <span>陷阱 {deckStats.trapCards}</span>
              <span>場景 {deckStats.stageCards}</span>
            </div>
            <div className="deck-editor-page-io">
              <button type="button" onClick={handleExport}>
                <Download aria-hidden="true" />
                匯出 JSON
              </button>
              <button
                type="button"
                onClick={() => setShowImportPanel(true)}
              >
                <Upload aria-hidden="true" />
                匯入 JSON
              </button>
            </div>
          </div>
        </div>
        <div className="deck-editor-page-header-actions">
          <div className="deck-editor-page-counter" aria-label="牌組統計">
            <strong>{deckStats.totalCards}</strong>
            <span>/ {DECK_SIZE_REQUIRED} 張</span>
            <small>FLIP {deckStats.flipCards}/{MAX_FLIP_CARDS}</small>
          </div>
          <label className="deck-editor-page-header-format">
            <span>賽制</span>
            <select
              data-testid="deck-format-select"
              value={editor.deckFormat}
              onChange={(event) =>
                editor.setDeckFormat(event.target.value as 'open' | 'standard')
              }
            >
              <option value="standard">標準賽制・套用禁限卡</option>
              <option value="open">開放賽制・所有正式卡牌</option>
            </select>
          </label>
          <button
            type="button"
            className={`deck-editor-page-save ${editor.deckValidation.valid ? '' : 'is-draft'}`}
            disabled={editor.deckEntries.length === 0}
            onClick={handleSave}
            data-testid="deck-editor-page-save"
          >
            <Save aria-hidden="true" />
            {editor.deckValidation.valid ? '儲存牌組' : '儲存草稿'}
          </button>
        </div>
      </header>

      <div className="deck-editor-page-workspace">
        <aside className="deck-editor-page-detail" aria-label="卡牌詳細資料">
          <div className="deck-editor-page-detail-kicker">卡牌資訊</div>
          {selectedCard ? (
            <>
              <div className="deck-editor-page-detail-overview">
                <div className={`deck-editor-page-detail-card tone-${cardTone(selectedCard.color)}`}>
                  <CardPoolImage entry={selectedCard} />
                </div>
                <div className="deck-editor-page-detail-summary">
                  <div className="deck-editor-page-detail-heading">
                    <span>{selectedCard.cardNumber}</span>
                    <h2>{selectedCard.name}</h2>
                  </div>
                  <dl className="deck-editor-page-detail-facts" data-testid="deck-editor-card-facts">
                    <div>
                      <dt>等級</dt>
                      <dd>{selectedCard.level ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>HP</dt>
                      <dd>{selectedCard.hp ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>攻擊力</dt>
                      <dd>{normalAttack?.attackPower ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>類型</dt>
                      <dd>{cardTypeLabel[selectedCard.type]}</dd>
                    </div>
                    <div>
                      <dt>稀有度</dt>
                      <dd>{selectedCard.rarity ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="deck-editor-page-detail-copy">
                {selectedCardSkillDisplayText && (
                  <section>
                    <span>技能</span>
                    <p><CardEffectText text={selectedCardSkillDisplayText} /></p>
                  </section>
                )}
                {normalAttack ? (
                  <>
                    <section>
                      <span>攻擊</span>
                      <p className="deck-editor-page-normal-attack">
                        <CardEffectText text={normalAttack.mainText} />
                        <b>{normalAttack.attackPower}</b>
                      </p>
                    </section>
                    {normalAttack.followUpText && (
                      <section>
                        <span>攻擊後續效果</span>
                        <p><CardEffectText text={normalAttack.followUpText} /></p>
                      </section>
                    )}
                  </>
                ) : selectedCard.attackText ? (
                  <section>
                    <span>{selectedCard.type === 'cookie' ? '攻擊' : '效果'}</span>
                    <p><CardEffectText text={selectedCard.attackText} /></p>
                  </section>
                ) : null}
                {selectedCardFlipText && (
                  <section>
                    <span>FLIP</span>
                    <p><CardEffectText text={selectedCardFlipText} /></p>
                  </section>
                )}
              </div>
              <div className="deck-editor-page-detail-actions">
                <strong>牌組內數量：{countForBase(editor.deckEntries, selectedCard.cardNumber)}</strong>
                <div>
                  <button
                    type="button"
                    onClick={() => editor.removeCard(selectedCard.cardNumber)}
                    disabled={countForBase(editor.deckEntries, selectedCard.cardNumber) === 0}
                    aria-label="從牌組移除一張"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.addCard(selectedCard.cardNumber)}
                    disabled={
                      countForBase(editor.deckEntries, selectedCard.cardNumber) >=
                      getDeckCopyLimit(selectedCard.cardNumber, editor.deckFormat)
                    }
                    aria-label="加入一張到牌組"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="deck-editor-page-empty-detail">
              目前篩選沒有可顯示的卡牌。
            </div>
          )}
        </aside>

        <section className="deck-editor-page-current" aria-labelledby="deck-editor-current-title">
          <div className="deck-editor-page-deck-meta">
            <label className="deck-editor-page-name">
              <span>牌組名稱</span>
              <input
                value={editor.deckName}
                onChange={(event) => editor.setDeckName(event.target.value)}
                aria-label="牌組名稱"
              />
            </label>
          </div>
          <div className="deck-editor-page-section-heading">
            <div>
              <span>編輯中</span>
              <h2 id="deck-editor-current-title">主要牌組</h2>
            </div>
            <strong>{deckStats.totalCards} / {DECK_SIZE_REQUIRED}</strong>
          </div>
          <div className="deck-editor-page-deck-grid">
            {mainDeckSections.map((section) => (
              <section
                className="deck-editor-page-deck-group"
                data-testid={`deck-editor-deck-section-${section.id}`}
                key={section.id}
                aria-labelledby={`deck-editor-deck-section-${section.id}-title`}
              >
                <header>
                  <h3 id={`deck-editor-deck-section-${section.id}-title`}>{section.label}</h3>
                  <strong>{section.totalCards} 張</strong>
                </header>
                {section.cards.length > 0 && (
                  <div className="deck-editor-page-deck-section-grid">
                    {section.cards.map(({ entry, poolEntry }) => (
                <article className="deck-editor-page-deck-card" key={entry.cardNumber}>
                  <button
                    type="button"
                    className="deck-editor-page-deck-card-face"
                    onClick={() => setSelectedCardNumber(entry.cardNumber)}
                    aria-label={`查看 ${poolEntry.cardNumber} ${poolEntry.name}`}
                  >
                    <CardPoolImage entry={poolEntry} />
                    <span>{entry.count}</span>
                  </button>
                  <div className="deck-editor-page-deck-card-controls">
                    <strong>{poolEntry.cardNumber}</strong>
                    <button
                      type="button"
                      onClick={() => editor.removeCard(entry.cardNumber)}
                      aria-label={`移除 ${poolEntry.name}`}
                    >
                      <Minus aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={countForBase(editor.deckEntries, entry.cardNumber) >= getDeckCopyLimit(entry.cardNumber, editor.deckFormat)}
                      onClick={() => editor.addCard(entry.cardNumber)}
                      aria-label={`增加 ${poolEntry.name}`}
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
            {editor.deckEntries.length === 0 && (
              <div className="deck-editor-page-empty-deck">
                從右側卡片列表點選卡牌加入主要牌組。
              </div>
            )}
          </div>
          <section
            className="deck-editor-page-extra-deck"
            data-testid="deck-editor-extra-deck"
            aria-labelledby="deck-editor-extra-deck-title"
          >
            <div>
              <span>BS8 預備</span>
              <h3 id="deck-editor-extra-deck-title">額外牌組</h3>
            </div>
            <strong>0 張</strong>
            <p>BS8 額外牌組規則與卡牌尚未公布；目前不納入 60 張主牌組、FLIP 上限或匯入格式。</p>
          </section>
          {editor.deckValidation.errors.length > 0 && (
            <div className="deck-editor-page-errors" role="alert">
              {editor.deckValidation.errors.map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          )}
          <div className="deck-editor-page-current-footer">
            <button type="button" onClick={handleClear}>
              <Trash2 aria-hidden="true" />
              清空牌組
            </button>
            <span>正式對戰會依目前選擇的賽制檢查禁限卡。</span>
          </div>
        </section>

        <aside className="deck-editor-page-pool" aria-labelledby="deck-editor-pool-title">
          <div className="deck-editor-page-section-heading">
            <div>
              <span>卡池</span>
              <h2 id="deck-editor-pool-title">卡片列表</h2>
            </div>
            <strong>{filteredPool.length}</strong>
          </div>
          <div className="deck-editor-page-search-tools">
            <label className="deck-editor-page-search">
              <Search aria-hidden="true" />
              <input
                data-testid="deck-editor-search"
                value={editor.searchText}
                onChange={(event) => editor.setSearchText(event.target.value)}
                placeholder="搜尋卡名或卡號"
                aria-label="搜尋卡名或卡號"
              />
            </label>
            <button
              type="button"
              className="deck-editor-page-filter-toggle"
              data-testid="deck-editor-filter-toggle"
              aria-expanded={showPoolFilters}
              aria-controls="deck-editor-pool-filters"
              onClick={() => setShowPoolFilters((current) => !current)}
            >
              <SlidersHorizontal aria-hidden="true" />
              篩選條件
              {activePoolFilterCount > 0 && <b>{activePoolFilterCount}</b>}
            </button>
          </div>
          {showPoolFilters && (
            <div className="deck-editor-page-filter-panel" id="deck-editor-pool-filters">
              <div className="deck-editor-page-filter-row">
                <select
                  value={editor.filterType ?? ''}
                  onChange={(event) => editor.setFilterType(event.target.value || null)}
                  aria-label="卡牌類型"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value || 'all-type'}>{option.label}</option>
                  ))}
                </select>
                <select
                  value={editor.filterColor ?? ''}
                  onChange={(event) => editor.setFilterColor(event.target.value || null)}
                  aria-label="卡牌顏色"
                >
                  {COLOR_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value || 'all-color'}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="deck-editor-page-filter-row">
                <select
                  value={editor.filterSeries ?? ''}
                  onChange={(event) => editor.setFilterSeries(event.target.value || null)}
                  aria-label="卡牌系列"
                >
                  {SERIES_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value || 'all-series'}>{option.label}</option>
                  ))}
                </select>
                <select
                  value={editor.filterRarity ?? ''}
                  onChange={(event) => editor.setFilterRarity(event.target.value || null)}
                  aria-label="卡牌稀有度"
                >
                  <option value="">全部稀有度</option>
                  {RARITY_OPTIONS.filter(Boolean).map((rarity) => <option value={rarity} key={rarity}>{rarity}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="deck-editor-page-pool-grid">
            {filteredPool.map((entry) => {
              const baseCardNumber = normalizeCardNumber(entry.cardNumber)
              const total = countForBase(editor.deckEntries, baseCardNumber)
              const restriction = getCardRestriction(baseCardNumber, editor.deckFormat)
              const copyLimit = getDeckCopyLimit(baseCardNumber, editor.deckFormat)
              const atMax = total >= copyLimit
              return (
                <div
                  className={`deck-editor-page-pool-card${selectedCard?.cardNumber === entry.cardNumber ? ' is-selected' : ''}${restriction !== 'none' ? ` restriction-${restriction}` : ''}`}
                  key={entry.cardNumber}
                >
                  <button
                    type="button"
                    className="deck-editor-page-pool-card-button"
                    disabled={atMax || restriction === 'banned'}
                    onClick={() => {
                      setSelectedCardNumber(entry.cardNumber)
                      editor.addCard(entry.cardNumber)
                    }}
                    title={`${baseCardNumber} ${entry.name}（點擊加入 1 張）`}
                  >
                    <CardPoolImage entry={entry} />
                  </button>
                  <button
                    type="button"
                    className="deck-editor-page-pool-card-select"
                    onClick={() => setSelectedCardNumber(entry.cardNumber)}
                    aria-label={`查看 ${entry.cardNumber} ${entry.name}`}
                  >
                    <span>{entry.cardNumber}</span>
                    <strong>{entry.name}</strong>
                  </button>
                  {total > 0 && <b className="deck-editor-page-pool-count">{total}</b>}
                  {restriction !== 'none' && <b className="deck-editor-page-pool-restriction">{restriction === 'banned' ? '禁' : '限 1'}</b>}
                </div>
              )
            })}
            {filteredPool.length === 0 && <div className="deck-editor-page-empty-pool">沒有符合條件的卡牌。</div>}
          </div>
        </aside>
      </div>

      {showImportPanel && (
        <div
          className="deck-editor-page-import-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeImportPanel()
          }}
        >
          <section
            className="deck-editor-page-import"
            data-testid="deck-editor-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-editor-import-title"
          >
            <div className="deck-editor-page-import-heading">
              <h2 id="deck-editor-import-title">匯入牌組 JSON</h2>
              <p>貼上牌組編輯器匯出的 JSON，匯入後仍會套用目前選擇的賽制檢查合法性。</p>
            </div>
            <textarea
              rows={8}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder='{"name":"我的牌組","entries":[{"cardNumber":"BS5-001","count":4}]}'
              aria-label="牌組 JSON"
              autoFocus
            />
            <div className="deck-editor-page-import-actions">
              <button type="button" onClick={closeImportPanel}>取消</button>
              <button type="button" onClick={handleImport} disabled={!importText.trim()}>確認匯入</button>
            </div>
          </section>
        </div>
      )}

      {statusMsg && <div className="deck-editor-page-status" role="status">{statusMsg}</div>}
    </main>
  )
}
