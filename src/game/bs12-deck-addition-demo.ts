import {fixture as createSt7019PreviewState} from './st7-019-demo'
import {fixture as createSt7018PreviewState} from './st7-018-demo'
import {fixture as createSt7017PreviewState} from './st7-017-demo'
import {fixture as createSt7016PreviewState} from './st7-016-demo'
import {fixture as createSt7015PreviewState} from './st7-015-demo'
import {fixture as createSt7014PreviewState} from './st7-014-demo'
import {fixture as createSt7010PreviewState} from './st7-010-demo'
import {createSt7008PreviewState} from './st7-008-demo'
import {createSt7013PreviewState} from './st7-013-demo'
import {createSt7011PreviewState} from './st7-011-demo'
import {createSt7012PreviewState} from './st7-012-demo'
import {createSt7006PreviewState} from './st7-006-demo'
import {createSt7007PreviewState} from './st7-007-demo'
import {createSt7009PreviewState} from './st7-009-demo'
import {createSt7004PreviewState} from './st7-004-demo'
import {createSt7003PreviewState} from './st7-003-demo'
import {createSt7002PreviewState} from './st7-002-demo'
import {createSt7001PreviewState} from './st7-001-demo'
import {createSt6020PreviewState} from './st6-020-demo'
import {createSt6019PreviewState} from './st6-019-demo'
import {createSt6018PreviewState} from './st6-018-demo'
import {createSt6017PreviewState} from './st6-017-demo'
import {createSt6016PreviewState} from './st6-016-demo'
import { createSt6015PreviewState } from './st6-015-demo'
import { createSt6014PreviewState } from './st6-014-demo'
import { createSt6013PreviewState } from './st6-013-demo'
import { createSt6012PreviewState } from './st6-012-demo'
import { createSt6011PreviewState } from './st6-011-demo'
import document from '../../data/cards/official-bs12-deck-additions.en.json'
import { COOKIERIFT_ADDITION_NUMBERS, createCookieriftAdditionState } from './cookierift-addition-demo'
import { createSt6001State } from './st6-001-demo'
import { createSt6002State } from './st6-002-demo'
import { createSt6003State } from './st6-003-demo'
import { createSt6004State } from './st6-004-demo'
import { createSt6005State } from './st6-005-demo'
import { createSt6006PreviewState } from './st6-006-demo'
import { createSt6007PreviewState } from './st6-007-demo'
import { createSt6008PreviewState } from './st6-008-demo'
import { createSt6009PreviewState } from './st6-009-demo'
import { createSt6010PreviewState } from './st6-010-demo'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { applyGameCommand } from './commands'
import type { OfficialCardRecord } from '../cards/types'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export const DECK_ADDITION_CARD_NUMBERS = document.cards.map((card) => card.cardNumber)
export type DeckAdditionScenario = 'no-cost' | 'break-loss' | 'false' | 'rested-witness' | 'defender-one' | 'hand-witness' | 'trash-witness' | 'break-witness' | 'support-witness' | 'opponent-witness' | 'other' | 'one-red' | 'main' | 'faint' | 'both-faint' | 'no-discard' | 'positive' | 'negative' | 'low' | 'attack' | 'attack-negative' | 'zero' | 'wrong-color' | 'wrong-phase' | 'used' | 'target-faints' | 'no-energy' | 'rested-source' | 'no-extra-energy' | 'attack-wrong-color' | 'last-no-hand' | 'green-arena' | 'non-arena' | 'one-card' | 'cost-cookie' | 'cost-item' | 'already-target' | 'no-battle' | 'second-attack' | 'reveal' | 'no-target' | 'rested-target'

