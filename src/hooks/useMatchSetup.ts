import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { deckChoiceLabel } from '../components/gameUiLabels'
import {
  applyGameCommand,
  chooseRandomDeck,
  createDemoSetupGame,
  type DeckChoice,
  type GameState,
  type PlayerId,
} from '../game'
import type { CustomDeck } from '../game/custom-deck'

export const formatDeckSelectionMessage = (
  playerDeck: DeckChoice,
  aiDeck: Exclude<DeckChoice, 'custom'>,
  customDeckName?: string,
  aiDeckWasChosen = false,
) => {
  const playerLabel =
    playerDeck === 'custom' && customDeckName
      ? `自訂「${customDeckName}」`
      : deckChoiceLabel[playerDeck]
  const aiPhrase = aiDeckWasChosen
    ? `AI 使用指定的${deckChoiceLabel[aiDeck]}牌組`
    : `AI 隨機選擇${deckChoiceLabel[aiDeck]}牌組`
  return `我方使用${playerLabel}牌組，${aiPhrase}。請猜拳決定先後攻選擇權。`
}

export type MatchSetupStep =
  | 'deck-selection'
  | 'rps'
  | 'choose-order'
  | 'mulligan'
  | 'starting-cookie'
  | null

interface UseMatchSetupParams {
  game: GameState
  setGame: Dispatch<SetStateAction<GameState>>
  setMessage: Dispatch<SetStateAction<string>>
  enabled: boolean
  chooseDeck?: () => Exclude<DeckChoice, 'custom'>
}

