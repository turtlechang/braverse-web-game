import { useMemo, useState } from 'react'
import { MainMenu, type AiDeckChoice } from '../MainMenu'
import { DeckEditorModal } from '../modals/DeckEditorModal'
import { TestScenarioModal } from '../modals/TestScenarioModal'
import {
  deleteCustomDeck,
  duplicateCustomDeck,
  loadCustomDecks,
  validateCustomDeck,
  type CustomDeck,
} from '../../game/custom-deck'
import { parseTestStateConfig } from '../../game/demo'
import type { AiLevel } from '../../game'
import type { useMatchController } from '../../hooks/useMatchController'
import type { usePendingEffect } from '../../hooks/usePendingEffect'
import type { useAiTurn } from '../../hooks/useAiTurn'
import type { useMatchDialogs } from '../../hooks/useMatchDialogs'

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

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
  const [showTestScenario, setShowTestScenario] = useState(false)
  const [battleEntryError, setBattleEntryError] = useState<string | null>(null)
  const [aiDeckChoice, setAiDeckChoice] = useState<AiDeckChoice>('random')

  const selectedCustomDeck = useMemo(
    () => savedDecks.find((deck) => deck.id === selectedDeckId) ?? null,
    [savedDecks, selectedDeckId],
  )
  const selectedDeckValidation = useMemo(
    () =>
      selectedCustomDeck
        ? validateCustomDeck(selectedCustomDeck.entries)
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

  const handleDeckEditorSave = (deck: CustomDeck) => {
    refreshSavedDecks()
    setSelectedDeckId(deck.id)
    setEditingDeck(null)
    setShowDeckEditor(false)
    setBattleEntryError(null)
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
      <MainMenu
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
        onOpenTestScenario={() => setShowTestScenario(true)}
        onCreateDeck={() => {
          setEditingDeck(null)
          setShowDeckEditor(true)
        }}
        onEditDeck={(deck) => {
          setEditingDeck(deck)
          setShowDeckEditor(true)
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
      {showDeckEditor && (
        <DeckEditorModal
          initialDeck={editingDeck ?? undefined}
          onSave={handleDeckEditorSave}
          onClose={() => {
            setShowDeckEditor(false)
            setEditingDeck(null)
            refreshSavedDecks()
          }}
        />
      )}
      {showTestScenario && (
        <TestScenarioModal
          onClose={() => setShowTestScenario(false)}
          onStart={startTestScenario}
        />
      )}
    </>
  )
}