/** Local acceptance only. Every zone contains original printed cards, at most four copies. */
export const createDeckAdditionDemoState = (
  number: string, scenario: DeckAdditionScenario = 'positive',
): GameState => {
  if (number === 'ST6-001') return createSt6001State(scenario)
  if (number === 'ST6-002') return createSt6002State(scenario)
  if (number === 'ST6-003') return createSt6003State(scenario)
  if (number === 'ST6-004') return createSt6004State(scenario)
  if (number === 'ST6-005') return createSt6005State(scenario)
  if (number === 'ST6-006') return createSt6006PreviewState(scenario)
  if (number === 'ST6-007') return createSt6007PreviewState(scenario)
  if (number === 'ST6-008') return createSt6008PreviewState(scenario)
  if (number === 'ST6-009') return createSt6009PreviewState(scenario)
  if (number === 'ST6-010') return createSt6010PreviewState(scenario)
  if (number === 'ST6-011') return createSt6011PreviewState(scenario)
  if (number === 'ST6-012') return createSt6012PreviewState(scenario)
  if (number === 'ST6-013') return createSt6013PreviewState(scenario)
  if (number === 'ST6-014') return createSt6014PreviewState(scenario)
  if(number === 'ST7-006')return createSt7006PreviewState(scenario)
  if(number === 'ST7-007')return createSt7007PreviewState(scenario)
  if(number === 'ST7-011')return createSt7011PreviewState(scenario)
  if(number === 'ST7-012')return createSt7012PreviewState(scenario)
  if(number === 'ST7-019')return createSt7019PreviewState(scenario)
  if(number === 'ST7-018')return createSt7018PreviewState(scenario)
  if(number === 'ST7-017')return createSt7017PreviewState(scenario)
  if(number === 'ST7-016')return createSt7016PreviewState(scenario)
  if(number === 'ST7-015')return createSt7015PreviewState(scenario)
  if(number === 'ST7-014')return createSt7014PreviewState(scenario)
  if(number === 'ST7-010')return createSt7010PreviewState(scenario)
  if(number === 'ST7-008')return createSt7008PreviewState(scenario)
  if(number === 'ST7-013')return createSt7013PreviewState(scenario)
  if(number === 'ST7-009')return createSt7009PreviewState(scenario)
  if(number === 'ST7-004')return createSt7004PreviewState(scenario)
  if(number === 'ST7-003')return createSt7003PreviewState(scenario)
  if(number === 'ST7-002')return createSt7002PreviewState(scenario)
  if(number === 'ST7-001')return createSt7001PreviewState(scenario)
  if(number === 'ST6-020')return createSt6020PreviewState(scenario)
  if(number === 'ST6-019')return createSt6019PreviewState(scenario)
  if(number === 'ST6-018')return createSt6018PreviewState(scenario)
  if(number === 'ST6-017')return createSt6017PreviewState(scenario)
  if(number === 'ST6-016')return createSt6016PreviewState(scenario)
  if (number === 'ST6-015') return createSt6015PreviewState(scenario)
  if (COOKIERIFT_ADDITION_NUMBERS.includes(number)) return createCookieriftAdditionState(number, scenario)
  if (!DECK_ADDITION_CARD_NUMBERS.includes(number)) throw new Error(`Unknown deck addition ${number}`)
  let sequence = 0
  const counts: Record<string, number> = {}
  const card = (n: string, player: PlayerId = 'player-one'): GameCard => {
    const key = `${player}:${n}`
    counts[key] = (counts[key] ?? 0) + 1
    if (counts[key] > 4) throw new Error(`Too many physical copies: ${key}`)
    const raw = (document.cards as OfficialCardRecord[]).find((c) => c.cardNumber === n) ?? getCardPoolEntry(n)
    if (!raw) throw new Error(`Missing physical reference ${n}`)
    return { ...createCard(raw, player, counts[key]), instanceId: `${player}-${n}-${++sequence}` }
  }
  const fillerNumbers = getAllCardPoolEntries().filter((entry) =>
    entry.type !== 'extra' && !hasFlipAbility(entry) && !DECK_ADDITION_CARD_NUMBERS.includes(entry.cardNumber),
  ).map((entry) => entry.baseCardNumber)
  const filler = (count: number, player: PlayerId = 'player-one'): GameCard[] => {
    if (count === 0) return []
    const result: GameCard[] = []
    for (const n of new Set(fillerNumbers)) {
      if ((counts[`${player}:${n}`] ?? 0) >= 4) continue
      result.push(card(n, player))
      if (result.length === count) return result
    }
    throw new Error('Not enough physical filler cards')
  }
  const cookie = (n: string, player: PlayerId = 'player-one'): CookieCard => {
    const c = card(n, player)
    if (c.type !== 'cookie') throw new Error(`${n} is not a Cookie`)
    return c
  }
  const battle = (c: CookieCard, player: PlayerId = 'player-one'): CookieInBattle => ({
    card: c, hpCards: filler(c.hp, player), rested: false, enteredTurn: 0,
    battleEntryId: `addition-entry-${++sequence}`,
  })
  let state = createGame(
    { id: 'player-one', name: '卡牌驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one', (cards) => cards,
  )
  const source = card(number)
  const main = state.players['player-one']
  const foe = state.players['player-two']
  main.hand = [source]
  main.deck = []; main.discardPile = []; main.breakArea = []; main.supportArea = []
  main.battleArea = []; main.stage = null; main.startingCookieSelected = true
  foe.hand = []; foe.deck = []; foe.discardPile = []; foe.breakArea = []; foe.supportArea = []
  foe.stage = null; foe.startingCookieSelected = true
  foe.battleArea = [battle(cookie('BS12-059', 'player-two'), 'player-two'), battle(cookie('BS7-062', 'player-two'), 'player-two')]
  const isAttack = scenario.startsWith('attack')
  const negative = scenario === 'negative' || scenario === 'attack-negative'
  const low = scenario === 'low'
  const color = source.energyColor
  const supportNumbers = color === 'blue' ? ['ST4-013', 'ST4-014', 'ST4-015', 'ST4-016', 'ST4-019']
    : color === 'green' ? ['ST3-014', 'ST3-015', 'ST3-016', 'ST3-019', 'ST3-020']
      : color === 'yellow' ? ['ST2-014', 'ST2-015', 'ST2-016', 'ST2-018', 'ST2-020']
        : color === 'red' ? ['ST1-014', 'ST1-015', 'ST1-016', 'ST1-019', 'ST1-020']
          : ['ST5-014', 'ST5-015', 'ST5-016', 'ST5-019', 'ST5-020']
  main.supportArea = supportNumbers.slice(0, number === 'ST8-018' && low ? 4 : 5).map((n, i) => ({
    card: card(n), rested: negative && !isAttack && (source.type === 'trap' || i < 4),
  }))
  if (source.type === 'cookie' && (isAttack || number === 'P-175' || number === 'ST10-007')) {
    main.hand = []
    main.battleArea = [battle(source)]
  } else main.battleArea = [battle(cookie('BS7-062'))]
  if (number === 'ST9-016') main.hand.push(...filler(negative ? 2 : 3))
  if (number === 'ST10-013' || number === 'ST10-002' || number === 'ST10-008') {
    const material = battle(cookie(negative ? 'BS7-062' : 'ST5-005'))
    if (isAttack || number === 'ST10-013') main.battleArea.push(material)
    else main.discardPile = [material.card, ...material.hpCards]
    if (number === 'ST10-008' && !isAttack) main.discardPile.push(...filler((negative || low ? 14 : 15) - main.discardPile.length))
  }
  if (number === 'P-176') main.breakArea = Array.from({ length: negative || low ? 3 : 4 }, () => cookie('BS12-024'))
  if (number === 'ST10-002' && !isAttack) main.battleArea = []
  if (number === 'ST10-019') main.discardPile = filler(negative || low ? 18 : 19)
  state = { ...state, status: 'playing', phase: 'main', turnNumber: 2, players: { 'player-one': main, 'player-two': foe } }
  for (const player of ['player-one', 'player-two'] as const) {
    const p = state.players[player]
    const used = p.hand.length + p.discardPile.length + p.breakArea.length + p.supportArea.length +
      p.battleArea.reduce((sum, entry) => sum + 1 + entry.hpCards.length, 0)
    p.deck = filler(60 - used, player)
  }
  if (number === 'P-175') {
    if (!negative && !isAttack) {
      const enabler = cookie('BS12-016')
      state.players['player-one'].hand = [enabler]
      state.players['player-one'].deck = state.players['player-one'].deck.slice(1)
      state.players['player-one'].battleArea[0].rested = true
      state = applyGameCommand(state, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: enabler.instanceId })
      state = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: enabler.instanceId,
        trigger: enabler.skill?.trigger === 'on-play' ? 'on-play' : 'activate', paymentIds: [], effectTargets: [[source.instanceId], []] })
    } else if (isAttack) {
      const companion = battle(cookie('BS12-002'))
      companion.rested = !negative
      state.players['player-one'].battleArea.push(companion)
      state.players['player-one'].deck = state.players['player-one'].deck.slice(companion.hpCards.length + 1)
    }
  }
  if (source.type === 'cookie' && !isAttack && number !== 'P-175' && number !== 'ST10-007') {
    state = applyGameCommand(state, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
  }
  if (source.type === 'trap' || number === 'ST10-007') {
    if (number === 'ST10-007') {
      const bearer = battle(cookie('BS12-078'))
      bearer.hpCards[bearer.hpCards.length - 1] = source
      state.players['player-one'].battleArea = [bearer]
      state.players['player-one'].hand = negative ? [] : filler(1)
      state.players['player-one'].deck = state.players['player-one'].deck.slice(bearer.hpCards.length)
    }
    state = { ...state, activePlayerId: 'player-two' }
    const support = ['ST1-014', 'ST1-015', 'ST1-016'].map((n) => ({ card: card(n, 'player-two'), rested: false }))
    state.players['player-two'].supportArea = support
    state.players['player-two'].deck = state.players['player-two'].deck.slice(3)
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      supportPaymentIds: support.map((entry) => entry.card.instanceId) })
    if (number === 'ST10-007') {
      state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
  }
  return state
}
