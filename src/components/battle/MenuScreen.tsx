import { lazy, Suspense, useMemo, useState } from 'react'
import { MainMenuMasterDuel } from '../MainMenuMasterDuel'
import { MyDecksPage } from '../MyDecksPage'
import { type AiDeckChoice } from '../MainMenu'
const DeckEditorPage = lazy(async () => {
  const module = await import('../DeckEditorPage')
  return { default: module.DeckEditorPage }
})
import {
  createCustomDeckId,
  deleteCustomDeck,
  duplicateCustomDeck,
  loadCustomDecks,
  saveCustomDecks,
  validateCustomDeckDefinition,
  type CustomDeck,
} from '../../game/custom-deck'
import { parseTestStateConfig } from '../../game/demo'
import {
  isBs8CandidateStagingDeck,
  validateBs8CandidateStagingDeck,
  type AiLevel,
} from '../../game'
import {
  OFFICIAL_DECK_RECIPES,
  type StarterDeckChoice,
} from '../../game/starter-deck'
import type { useMatchController } from '../../hooks/useMatchController'
import type { usePendingEffect } from '../../hooks/usePendingEffect'
import type { useAiTurn } from '../../hooks/useAiTurn'
import type { useMatchDialogs } from '../../hooks/useMatchDialogs'

const TestScenarioModal = lazy(async () => {
  const module = await import('../modals/TestScenarioModal')
  return { default: module.TestScenarioModal }
})

const OnlineMatchPanel = lazy(async () => {
  const module = await import('./OnlineMatchPanel')
  return { default: module.OnlineMatchPanel }
})

function ModalLoadingFallback() {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-loading-fallback" role="status" aria-live="polite">
        載入畫面中…
      </div>
    </div>
  )
}

function PageLoadingFallback() {
  return <div className="deck-editor-page-loading" role="status">載入牌組編輯器中…</div>
}

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

type DeckEditorReturnView = 'main-menu' | 'my-decks'

const starterDeckLabels: Record<StarterDeckChoice, string> = {
  red: '紅色',
  yellow: '黃色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
}

export interface MenuScreenProps {
  aiLevel: AiLevel
  onSelectAiLevel: (level: AiLevel) => void
  dialogs: ReturnType<typeof useMatchDialogs>
  pending: ReturnType<typeof usePendingEffect>
  ai: ReturnType<typeof useAiTurn>
  match: ReturnType<typeof useMatchController>
  setSelectedHandCardId: (id: string | null) => void
  onEnterBattle: () => void
}

