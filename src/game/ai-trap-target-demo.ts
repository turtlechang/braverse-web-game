import {
  applyGameCommand, createCard, createGame, createOfficialRedStarterDeck,
  getAllCardPoolEntries, getCardPoolEntry,
} from './index'
import { hasFlipAbility } from './card-pool'
import { createAiFlipSequencePreview } from './ai-flip-sequence-demo'
import { createAiStageChildSequencePreview } from './ai-stage-child-sequence-demo'
import type { CookieInBattle, GameCard, PlayerId } from './types'

/** Original-card local fixture using an actual attack declaration before AI defense. */
export type AiTrapTargetScenario = 'saving' | 'nonlethal' | 'no-energy' | 'nested-flip' | 'stage-child'
export const createAiTrapTargetPreview = (scenario: AiTrapTargetScenario = 'saving') => {
  if (scenario === 'nested-flip') return createAiFlipSequencePreview()
  if (scenario === 'stage-child') return createAiStageChildSequencePreview()
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const key = `${owner}:${number}`, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit: ${key}`)
    counts.set(key, copy)
    const raw = getCardPoolEntry(number)
    if (!raw) throw new Error(`Missing printing ${number}`)
    return createCard(raw, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    if (count === 0) return []
    const cards: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) ||
          (counts.get(`${owner}:${raw.baseCardNumber}`) ?? 0) >= 4) continue
      cards.push(card(raw.baseCardNumber, owner))
      if (cards.length === count) return cards
    }
    throw new Error('Insufficient original fillers')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false,
      battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame(
    { id: 'player-one', name: '實體攻擊者', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'AI防守驗證', deck: createOfficialRedStarterDeck('player-two') },
    'player-one', cards => cards,
  )
  state.phase = 'main'; state.status = 'playing'; state.turnNumber = 5
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null; player.extraDeck = []
    player.startingCookieSelected = true
  }
  const attacker = state.players['player-one'], defender = state.players['player-two']
  attacker.battleArea = [battle(scenario === 'nonlethal' ? 'BS12-042' : 'ST3-011', 'player-one'), battle('BS12-059', 'player-one')]
  attacker.battleArea[1].rested = true
  attacker.supportArea = ['ST3-016', 'ST3-019'].map(number => ({ card: card(number, 'player-one'), rested: false }))
  defender.battleArea = [battle('ST3-005', 'player-two')]
  if (scenario === 'no-energy') defender.battleArea.push(battle('ST3-011', 'player-two'))
  defender.hand = [card('ST3-019', 'player-two')]
  defender.supportArea = ['ST3-016', 'ST3-019'].map(number => ({ card: card(number, 'player-two'), rested: scenario === 'no-energy' }))
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.hand.length + player.supportArea.length +
      player.battleArea.reduce((total, source) => total + 1 + source.hpCards.length, 0)
    player.deck = filler(60 - used, owner)
  }
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
    attackerInstanceId: attacker.battleArea[0].card.instanceId,
    targetInstanceId: defender.battleArea[0].card.instanceId,
    supportPaymentIds: attacker.supportArea.slice(0, scenario === 'nonlethal' ? 1 : 2).map(s => s.card.instanceId) })
  return state
}
