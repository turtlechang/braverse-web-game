import { useMemo, useState } from 'react'
import { starterDeckGuide } from './help/starterDeckGuide'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  isBs8CandidateStagingDeck,
  validateBs8CandidateStagingDeck,
} from '../game'
import { getCardPoolEntry } from '../game/card-pool'
import {
  exportDeck,
  importDeck,
  validateCustomDeckDefinition,
  type CustomDeck,
  type DeckValidationResult,
} from '../game/custom-deck'
import {
  OFFICIAL_DECK_RECIPES,
  type StarterDeckChoice,
} from '../game/starter-deck'
import { getDeckFormatLabel } from '../game/deck-rules'

interface MyDecksPageProps {
  decks: CustomDeck[]
  selectedDeckId: string | null
  onSelectDeck: (deckId: string) => void
  onBack: () => void
  onCreateDeck: () => void
  onCreateStarterDeck: (choice: StarterDeckChoice) => void
  onImportDeck: (deck: CustomDeck) => void
  onEditDeck: (deck: CustomDeck) => void
  onDuplicateDeck: (deck: CustomDeck) => void
  onDeleteDecks: (deckIds: string[]) => boolean
}

const fallbackHero =
  'https://cookierunbraverse.com/data/en_storage/2HgB5QrG10BzWXr00hCI0w.webp'

const starterDeckOptions: Array<{ choice: StarterDeckChoice; label: string }> = [
  { choice: 'red', label: '紅色 Starter' },
  { choice: 'yellow', label: '黃色 Starter' },
  { choice: 'green', label: '綠色 Starter' },
  { choice: 'blue', label: '藍色 Starter' },
  { choice: 'purple', label: '紫色 Starter' },
]

const getDeckValidation = (deck: CustomDeck): DeckValidationResult =>
  isBs8CandidateStagingDeck(deck)
    ? validateBs8CandidateStagingDeck(deck)
    : validateCustomDeckDefinition(deck)

const getDeckHero = (deck: CustomDeck): string => {
  const heroEntry = deck.entries
    .map((entry) => getCardPoolEntry(entry.cardNumber))
    .find((entry) => Boolean(entry?.imageUrl))
  return heroEntry?.imageUrl ?? fallbackHero
}