export function MenuScreen({
  aiLevel,
  onSelectAiLevel,
  dialogs,
  pending,
  ai,
  match,
  setSelectedHandCardId,
  onEnterBattle,
}: MenuScreenProps) {
  const [savedDecks, setSavedDecks] = useState<CustomDeck[]>(() =>
    testStateConfig ? [] : loadCustomDecks(),
  )
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() =>
    savedDecks[0]?.id ?? null,
  )
  const [editingDeck, setEditingDeck] = useState<CustomDeck | null>(null)
  const [showDeckEditor, setShowDeckEditor] = useState(false)
  const [deckEditorMode, setDeckEditorMode] = useState<'standard' | 'bs8-candidate-staging'>('standard')
  const [showMyDecks, setShowMyDecks] = useState(false)
  const [deckEditorReturnView, setDeckEditorReturnView] =
    useState<DeckEditorReturnView>('main-menu')
  const [showTestScenario, setShowTestScenario] = useState(false)
  const [showOnlineMatch, setShowOnlineMatch] = useState(false)
  const [battleEntryError, setBattleEntryError] = useState<string | null>(null)
  const [aiDeckChoice, setAiDeckChoice] = useState<AiDeckChoice>('bs9-red-truth')

  const selectedCustomDeck = useMemo(
    () => savedDecks.find((deck) => deck.id === selectedDeckId) ?? null,
    [savedDecks, selectedDeckId],
  )
  const selectedDeckValidation = useMemo(
    () =>
      selectedCustomDeck
        ? isBs8CandidateStagingDeck(selectedCustomDeck)
          ? validateBs8CandidateStagingDeck(selectedCustomDeck)
          : validateCustomDeckDefinition(selectedCustomDeck)
        : null,
    [selectedCustomDeck],
  )

  const refreshSavedDecks = () => {
    const decks = loadCustomDecks()
    setSavedDecks(decks)
    setSelectedDeckId((current) =>
      current && decks.some((deck) => deck.id === current)
        ? current
        : decks[0]?.id ?? null,
    )
  }

  const openDeckEditor = (
    deck: CustomDeck | null,
    returnView: DeckEditorReturnView,
  ) => {
    setEditingDeck(deck)
    setDeckEditorMode(
      deck && isBs8CandidateStagingDeck(deck)
        ? 'bs8-candidate-staging'
        : 'standard',
    )
    setDeckEditorReturnView(returnView)
    setShowMyDecks(false)
    setShowDeckEditor(true)
  }

  const handleDeckEditorSave = (deck: CustomDeck) => {
    const returnView = deckEditorReturnView
    refreshSavedDecks()
    setSelectedDeckId(deck.id)
    setEditingDeck(null)
    setShowDeckEditor(false)
    setShowMyDecks(returnView === 'my-decks')
    setDeckEditorReturnView('main-menu')
    setBattleEntryError(null)
  }

  const handleDeckEditorClose = () => {
    const returnView = deckEditorReturnView
    setShowDeckEditor(false)
    setEditingDeck(null)
    setDeckEditorReturnView('main-menu')
    setShowMyDecks(returnView === 'my-decks')
    refreshSavedDecks()
  }

  const openStarterDeck = (choice: StarterDeckChoice) => {
    const now = new Date().toISOString()
    const starterDeck: CustomDeck = {
      id: createCustomDeckId(),
      name: `${starterDeckLabels[choice]} Starter`,
      entries: OFFICIAL_DECK_RECIPES[choice].map(({ cardNumber, count }) => ({
        cardNumber,
        count,
      })),
      format: 'standard',
      createdAt: now,
      updatedAt: now,
    }
    openDeckEditor(starterDeck, 'my-decks')
  }

  const deleteDecks = (deckIds: string[]): boolean => {
    const targets = savedDecks.filter((deck) => deckIds.includes(deck.id))
    if (targets.length === 0) return false
    const targetNames = targets.map((deck) => `「${deck.name}」`).join('、')
    if (!window.confirm(`確定要刪除 ${targetNames} 嗎？此動作無法復原。`)) {
      return false
    }

    const nextDecks = loadCustomDecks().filter((deck) => !deckIds.includes(deck.id))
    saveCustomDecks(nextDecks)
    setSavedDecks(nextDecks)
    setSelectedDeckId((current) =>
      current && nextDecks.some((deck) => deck.id === current)
        ? current
        : nextDecks[0]?.id ?? null,
    )
    setBattleEntryError(null)
    return true
  }

  const startBattleFromMenu = () => {
    if (!selectedCustomDeck || !selectedDeckValidation) {
      setBattleEntryError('尚未選擇合法牌組，無法進入對戰。')
      return
    }
    if (!selectedDeckValidation.isValid) {
      setBattleEntryError('目前牌組不合法，請先修正後再開始對戰。')
      return
    }

    setSelectedHandCardId(null)
    dialogs.closeResourcePopover()
    pending.resetEffectContext()
    ai.resetAiCounts()
    match.handleDeckSelection(
      'custom',
      selectedCustomDeck,
      aiDeckChoice === 'random' ? undefined : aiDeckChoice,
    )
    setBattleEntryError(null)
    onEnterBattle()
  }

  const startTestScenario = (scenarioState: Parameters<typeof match.loadScenarioState>[0]) => {
    setSelectedHandCardId(null)
    dialogs.closeResourcePopover()
    pending.resetEffectContext()
    ai.resetAiCounts()
    match.loadScenarioState(scenarioState, '測試對局已載入，可直接發動技能或攻擊。')
    setShowTestScenario(false)
    setBattleEntryError(null)
    onEnterBattle()
  }

  return (
    <>
      {!showOnlineMatch && !showDeckEditor && !showMyDecks && (
        <MainMenuMasterDuel
          decks={savedDecks}
          selectedDeckId={selectedDeckId}
          selectedValidation={selectedDeckValidation}
          battleError={battleEntryError}
          aiDeckChoice={aiDeckChoice}
          aiLevel={aiLevel}
          onSelectAiDeck={setAiDeckChoice}
          onSelectAiLevel={onSelectAiLevel}
          onSelectDeck={(deckId) => {
            setSelectedDeckId(deckId)
            setBattleEntryError(null)
          }}
          onStartBattle={startBattleFromMenu}
          onOpenOnlineMatch={() => setShowOnlineMatch(true)}
          onOpenTestScenario={() => setShowTestScenario(true)}
          onOpenMyDecks={() => {
            refreshSavedDecks()
            setBattleEntryError(null)
            setShowMyDecks(true)
          }}
          onEditDeck={(deck) => {
            openDeckEditor(deck, 'main-menu')
          }}
          onDuplicateDeck={(deck) => {
            const { decks, newDeck } = duplicateCustomDeck(deck.id)
            setSavedDecks(decks)
            if (newDeck) {
              setSelectedDeckId(newDeck.id)
            }
          }}
          onDeleteDeck={(deck) => {
            if (
              !window.confirm(
                `確定要刪除牌組「${deck.name}」嗎？此動作無法復原。`,
              )
            ) {
              return
            }
            const decks = deleteCustomDeck(deck.id)
            setSavedDecks(decks)
            setSelectedDeckId((current) =>
              current === deck.id ? decks[0]?.id ?? null : current,
            )
            setBattleEntryError(null)
          }}
          onRefreshDecks={refreshSavedDecks}
        />
      )}
      {!showOnlineMatch && !showDeckEditor && showMyDecks && (
        <MyDecksPage
          decks={savedDecks}
          selectedDeckId={selectedDeckId}
          onSelectDeck={(deckId) => {
            setSelectedDeckId(deckId)
            setBattleEntryError(null)
          }}
          onBack={() => {
            setShowMyDecks(false)
            setBattleEntryError(null)
          }}
          onCreateDeck={() => openDeckEditor(null, 'my-decks')}
          onCreateStarterDeck={openStarterDeck}
          onImportDeck={(deck) => openDeckEditor(deck, 'my-decks')}
          onEditDeck={(deck) => openDeckEditor(deck, 'my-decks')}
          onDuplicateDeck={(deck) => {
            const { decks, newDeck } = duplicateCustomDeck(deck.id)
            setSavedDecks(decks)
            if (newDeck) {
              setSelectedDeckId(newDeck.id)
            }
          }}
          onDeleteDecks={deleteDecks}
        />
      )}
      {showDeckEditor && (
        <Suspense fallback={<PageLoadingFallback />}>
          <DeckEditorPage
            initialDeck={editingDeck ?? undefined}
            mode={deckEditorMode}
            onSave={handleDeckEditorSave}
            onClose={handleDeckEditorClose}
          />
        </Suspense>
      )}
      {showTestScenario && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <TestScenarioModal
            onClose={() => setShowTestScenario(false)}
            onStart={startTestScenario}
          />
        </Suspense>
      )}
      {showOnlineMatch && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <OnlineMatchPanel
            decks={savedDecks}
            onClose={() => setShowOnlineMatch(false)}
          />
        </Suspense>
      )}
    </>
  )
}
