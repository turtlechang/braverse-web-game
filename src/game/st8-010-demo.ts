import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

const original = getCardPoolEntry('ST8-010') ?? (document.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST8-010')
if (!original) throw new Error('Missing original ST8-010')
export const raw = original
export const st8010Scenarios = ['positive', 'rested-item', 'blue-item', 'no-hand', 'no-item', 'cookie-cost', 'trap-cost', 'stage-cost',
  'source-rested', 'only-source', 'last-deck', 'top-cookie', 'top-item', 'top-trap', 'top-stage', 'top-blue',
  'own-attack-faint', 'effect-faint', 'repeat-faint', 'attack', 'attack-source-rested', 'attack-negative', 'wrong-color', 'wrong-phase', 'first-turn', 'play'] as const

export const createSt8010PreviewState = (scenario: string, prepareOnly = false): GameState => {
  if (!st8010Scenarios.some(value => value === scenario)) throw new Error(`Unknown ST8-010 scenario ${scenario}`)
  const copies = new Map<string, number>(), records = getAllCardPoolEntries()
  const card = (number: string, owner: PlayerId): GameCard => {
    const record = number === 'ST8-010' ? raw : getCardPoolEntry(number)
    if (!record) throw new Error(`Missing original ${number}`)
    const key = `${owner}:${number}`, copy = (copies.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit ${key}`)
    copies.set(key, copy)
    return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (!count) return result
    for (const record of records) {
      if (record.variant || record.type === 'extra' || hasFlipAbility(record) || (copies.get(`${owner}:${record.baseCardNumber}`) ?? 0) >= 4) continue
      result.push(card(record.baseCardNumber, owner))
      if (result.length === count) return result
    }
    throw new Error('Insufficient physical resources')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected physical Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame({ id: 'player-one', name: 'ST8-010草稿', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') }, 'player-one', cards => cards)
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.breakArea = []; player.discardPile = []
    player.battleArea = []; player.stage = null; player.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  const attacking = scenario.startsWith('attack') || ['wrong-color', 'wrong-phase', 'first-turn', 'play'].includes(scenario)
  self.battleArea = [battle('ST8-010', 'player-one')]
  if (scenario !== 'only-source') self.battleArea.push(battle('ST1-011', 'player-one'))
  foe.battleArea = [battle(attacking ? 'ST1-005' : 'ST6-003', 'player-two'), battle('ST1-011', 'player-two')]
  self.hand = scenario === 'no-hand' ? [] : [card('ST1-001', 'player-one'), card('ST1-016', 'player-one')]
  if (attacking) {
    self.supportArea = [{ card: card(scenario === 'wrong-color' ? 'ST1-020' : 'ST3-020', 'player-one'), rested: scenario === 'attack-negative' }]
    if (scenario === 'attack-source-rested') self.battleArea[0].rested = true
    if (scenario === 'wrong-phase') state.phase = 'support'
    if (scenario === 'first-turn') state.turnNumber = 1
  } else {
    const paymentNumber = ({ 'blue-item': 'ST9-016', 'cookie-cost': 'ST1-011', 'trap-cost': 'ST1-020', 'stage-cost': 'BS1-026' } as Record<string, string>)[scenario] ?? 'ST1-016'
    if (scenario !== 'no-item') self.supportArea.push({ card: card(paymentNumber, 'player-one'), rested: scenario === 'rested-item' })
    // A second real Item permits exact-count/duplicate-ID negative payment cases.
    if (scenario === 'positive') self.supportArea.push({ card: card('ST3-016', 'player-one'), rested: false })
    if (scenario === 'source-rested') self.battleArea[0].rested = true
    const topNumber = ({ 'top-item': 'ST1-016', 'top-trap': 'ST1-020', 'top-stage': 'BS1-026', 'top-blue': 'ST9-016' } as Record<string, string>)[scenario] ?? 'ST1-001'
    self.deck.push(card(topNumber, 'player-one'))
    foe.supportArea = ['ST1-018', 'ST2-020', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
    state.activePlayerId = 'player-two'
  }
  if (scenario === 'own-attack-faint') {
    foe.deck.push(...foe.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]))
    foe.battleArea = [battle('ST1-005', 'player-two')]
    const displaced = foe.battleArea[0].hpCards.pop()
    if (!displaced) throw new Error('Actual Leek HP required')
    foe.deck.push(displaced)
    foe.battleArea[0].hpCards.push(card('BS1-002', 'player-two'))
    foe.hand.push(card('ST1-001', 'player-two'))
    self.supportArea.push({ card: card('ST3-016', 'player-one'), rested: false })
  }
  if (scenario === 'effect-faint') {
    foe.hand.push(card('ST7-013', 'player-two'))
    foe.discardPile.push(card('ST2-001', 'player-two'))
    foe.deck.push(...foe.supportArea.map(support => support.card))
    foe.supportArea = ['ST2-020', 'ST2-020'].map(number => ({ card: card(number, 'player-two'), rested: false }))
  }
  if (scenario === 'repeat-faint') {
    self.deck.push(...self.battleArea.splice(1).flatMap(cookie => [cookie.card, ...cookie.hpCards]))
    self.battleArea.push(battle('ST8-010', 'player-one'))
    foe.deck.push(...foe.battleArea.splice(1).flatMap(cookie => [cookie.card, ...cookie.hpCards]))
    foe.battleArea.push(battle('ST6-003', 'player-two'))
    foe.supportArea.push(...['ST1-018', 'ST2-020', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false })))
    self.supportArea.push({ card: card('ST3-016', 'player-one'), rested: false })
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.discardPile.length + player.supportArea.length + player.battleArea.reduce((sum, cookie) => sum + 1 + cookie.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (scenario === 'last-deck') self.discardPile.push(...self.deck.splice(1))
  if (scenario === 'play') {
    const source = self.battleArea.shift()!
    self.hand.unshift(source.card); self.deck.push(...source.hpCards)
  }
  if (prepareOnly || attacking) return state
  const sourceId = self.battleArea[0].card.instanceId
  if (scenario === 'effect-faint') {
    const item = foe.hand.find(value => value.id === 'ST7-013'), cost = foe.discardPile.find(value => value.id === 'ST2-001')
    if (!item || !cost) throw new Error('Actual YY Item and yellow trash Cookie required')
    state = applyGameCommand(state, { kind: 'begin-play-item', playerId: 'player-two', instanceId: item.instanceId,
      paymentIds: foe.supportArea.map(support => support.card.instanceId), trashCookieToBreakAreaIds: [cost.instanceId] })
    return applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [sourceId] })
  }
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: foe.battleArea[0].card.instanceId,
    targetInstanceId: self.battleArea[0].card.instanceId, supportPaymentIds: scenario === 'own-attack-faint' ? [foe.supportArea[0].card.instanceId] : foe.supportArea.slice(0, 3).map(support => support.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  // Actual NNN3 consumes this printed HP2 and must stop at real faint before the remaining damage/replacement.
  state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
  if (scenario === 'own-attack-faint') {
    for (let count = 0; count < 10 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); count++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    if (state.activePlayerId !== 'player-one' || state.phase !== 'main') throw new Error('Prior ordinary one must reach own Main')
    const payment = state.players['player-one'].supportArea.find(support => support.card.id === 'ST3-016')
    if (!payment) throw new Error('Real green Item required')
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: foe.battleArea[0].card.instanceId, supportPaymentIds: [payment.card.instanceId] })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    const discard = state.players['player-two'].hand[0]
    if (!discard) throw new Error('Real arbitrary Kumiho hand payment required')
    return applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true,
      discardHandIds: [discard.instanceId], targetIds: [sourceId] })
  }
  if (scenario === 'repeat-faint') {
    const firstItem = state.players['player-one'].supportArea[0].card
    state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], supportToHandIds: [firstItem.instanceId] })
    state = applyGameCommand(state, { kind: 'resolve-choose-one', playerId: 'player-one', modeIndex: 0 })
    state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    const replacement = state.players['player-one'].hand.find(value => value.id === 'ST1-001')
    if (!replacement) throw new Error('Real first-faint replacement required')
    state = applyGameCommand(state, { kind: 'replace-cookie', playerId: 'player-one', instanceId: replacement.instanceId })
    if (state.pendingBattle) state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    const secondSource = state.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST8-010')
    if (!secondSource) throw new Error('Actual second Cookiemals required')
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: foe.battleArea[1].card.instanceId,
      targetInstanceId: secondSource.card.instanceId, supportPaymentIds: state.players['player-two'].supportArea.filter(support => !support.rested).map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    return applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
  }
  return state
}
