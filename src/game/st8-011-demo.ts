import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { applyGameCommand } from './commands'
import { selectEnergyPayment } from './energy'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'
const original = getCardPoolEntry('ST8-011') ?? (document.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST8-011')
if (!original) throw new Error('Missing original ST8-011')
export const raw = original
export const st8011Scenarios = ['positive', 'rested-source', 'no-hand', 'damage-two', 'damage-three', 'second-attack', 'second-response',
  'two-kiwis', 'wrong-color', 'rested-energy', 'no-energy', 'already-target', 'wrong-zone-hand', 'wrong-zone-support',
  'wrong-zone-break', 'wrong-zone-trash', 'only-source-faint', 'last-deck', 'play', 'attack-green', 'attack-red', 'attack-yellow',
  'attack-blue', 'attack-purple', 'attack-black', 'attack-insufficient', 'attack-wrong-color', 'attack-rested-source', 'attack-rested-energy',
  'attack-wrong-phase', 'attack-first-turn'] as const
export const createSt8011PreviewState = (scenario = 'positive', prepareOnly = false): GameState => {
  if (!st8011Scenarios.some(value => value === scenario)) throw new Error(`Unknown ST8-011 scenario ${scenario}`)
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const record = number === 'ST8-011' ? raw : getCardPoolEntry(number)
    if (!record) throw new Error(`Missing original ${number}`)
    const key = `${owner}:${number}`, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Original four-copy limit ${key}`)
    counts.set(key, copy); return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    if (!count) return []
    const result: GameCard[] = []
    for (const record of getAllCardPoolEntries()) {
      if (record.variant || record.type === 'extra' || hasFlipAbility(record) || (counts.get(`${owner}:${record.baseCardNumber}`) ?? 0) >= 4) continue
      result.push(card(record.baseCardNumber, owner))
      if (result.length === count) return result
    }
    throw new Error('Insufficient original resources')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Original Cookie required')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame({ id: 'player-one', name: 'ST8-011逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '原卡對手', deck: createOfficialRedStarterDeck('player-two') }, 'player-one', cards => cards)
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.battleArea = []; player.breakArea = []; player.discardPile = []
    player.extraDeck = []; player.stage = null; player.startingCookieSelected = true
  }
  const own = state.players['player-one'], foe = state.players['player-two'], attacking = scenario.startsWith('attack-') || scenario === 'play'
  own.battleArea = [battle('ST8-011', 'player-one')]
  if (!['only-source-faint', 'last-deck'].includes(scenario)) own.battleArea.push(battle(scenario === 'two-kiwis' ? 'ST8-011' : 'ST1-011', 'player-one'))
  own.hand = scenario === 'no-hand' ? [] : [card('ST1-011', 'player-one')]
  own.supportArea = ['ST3-016', 'ST3-019', 'ST3-020'].map(number => ({ card: card(number, 'player-one'), rested: false }))
  const damage3 = ['damage-three', 'only-source-faint', 'last-deck'].includes(scenario)
  foe.battleArea = [battle(attacking ? 'ST6-006' : damage3 ? 'ST6-003' : scenario === 'damage-two' ? 'ST8-007' : 'ST1-011', 'player-two')]
  if (!attacking) {
    state.activePlayerId = 'player-two'
    if (['second-attack', 'second-response', 'two-kiwis'].includes(scenario)) foe.battleArea.push(battle('ST1-011', 'player-two'))
    foe.supportArea = ['ST3-016', 'ST3-019', 'ST3-020'].map(number => ({ card: card(number, 'player-two'), rested: false }))
  }
  const neutral: Record<string, string> = { 'attack-red': 'ST1-020', 'attack-yellow': 'ST2-020', 'attack-blue': 'ST4-020', 'attack-purple': 'ST5-020', 'attack-black': 'BS11-092' }
  if (neutral[scenario]) {
    own.deck.push(own.supportArea[1].card)
    own.supportArea[1] = { card: card(neutral[scenario], 'player-one'), rested: false }
  }
  if (['wrong-color', 'attack-wrong-color'].includes(scenario)) {
    own.deck.push(...own.supportArea.map(s => s.card))
    own.supportArea = ['ST1-018', 'ST1-019', 'ST1-020'].map(number => ({ card: card(number, 'player-one'), rested: false }))
  }
  if (['rested-energy', 'attack-rested-energy'].includes(scenario)) own.supportArea.forEach(s => { s.rested = true })
  if (scenario === 'attack-insufficient') own.deck.push(...own.supportArea.splice(1).map(s => s.card))
  if (['rested-source', 'attack-rested-source'].includes(scenario)) own.battleArea[0].rested = true
  if (scenario === 'no-energy') own.deck.push(...own.supportArea.splice(0).map(s => s.card))
  if (scenario.startsWith('wrong-zone-')) {
    const source = own.battleArea.shift()
    if (!source) throw new Error('Actual Kiwi required')
    own.deck.push(...source.hpCards)
    if (scenario === 'wrong-zone-hand') own.hand.push(source.card)
    if (scenario === 'wrong-zone-support') own.supportArea.push({ card: source.card, rested: false })
    if (scenario === 'wrong-zone-break') own.breakArea.push(source.card)
    if (scenario === 'wrong-zone-trash') own.discardPile.push(source.card)
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.breakArea.length + player.discardPile.length + player.supportArea.length + player.battleArea.reduce((sum, c) => sum + 1 + c.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (scenario === 'attack-wrong-phase') state.phase = 'support'
  if (scenario === 'attack-first-turn') state.turnNumber = 1
  if (scenario === 'play') {
    const source = own.battleArea.shift()
    if (!source) throw new Error('Original Kiwi required')
    own.hand.unshift(source.card); own.deck.push(...source.hpCards)
  }
  if (scenario === 'last-deck') own.discardPile.push(...own.deck.splice(1))
  if (prepareOnly || attacking) return state
  const attacker = foe.battleArea[0].card
  if (attacker.type !== 'cookie') throw new Error('Actual attacker required')
  const payment = selectEnergyPayment(attacker.attackEnergyCost ?? { neutral: attacker.attackCost }, foe.supportArea)
  if (!payment) throw new Error('Original opposing attack cannot pay')
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId,
    targetInstanceId: own.battleArea[scenario === 'already-target' || own.battleArea.length === 1 ? 0 : 1].card.instanceId, supportPaymentIds: payment })
  if (scenario === 'second-response') {
    state = applyGameCommand(state, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: own.battleArea[0].card.instanceId, paymentIds: [own.supportArea[0].card.instanceId] })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    const energy = state.players['player-two'].supportArea.find(s => !s.rested)
    if (!energy) throw new Error('Actual second attack payment required')
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: foe.battleArea[1].card.instanceId,
      targetInstanceId: own.battleArea[1].card.instanceId, supportPaymentIds: [energy.card.instanceId] })
  }
  return state
}