export function useMatchSetup({
  game,
  setGame,
  setMessage,
  enabled,
  chooseDeck = chooseRandomDeck,
}: UseMatchSetupParams) {
  const [setupStep, setSetupStep] = useState<MatchSetupStep>(
    enabled ? 'deck-selection' : null,
  )
  const [setupMessage, setSetupMessage] = useState(
    '請選擇本次對戰使用的牌組。',
  )
  const [deckConfig, setDeckConfig] = useState<{
    player: DeckChoice
    ai: Exclude<DeckChoice, 'custom'>
  }>({
    player: 'red',
    ai: 'red',
  })
  const [selectedCustomDeck, setSelectedCustomDeck] =
    useState<CustomDeck | null>(null)

  const processAiOpeningHand = useCallback(
    (initialState: GameState): GameState => {
      let nextState = initialState
      const aiId: PlayerId = 'player-two'
      const playerId: PlayerId = 'player-one'

      if (!nextState.players[aiId].hand.some((card) => card.type === 'cookie')) {
        nextState = applyGameCommand(nextState, {
          kind: 'mulligan-opening-hand',
          playerId: aiId,
        })
      } else {
        nextState = applyGameCommand(nextState, {
          kind: 'keep-opening-hand',
          playerId: aiId,
        })
      }

      let guard = 0
      while (
        !nextState.players[aiId].hand.some((card) => card.type === 'cookie') &&
        guard < 100
      ) {
        nextState = applyGameCommand(nextState, {
          kind: 'force-mulligan-opening-hand',
          playerId: aiId,
        })
        nextState = applyGameCommand(nextState, {
          kind: 'draw-mulligan-compensation',
          playerId,
        })
        guard += 1
      }

      return nextState
    },
    [],
  )

  const handleDeckSelection = useCallback(
    (
      playerDeck: DeckChoice,
      customDeck?: CustomDeck,
      aiDeckChoice?: Exclude<DeckChoice, 'custom'>,
    ) => {
      const aiDeck = aiDeckChoice ?? chooseDeck()
      setDeckConfig({ player: playerDeck, ai: aiDeck })
      setSelectedCustomDeck(customDeck ?? null)
      setSetupStep('rps')
      setSetupMessage(
        formatDeckSelectionMessage(
          playerDeck,
          aiDeck,
          customDeck?.name,
          aiDeckChoice !== undefined,
        ),
      )
    },
    [chooseDeck],
  )

  const beginOrderedSetup = useCallback(
    (firstPlayerId: PlayerId) => {
      let nextGame = createDemoSetupGame(
        firstPlayerId,
        deckConfig,
        undefined,
        deckConfig.player === 'custom' ? selectedCustomDeck ?? undefined : undefined,
      )
      if (firstPlayerId === 'player-two') {
        nextGame = processAiOpeningHand(nextGame)
      }
      setGame(nextGame)
      setSetupStep('mulligan')
      setSetupMessage(
        firstPlayerId === 'player-one'
          ? '你是先攻玩家，請先決定是否更換全部手牌。'
          : 'AI 已完成調度，現在輪到你決定是否更換全部手牌。',
      )
    },
    [deckConfig, processAiOpeningHand, selectedCustomDeck, setGame],
  )

  const handleRps = useCallback(
    (choice: 'rock' | 'paper' | 'scissors') => {
      const choices = ['rock', 'paper', 'scissors'] as const
      const aiChoice = choices[Math.floor(Math.random() * choices.length)]
      if (choice === aiChoice) {
        setSetupMessage('本次猜拳平手，請再選一次。')
        return
      }

      const playerWins =
        (choice === 'rock' && aiChoice === 'scissors') ||
        (choice === 'paper' && aiChoice === 'rock') ||
        (choice === 'scissors' && aiChoice === 'paper')

      if (playerWins) {
        setSetupStep('choose-order')
        setSetupMessage('你猜拳獲勝，可以選擇先攻或後攻。')
        return
      }

      setSetupMessage('AI 猜拳獲勝並選擇先攻。')
      beginOrderedSetup('player-two')
    },
    [beginOrderedSetup],
  )

  const handlePlayerMulligan = useCallback(
    (replaceAll: boolean) => {
      let nextGame = applyGameCommand(game, {
        kind: replaceAll ? 'mulligan-opening-hand' : 'keep-opening-hand',
        playerId: 'player-one',
      })
      let forcedCount = 0

      while (
        !nextGame.players['player-one'].hand.some(
          (card) => card.type === 'cookie',
        ) &&
        forcedCount < 100
      ) {
        nextGame = applyGameCommand(nextGame, {
          kind: 'force-mulligan-opening-hand',
          playerId: 'player-one',
        })
        nextGame = applyGameCommand(nextGame, {
          kind: 'draw-mulligan-compensation',
          playerId: 'player-two',
        })
        forcedCount += 1
      }

      if (nextGame.firstPlayerId === 'player-one') {
        nextGame = processAiOpeningHand(nextGame)
      }

      setGame(nextGame)
      setSetupStep('starting-cookie')
      setSetupMessage(
        forcedCount > 0
          ? `已完成 ${forcedCount} 次強制調度；AI 每次均接受補償抽牌。請選擇起始餅乾。`
          : '雙方調度完成，請選擇一張餅乾作為起始餅乾。',
      )
    },
    [game, processAiOpeningHand, setGame],
  )

  const handleStartingCookie = useCallback(
    (instanceId: string) => {
      let nextGame = applyGameCommand(game, {
        kind: 'select-starting-cookie',
        playerId: 'player-one',
        instanceId,
      })
      const aiCookie = nextGame.players['player-two'].hand.find(
        (card) => card.type === 'cookie',
      )
      if (!aiCookie) {
        setSetupMessage('AI 沒有可放置的起始餅乾。')
        return
      }
      nextGame = applyGameCommand(nextGame, {
        kind: 'select-starting-cookie',
        playerId: 'player-two',
        instanceId: aiCookie.instanceId,
      })
      setGame(nextGame)
      setSetupStep(null)
      setMessage(
        `${nextGame.players[nextGame.firstPlayerId].name}先攻，正式進入第一回合。`,
      )
    },
    [game, setGame, setMessage],
  )

  const resetSetup = useCallback(() => {
    setSetupStep('deck-selection')
    setSetupMessage('請選擇本次對戰使用的牌組。')
    setSelectedCustomDeck(null)
  }, [])

  return {
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    setDeckConfig,
    selectedCustomDeck,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    resetSetup,
  } as const
}