const formatUpdatedAt = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '更新時間未知'
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function MyDecksPage({
  decks,
  selectedDeckId,
  onSelectDeck,
  onBack,
  onCreateDeck,
  onCreateStarterDeck,
  onImportDeck,
  onEditDeck,
  onDuplicateDeck,
  onDeleteDecks,
}: MyDecksPageProps) {
  const [bulkMode, setBulkMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [showStarterPanel, setShowStarterPanel] = useState(false)
  const [importText, setImportText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const validations = useMemo(
    () => new Map(decks.map((deck) => [deck.id, getDeckValidation(deck)])),
    [decks],
  )
  const selectedDeck =
    decks.find((deck) => deck.id === selectedDeckId) ?? null
  const validCheckedIds = checkedIds.filter((id) =>
    decks.some((deck) => deck.id === id),
  )

  const toggleChecked = (deckId: string) => {
    setCheckedIds((current) =>
      current.includes(deckId)
        ? current.filter((id) => id !== deckId)
        : [...current, deckId],
    )
  }

  const exitBulkMode = () => {
    setBulkMode(false)
    setCheckedIds([])
  }

  const handleDeleteChecked = () => {
    if (validCheckedIds.length === 0) return
    if (!onDeleteDecks(validCheckedIds)) return
    setNotice(`已刪除 ${validCheckedIds.length} 副牌組。`)
    exitBulkMode()
  }

  const handleExport = () => {
    if (!selectedDeck) return
    const json = exportDeck(selectedDeck)
    if (!navigator.clipboard?.writeText) {
      setNotice('此瀏覽器不支援剪貼簿，請在牌組編輯器中匯出 JSON。')
      return
    }
    void navigator.clipboard.writeText(json).then(
      () => setNotice(`已複製「${selectedDeck.name}」的牌組 JSON。`),
      () => setNotice('複製失敗，請改用牌組編輯器匯出 JSON。'),
    )
  }

  const handleImport = () => {
    const result = importDeck(importText)
    if (result.error || !result.deck) {
      setNotice(result.error ?? '無法解析牌組資料。')
      return
    }
    setShowImportPanel(false)
    setImportText('')
    onImportDeck(result.deck)
  }

  const handleTileKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    deckId: string,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (bulkMode) toggleChecked(deckId)
    else onSelectDeck(deckId)
  }

  return (
    <main className="my-decks-page" data-testid="my-decks-page">
      <header className="my-decks-header">
        <button
          type="button"
          className="my-decks-back"
          aria-label="返回主選單"
          onClick={onBack}
          data-testid="my-decks-back"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1 className="my-decks-title">我的牌組</h1>
        <div className="my-decks-count" aria-label={`共 ${decks.length} 副牌組`}>
          {decks.length}
          <small>副牌組</small>
        </div>
        <button
          type="button"
          className={`my-decks-top-button${bulkMode ? ' is-active' : ''}`}
          aria-label={bulkMode ? '離開批次刪除' : '批次刪除'}
          title={bulkMode ? '離開批次刪除' : '批次刪除'}
          onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
          data-testid="my-decks-bulk-toggle"
        >
          {bulkMode ? <X aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        </button>
      </header>

      <section className="my-decks-grid" aria-label="自訂牌組清單">
        {!bulkMode && (
          <button
            type="button"
            className="my-decks-add"
            onClick={onCreateDeck}
            data-testid="my-decks-create"
          >
            <span aria-hidden="true">
              <Plus />
            </span>
            <strong>新增牌組</strong>
          </button>
        )}

        {decks.map((deck) => {
          const validation = validations.get(deck.id)
          const isChecked = validCheckedIds.includes(deck.id)
          const isSelected = !bulkMode && deck.id === selectedDeckId
          return (
            <article
              key={deck.id}
              className={`my-decks-tile${isSelected ? ' is-selected' : ''}${
                isChecked ? ' is-checked' : ''
              }`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${deck.name}，${
                validation?.isValid ? '合法' : '需調整'
              }`}
              onClick={() =>
                bulkMode ? toggleChecked(deck.id) : onSelectDeck(deck.id)
              }
              onKeyDown={(event) => handleTileKeyDown(event, deck.id)}
              data-testid={`my-decks-tile-${deck.id}`}
            >
              <div className="my-decks-face">
                <img src={getDeckHero(deck)} alt={`${deck.name} 代表卡`} loading="lazy" />
                {isSelected && <span className="my-decks-current">目前牌組</span>}
                <span
                  className={`my-decks-status ${
                    validation?.isValid ? 'is-valid' : 'is-invalid'
                  }`}
                >
                  {validation?.isValid ? '合法' : '需調整'}
                </span>
                {isBs8CandidateStagingDeck(deck) && (
                  <span className="my-decks-candidate">BS8 候選</span>
                )}
              </div>
              <div className="my-decks-name">
                {deck.name}
                <span className="my-decks-sub">
                  {validation?.stats.totalCards ?? 0} / 60 張 ·{' '}
                  {getDeckFormatLabel(deck.format ?? 'standard')}
                </span>
              </div>

              {!bulkMode && (
                <div className="my-decks-ops">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEditDeck(deck)
                    }}
                    aria-label={`編輯 ${deck.name}`}
                  >
                    <Pencil aria-hidden="true" />
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDuplicateDeck(deck)
                      setNotice(`已複製「${deck.name}」。`)
                    }}
                    aria-label={`複製 ${deck.name}`}
                  >
                    <Copy aria-hidden="true" />
                    複製
                  </button>
                </div>
              )}

              {bulkMode && (
                <div className="my-decks-check" aria-hidden="true">
                  <span>{isChecked && <Check />}</span>
                </div>
              )}
            </article>
          )
        })}

        {decks.length === 0 && (
          <div className="my-decks-empty">
            尚未有自訂牌組。
            <br />
            使用「新增牌組」建立第一副，或從下方匯入／載入官方起始牌組。
          </div>
        )}
      </section>

      {notice && (
        <div className="my-decks-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="關閉提示"
            onClick={() => setNotice(null)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <footer className="my-decks-footer-actions">
        {bulkMode ? (
          <>
            <button type="button" className="my-decks-action" onClick={exitBulkMode}>
              取消
            </button>
            <button
              type="button"
              className="my-decks-action is-danger"
              disabled={validCheckedIds.length === 0}
              onClick={handleDeleteChecked}
              data-testid="my-decks-delete-selected"
            >
              刪除所選
              {validCheckedIds.length > 0 && ` (${validCheckedIds.length})`}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="my-decks-action"
              disabled={!selectedDeck}
              onClick={handleExport}
              data-testid="my-decks-export"
            >
              <Download aria-hidden="true" />
              匯出牌組
            </button>
            <button
              type="button"
              className="my-decks-action"
              onClick={() => setShowImportPanel(true)}
              data-testid="my-decks-import"
            >
              <Upload aria-hidden="true" />
              匯入牌組
            </button>
            <button
              type="button"
              className="my-decks-action"
              onClick={() => setShowStarterPanel(true)}
              data-testid="my-decks-starter"
            >
              <Plus aria-hidden="true" />
              官方起始牌組
            </button>
          </>
        )}
      </footer>

      <p className="my-decks-disclaimer">
        本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權。
      </p>

      {showImportPanel && (
        <div
          className="my-decks-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowImportPanel(false)
          }}
        >
          <section
            className="my-decks-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-decks-import-title"
          >
            <div className="my-decks-modal-heading">
              <div>
                <span>DECK MANAGEMENT</span>
                <h2 id="my-decks-import-title">匯入牌組</h2>
              </div>
              <button
                type="button"
                aria-label="關閉匯入視窗"
                onClick={() => setShowImportPanel(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>貼上由牌組編輯器匯出的 JSON。確認後會開啟編輯器，儲存後才會加入我的牌組。</p>
            <textarea
              rows={9}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder='{"name":"我的牌組","entries":[{"cardNumber":"BS5-001","count":4}]}'
              aria-label="牌組 JSON"
              autoFocus
            />
            <div className="my-decks-modal-actions">
              <button type="button" onClick={() => setShowImportPanel(false)}>
                取消
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                確認匯入
              </button>
            </div>
          </section>
        </div>
      )}

      {showStarterPanel && (
        <div
          className="my-decks-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowStarterPanel(false)
          }}
        >
          <section
            className="my-decks-modal my-decks-starter-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-decks-starter-title"
          >
            <div className="my-decks-modal-heading">
              <div>
                <span>STARTER DECKS</span>
                <h2 id="my-decks-starter-title">官方起始牌組</h2>
              </div>
              <button
                type="button"
                aria-label="關閉官方起始牌組"
                onClick={() => setShowStarterPanel(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>選擇官方起始牌組後會開啟牌組編輯器；儲存後才會建立自訂牌組。</p>
            <div className="my-decks-starter-list">
              {starterDeckOptions.map(({ choice, label }) => (
                <button
                  type="button"
                  key={choice}
                  onClick={() => {
                    setShowStarterPanel(false)
                    onCreateStarterDeck(choice)
                  }}
                >
                  <strong>{label}</strong>
                  <span>{starterDeckGuide[choice]}</span>
                  <span>{OFFICIAL_DECK_RECIPES[choice].length} 種卡片配方</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {selectedDeck && (
        <span className="my-decks-updated-sr-only">
          目前牌組最後更新於 {formatUpdatedAt(selectedDeck.updatedAt)}
        </span>
      )}
    </main>
  )
}
