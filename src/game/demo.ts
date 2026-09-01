import { createSeededShuffle, defaultShuffle } from './helpers'
import { getFaintTriggeredCost, hasCookieOnPlayEffects } from './skills'
import { beginAttack } from './battle'
import { applyGameCommand } from './commands'
import {
  createGame,
  forceMulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import {
  createCard,
  createOfficialBlueStarterDeck,
  createOfficialGreenStarterDeck,
  createOfficialPurpleStarterDeck,
  createOfficialYellowStarterDeck,
  type BuiltInDeckChoice,
  DECK_CREATORS,
  type DeckChoice,
} from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import pFormalDocument from '../../data/cards/official-p-0xx-remaining.en.json'
import bs6FormalDocument from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import bs7CandidateDocument from '../../data/cards/official-arena-of-glory-bs7.en.json'
import bs8FormalDocument from '../../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import type {
  CustomDeck,
} from './custom-deck'
import { createDeckFromCustomDeck } from './custom-deck'
import {
  createBs8CandidateStagingPlayerSetup,
  isBs8CandidateStagingDeck,
} from './bs8-candidate-staging'
import type {
  CardEffect,
  CookieCard,
  EnergyColor,
  ExtraDeckCard,
  GameCard,
  GameState,
  PendingBattle,
  PendingFaintEffect,
  PlayerId,
  PlayerState,
  TurnPhase,
} from './types'

export const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

export const BS4_CONDITION_CARD_NUMBERS = [
  'BS4-011',
  'BS4-012',
  'BS4-014',
  'BS4-016',
  'BS4-020',
  'BS4-023',
  'BS4-024',
  'BS4-039',
  'BS4-040',
  'BS4-048',
  'BS4-049',
  'BS4-052',
  'BS4-053',
  'BS4-059',
  'BS4-061',
  'BS4-073',
  'BS4-083',
  'BS4-089',
  'BS4-090',
  'BS4-094',
  'BS4-106',
  'BS4-107',
] as const

export type Bs4ConditionCardNumber =
  (typeof BS4_CONDITION_CARD_NUMBERS)[number]

const isBs4ConditionCardNumber = (
  value: string,
): value is Bs4ConditionCardNumber =>
  (BS4_CONDITION_CARD_NUMBERS as readonly string[]).includes(value)

/** P-0XX cards whose Browser verification needs an explicit condition fixture. */
export const P_CONDITION_CARD_NUMBERS = [
  'P-041',
  'P-058',
  'P-059',
  'P-064',
  'P-065',
  'P-067',
  'P-071',
  'P-074',
  'P-075',
  'P-093',
  'P-094',
  'P-095',
  'P-098',
  'P-103',
  'P-103@1',
  'P-106',
  'P-109',
  'P-110',
  'P-119',
  'P-121',
  'P-128',
  'P-131',
  'P-134',
  'P-137',
  'P-142',
  'P-145',
] as const

export type PConditionCardNumber =
  (typeof P_CONDITION_CARD_NUMBERS)[number]

const isPConditionCardNumber = (
  value: string,
): value is PConditionCardNumber =>
  (P_CONDITION_CARD_NUMBERS as readonly string[]).includes(value)

export const BS5_FLIP_CARD_NUMBERS = [
  'BS5-004',
  'BS5-009',
  'BS5-038',
  'BS5-046',
  'BS5-041',
  'BS5-049',
  'BS5-082',
  'BS5-090',
  'BS5-095',
] as const
export type Bs5FlipCardNumber = (typeof BS5_FLIP_CARD_NUMBERS)[number]

export const BS5_FAINT_CARD_NUMBERS = [
  'BS5-007',
  'BS5-011',
  'BS5-026',
  'BS5-047',
  'BS5-072',
  'BS5-107',
] as const
export type Bs5FaintCardNumber = (typeof BS5_FAINT_CARD_NUMBERS)[number]

export const BS5_TRAP_CARD_NUMBERS = [
  'BS5-021',
  'BS5-043',
  'BS5-065',
  'BS5-087',
  'BS5-109',
] as const
export type Bs5TrapCardNumber = (typeof BS5_TRAP_CARD_NUMBERS)[number]

export const BS5_ITEM_CONDITION_CARD_NUMBERS = ['BS5-020'] as const
export type Bs5ItemConditionCardNumber =
  (typeof BS5_ITEM_CONDITION_CARD_NUMBERS)[number]

export const BS5_STAGE_CONDITION_CARD_NUMBERS = ['BS5-022'] as const
export type Bs5StageConditionCardNumber =
  (typeof BS5_STAGE_CONDITION_CARD_NUMBERS)[number]

/**
 * BS6 尚在候選資料期；這些 localhost-only A/B 情境不會將候選資料加入正式牌池。
 */
export const BS6_CONDITION_CARD_NUMBERS = ['BS6-012', 'BS6-039'] as const
export type Bs6ConditionCardNumber =
  (typeof BS6_CONDITION_CARD_NUMBERS)[number]

const isListedCardNumber = <T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] => (values as readonly string[]).includes(value)

export const parseTestStateConfig = (
  searchString: string,
  hostname: string,
):
  | { kind: 'break-to-trash'; level: 1 | 2 }
  | { kind: 'trap-response'; payable: boolean }
  | { kind: 'blocker-response'; payable: boolean }
  | { kind: 'trap-and-blocker-response'; payable: boolean }
  | { kind: 'flip-response' }
  | { kind: 'replacement-choice' }
  | { kind: 'st5-010-on-play' }
  | { kind: 'ai-discard-reveal' }
  | { kind: 'item-usage'; payable: boolean }
  | { kind: 'stage-usage'; payable: boolean }
  | { kind: 'faint-damage' }
  | { kind: 'trap-pretzel'; attack: 4 | 5 }
  | { kind: 'opponent-discard-hand' }
  | { kind: 'attack-effect' }
  | { kind: 'bs8-extra-deck'; conditionMet: boolean }
  | { kind: 'bs8-011-double-skill' }
  | { kind: 'bs8-076-active-prevention' }
  | { kind: 'bs8-084-attack-discard'; payable: boolean }
  | { kind: 'support-to-trash-skill' }
  | { kind: 'blue-activate-skill'; payable: boolean }
  | { kind: 'blue-optional-cost-attack'; payable: boolean }
  | { kind: 'blue-inspect-deck' }
  | { kind: 'blue-st4-016' }
  | { kind: 'blue-st4-017' }
  | { kind: 'blue-st4-018' }
  | { kind: 'blue-st4-019' }
  | { kind: 'blue-st4-020'; payable: boolean }
  | {
      kind: 'card-check'
      cardNumber: string
      /** 只供 strict Browser 驗收，把含 Then 的卡導向其技能表面。 */
      preferSkillSurface?: boolean
    }
  | {
      kind: 'card-negative'
      cardNumber: string
      /** 只供 strict Browser 驗收，B 路徑也固定停在技能表面。 */
      preferSkillSurface?: boolean
    }
  | { kind: 'bs6-010-movement'; blocked: boolean }
  | { kind: 'bs6-079-on-play'; blocked: boolean }
  | { kind: 'bs4-026-on-play'; blocked: boolean }
  | { kind: 'bs6-031-attack-after'; payable: boolean }
  | { kind: 'bs6-008-trap'; remainingHp: 4 | 5 }
  | { kind: 'bs4-077-timekeeper-cost' }
  | { kind: 'bs5-060-end-phase'; supportState: 'rested' | 'active' }
  | {
      kind: 'p-condition'
      cardNumber: PConditionCardNumber
      conditionMet: boolean
    }
  | { kind: 'p082-trap'; payment: 'energy' | 'cookie' }
  | { kind: 'p084-item-condition'; conditionMet: boolean }
  | { kind: 'p147-special-play' }
  | { kind: 'bs2-015-cost'; replacementAvailable: boolean }
  | { kind: 'bs3-061-condition'; conditionMet: boolean }
  | {
      kind: 'bs4-condition'
      cardNumber: Bs4ConditionCardNumber
      conditionMet: boolean
    }
  | { kind: 'bs4-024-target-restriction' }
  | { kind: 'bs5-flip'; cardNumber: Bs5FlipCardNumber; activate: boolean }
  | {
      kind: 'bs5-faint'
      cardNumber: Bs5FaintCardNumber
      conditionMet: boolean
    }
  | {
      kind: 'bs5-trap'
      cardNumber: Bs5TrapCardNumber
      conditionMet: boolean
    }
  | {
      kind: 'bs5-item-condition'
      cardNumber: Bs5ItemConditionCardNumber
      conditionMet: boolean
    }
  | {
      kind: 'bs5-stage-condition'
      cardNumber: Bs5StageConditionCardNumber
      conditionMet: boolean
    }
  | {
      kind: 'bs6-condition'
      cardNumber: Bs6ConditionCardNumber
      conditionMet: boolean
    }
  | { kind: 'bs5-item-111'; conditionMet: boolean }
  | { kind: 'bs3-121-special-victory' }
  | { kind: 'soul-jam-019-equipped' }
  | { kind: 'soul-jam-043-equipped' }
  | { kind: 'soul-jam-066-equipped' }
  | { kind: 'soul-jam-091-equipped' }
  | { kind: 'soul-jam-115-equipped' }
  | { kind: 'soul-jam-115-protection-demo' }
  | null => {
  if (!isLocalhost(hostname)) return null
  const params = new URLSearchParams(searchString)
  const testState = params.get('test-state')
  if (testState === 'break-to-trash-lv1') {
    return { kind: 'break-to-trash', level: 1 }
  }
  if (testState === 'break-to-trash-lv2') {
    return { kind: 'break-to-trash', level: 2 }
  }
  if (testState === 'trap-payable') {
    return { kind: 'trap-response', payable: true }
  }
  if (testState === 'trap-unpayable') {
    return { kind: 'trap-response', payable: false }
  }
  if (testState === 'blocker-payable') {
    return { kind: 'blocker-response', payable: true }
  }
  if (testState === 'blocker-unpayable') {
    return { kind: 'blocker-response', payable: false }
  }
  if (testState === 'trap-and-blocker-payable') {
    return { kind: 'trap-and-blocker-response', payable: true }
  }
  if (testState === 'trap-and-blocker-unpayable') {
    return { kind: 'trap-and-blocker-response', payable: false }
  }
  if (testState === 'flip-response') {
    return { kind: 'flip-response' }
  }
  if (testState === 'replacement-choice') {
    return { kind: 'replacement-choice' }
  }
  if (testState === 'st5-010-on-play') {
    return { kind: 'st5-010-on-play' }
  }
  if (testState === 'ai-discard-reveal') {
    return { kind: 'ai-discard-reveal' }
  }
  if (testState === 'item-payable') {
    return { kind: 'item-usage', payable: true }
  }
  if (testState === 'item-unpayable') {
    return { kind: 'item-usage', payable: false }
  }
  if (testState === 'stage-payable') {
    return { kind: 'stage-usage', payable: true }
  }
  if (testState === 'stage-unpayable') {
    return { kind: 'stage-usage', payable: false }
  }
  if (testState === 'faint-damage') {
    return { kind: 'faint-damage' }
  }
  if (testState === 'trap-pretzel-payable') {
    return { kind: 'trap-pretzel', attack: 5 }
  }
  if (testState === 'trap-pretzel-unpayable') {
    return { kind: 'trap-pretzel', attack: 4 }
  }
  if (testState === 'opponent-discard-hand') {
    return { kind: 'opponent-discard-hand' }
  }
  if (testState === 'attack-effect') {
    return { kind: 'attack-effect' }
  }
  if (testState === 'bs8-extra-deck:met') {
    return { kind: 'bs8-extra-deck', conditionMet: true }
  }
  if (testState === 'bs8-extra-deck:unmet') {
    return { kind: 'bs8-extra-deck', conditionMet: false }
  }
  if (testState === 'bs8-011-double-skill') {
    return { kind: 'bs8-011-double-skill' }
  }
  if (testState === 'bs8-076-active-prevention') {
    return { kind: 'bs8-076-active-prevention' }
  }
  if (testState === 'bs8-084-attack-discard:payable') {
    return { kind: 'bs8-084-attack-discard', payable: true }
  }
  if (testState === 'bs8-084-attack-discard:unpayable') {
    return { kind: 'bs8-084-attack-discard', payable: false }
  }
  if (testState === 'st3-002-skill') {
    return { kind: 'support-to-trash-skill' }
  }
  if (testState === 'blue-activate-payable') {
    return { kind: 'blue-activate-skill', payable: true }
  }
  if (testState === 'blue-activate-unpayable') {
    return { kind: 'blue-activate-skill', payable: false }
  }
  if (testState === 'blue-attack-payable') {
    return { kind: 'blue-optional-cost-attack', payable: true }
  }
  if (testState === 'blue-attack-unpayable') {
    return { kind: 'blue-optional-cost-attack', payable: false }
  }
  if (testState === 'blue-inspect-deck') {
    return { kind: 'blue-inspect-deck' }
  }
  if (
    testState === 'blue-st4-016' ||
    testState === 'blue-st4-017' ||
    testState === 'blue-st4-018' ||
    testState === 'blue-st4-019'
  ) {
    return { kind: testState }
  }
  if (testState === 'blue-st4-020-payable') {
    return { kind: 'blue-st4-020', payable: true }
  }
  if (testState === 'blue-st4-020-unpayable') {
    return { kind: 'blue-st4-020', payable: false }
  }
  if (testState?.startsWith('p-condition:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isPConditionCardNumber(cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'p-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState?.startsWith('card:')) {
    const cardNumber = testState.slice('card:'.length).trim()
    if (cardNumber.length > 0) {
      return { kind: 'card-check', cardNumber }
    }
  }
  if (testState?.startsWith('card-skill:')) {
    const cardNumber = testState.slice('card-skill:'.length).trim()
    if (cardNumber.length > 0) {
      return { kind: 'card-check', cardNumber, preferSkillSurface: true }
    }
  }
  if (testState?.startsWith('card-skill-negative:')) {
    const cardNumber = testState.slice('card-skill-negative:'.length).trim()
    if (cardNumber.length > 0) {
      return { kind: 'card-negative', cardNumber, preferSkillSurface: true }
    }
  }
  if (testState?.startsWith('card-negative:')) {
    const cardNumber = testState.slice('card-negative:'.length).trim()
    if (cardNumber.length > 0) {
      return { kind: 'card-negative', cardNumber }
    }
  }
  if (testState === 'bs6-079-on-play-clear') {
    return { kind: 'bs6-079-on-play', blocked: false }
  }
  if (testState === 'bs6-079-on-play-blocked') {
    return { kind: 'bs6-079-on-play', blocked: true }
  }
  if (testState === 'bs4-026-on-play-clear') {
    return { kind: 'bs4-026-on-play', blocked: false }
  }
  if (testState === 'bs4-026-on-play-blocked') {
    return { kind: 'bs4-026-on-play', blocked: true }
  }
  if (testState === 'bs6-031-attack-after-payable') {
    return { kind: 'bs6-031-attack-after', payable: true }
  }
  if (testState === 'bs6-031-attack-after-unpayable') {
    return { kind: 'bs6-031-attack-after', payable: false }
  }
  if (testState === 'bs6-008-trap-blocked') {
    return { kind: 'bs6-008-trap', remainingHp: 4 }
  }
  if (testState === 'bs6-008-trap-open') {
    return { kind: 'bs6-008-trap', remainingHp: 5 }
  }
  // BS6-010 is a passive movement blocker.  These aliases expose the same
  // real BS6-079 movement command with and without the Timekeeper on the
  // opponent's field, so the card's positive/negative behaviour is testable
  // directly without changing the formal battle rules.
  if (testState === 'bs6-010-open') {
    return { kind: 'bs6-010-movement', blocked: false }
  }
  if (testState === 'bs6-010-blocked') {
    return { kind: 'bs6-010-movement', blocked: true }
  }
  if (testState === 'bs4-077-timekeeper-cost') {
    return { kind: 'bs4-077-timekeeper-cost' }
  }
  if (testState?.startsWith('bs5-060-end-phase:')) {
    const supportState = testState.slice('bs5-060-end-phase:'.length).trim()
    if (supportState === 'rested' || supportState === 'active') {
      return { kind: 'bs5-060-end-phase', supportState }
    }
  }
  if (testState?.startsWith('p082-trap:')) {
    const payment = testState.slice('p082-trap:'.length)
    if (payment === 'energy' || payment === 'cookie') {
      return { kind: 'p082-trap', payment }
    }
  }
  if (testState?.startsWith('p084-item:')) {
    const result = testState.slice('p084-item:'.length)
    if (result === 'met' || result === 'unmet') {
      return { kind: 'p084-item-condition', conditionMet: result === 'met' }
    }
  }
  if (testState === 'p147-special-play') {
    return { kind: 'p147-special-play' }
  }
  if (testState?.startsWith('bs2-015-cost:')) {
    const result = testState.slice('bs2-015-cost:'.length)
    if (result === 'terminal' || result === 'replacement') {
      return {
        kind: 'bs2-015-cost',
        replacementAvailable: result === 'replacement',
      }
    }
  }
  if (testState?.startsWith('bs3-061-condition:')) {
    const result = testState.slice('bs3-061-condition:'.length)
    if (result === 'met' || result === 'unmet') {
      return { kind: 'bs3-061-condition', conditionMet: result === 'met' }
    }
  }
  if (testState?.startsWith('bs4-condition:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isBs4ConditionCardNumber(cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs4-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState === 'bs4-024-target-restriction') {
    return { kind: 'bs4-024-target-restriction' }
  }
  if (testState?.startsWith('bs5-flip:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS5_FLIP_CARD_NUMBERS, cardNumber) &&
      (result === 'activate' || result === 'skip')
    ) {
      return {
        kind: 'bs5-flip',
        cardNumber,
        activate: result === 'activate',
      }
    }
  }
  if (testState?.startsWith('bs5-faint:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS5_FAINT_CARD_NUMBERS, cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs5-faint',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState?.startsWith('bs5-trap:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS5_TRAP_CARD_NUMBERS, cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs5-trap',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState?.startsWith('bs6-condition:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS6_CONDITION_CARD_NUMBERS, cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs6-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  // BS5-111 has its own condition fixture. Keep this exact route before the
  // generic BS5 item-condition parser so it is not swallowed by the broader
  // `bs5-item:` prefix.
  if (testState?.startsWith('bs5-item:BS5-111:')) {
    const result = testState.slice('bs5-item:BS5-111:'.length)
    if (result === 'met' || result === 'unmet') {
      return { kind: 'bs5-item-111', conditionMet: result === 'met' }
    }
  }
  if (testState?.startsWith('bs5-item:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS5_ITEM_CONDITION_CARD_NUMBERS, cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs5-item-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState?.startsWith('bs5-stage:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isListedCardNumber(BS5_STAGE_CONDITION_CARD_NUMBERS, cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs5-stage-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState === 'bs3-121-special-victory') {
    return { kind: 'bs3-121-special-victory' }
  }
  if (testState === 'soul-jam-019-equipped') return { kind: 'soul-jam-019-equipped' }
  if (testState === 'soul-jam-043-equipped') return { kind: 'soul-jam-043-equipped' }
  if (testState === 'soul-jam-066-equipped') return { kind: 'soul-jam-066-equipped' }
  if (testState === 'soul-jam-091-equipped') return { kind: 'soul-jam-091-equipped' }
  if (testState === 'soul-jam-115-equipped') return { kind: 'soul-jam-115-equipped' }
  if (testState === 'soul-jam-115-protection-demo') return { kind: 'soul-jam-115-protection-demo' }
  return null
}

const selectFirstCookie = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
) => {
  const cookie = state.players[playerId].hand.find(
    (card) => card.type === 'cookie',
  )

  if (!cookie) {
    throw new Error(`種子牌序未讓 ${playerId} 抽到起始餅乾。`)
  }

  return selectStartingCookie(state, playerId, cookie.instanceId)
}

const ensureOpeningCookie = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
  shuffle: (cards: GameCard[]) => GameCard[],
) => {
  let nextState = state
  let attempts = 0

  while (
    !nextState.players[playerId].hand.some(
      (card) => card.type === 'cookie',
    ) &&
    attempts < 100
  ) {
    nextState = forceMulliganOpeningHand(nextState, playerId, shuffle)
    attempts += 1
  }

  if (attempts >= 100) {
    throw new Error(`無法替 ${playerId} 取得含餅乾的起始手牌。`)
  }

  return nextState
}

export type DeckConfig =
  | DeckChoice
  | { player: DeckChoice; ai: BuiltInDeckChoice }

export const createDemoSetupGame = (
  firstPlayerId: 'player-one' | 'player-two',
  deck: DeckConfig = 'red',
  seed?: number,
  playerCustomDeck?: CustomDeck,
): GameState => {
  const playerChoice = typeof deck === 'string' ? deck : deck.player
  const aiChoice =
    typeof deck === 'string' ? (deck === 'custom' ? 'red' : deck) : deck.ai
  const builtInPlayerChoice =
    playerChoice === 'custom' ? 'red' : playerChoice
  const shuffle =
    seed === undefined ? defaultShuffle : createSeededShuffle(seed)

  const playerDeck =
    playerChoice === 'custom' && playerCustomDeck
      ? createDeckFromCustomDeck(playerCustomDeck, 'player-one')
      : DECK_CREATORS[builtInPlayerChoice]('player-one')
  const playerSetup =
    playerChoice === 'custom' &&
    playerCustomDeck &&
    isBs8CandidateStagingDeck(playerCustomDeck)
      ? {
          ...createBs8CandidateStagingPlayerSetup(playerCustomDeck, 'player-one'),
          name: '玩家',
        }
      : {
          id: 'player-one' as const,
          name: '玩家',
          deck: playerDeck,
        }

  return createGame(
    playerSetup,
    {
      id: 'player-two',
      name: 'AI 對手',
      deck: DECK_CREATORS[aiChoice]('player-two'),
    },
    firstPlayerId,
    shuffle,
  )
}

export const createDemoGame = (
  seed?: number,
  deck: DeckConfig = 'red',
  playerCustomDeck?: CustomDeck,
): GameState => {
  const effectiveSeed = seed ?? 7
  const shuffle = createSeededShuffle(effectiveSeed)
  let state = createDemoSetupGame(
    'player-one',
    deck,
    effectiveSeed,
    playerCustomDeck,
  )

  state = ensureOpeningCookie(state, 'player-one', shuffle)
  state = ensureOpeningCookie(state, 'player-two', shuffle)
  state = selectFirstCookie(state, 'player-one')
  state = selectFirstCookie(state, 'player-two')

  return state
}

const createTestPlayerState = (): Omit<PlayerState, 'id' | 'name'> => ({
  deck: [],
  hand: [],
  battleArea: [],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
  hasMulliganed: true,
  startingCookieSelected: true,
  freeMulliganDecided: true,
  forcedMulliganCount: 0,
})

export const createBreakToTrashDemoState = (
  breakAreaLevel: 1 | 2 = 1,
): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')

  const eclair = p1Deck.find((c) => c.id === 'ST2-008')!
  const battleCookie = p1Deck.find((c) => c.id === 'ST2-002')!
  const breakCookie =
    breakAreaLevel === 1
      ? p1Deck.find((c) => c.id === 'ST2-009')!
      : p1Deck.find((c) => c.id === 'ST2-004')!
  const support1 = p1Deck.find((c) => c.id === 'ST2-016')!
  const support2 = p1Deck.find(
    (c) => c.id === 'ST2-019' && c.instanceId !== support1.instanceId,
  )!

  const p2Cookie = p2Deck.find((c) => c.id === 'ST2-009')!

  const usedP1 = new Set([
    eclair.instanceId,
    battleCookie.instanceId,
    breakCookie.instanceId,
    support1.instanceId,
    support2.instanceId,
  ])
  const p1HpCard = p1Deck.find((card) => !usedP1.has(card.instanceId))!
  usedP1.add(p1HpCard.instanceId)
  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
    hand: [eclair],
    battleArea: [
      {
        card: battleCookie as CookieCard,
        hpCards: [p1HpCard],
        rested: false,
        battleEntryId: `${battleCookie.instanceId}:battle:1`,
      },
    ],
    supportArea: [
      { card: support1, rested: false },
      { card: support2, rested: false },
    ],
    breakArea: [breakCookie as CookieCard],
  }

  const usedP2 = new Set([p2Cookie.instanceId])
  const p2HpCard = p2Deck.find((card) => !usedP2.has(card.instanceId))!
  usedP2.add(p2HpCard.instanceId)
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
    hand: [p2Cookie],
    battleArea: [
      {
        card: p2Cookie as CookieCard,
        hpCards: [p2HpCard],
        rested: false,
        battleEntryId: `${p2Cookie.instanceId}:battle:2`,
      },
    ],
  }

  return {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createAttackEffectDemoState = (): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const wizard = p1Deck.find((card) => card.id === 'ST2-003') as CookieCard
  const breakCookie = p1Deck.find((card) => card.id === 'ST2-009') as CookieCard
  const defender = p2Deck.find((card) => card.id === 'ST2-009') as CookieCard

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: wizard,
            hpCards: [],
            rested: true,
            battleEntryId: `${wizard.instanceId}:battle:1`,
          },
        ],
        breakArea: [breakCookie],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: defender,
            hpCards: [],
            rested: false,
            battleEntryId: `${defender.instanceId}:battle:2`,
          },
        ],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-one',
      defenderPlayerId: 'player-two',
      attackerInstanceId: wizard.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: wizard.attack,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: wizard.attackEffects ?? [],
      attackEffectIndex: 0,
    },
  }
}

/**
 * 僅供 localhost Browser A/B 使用的 BS8 EXTRA fixture。它不讀候選 JSON、
 * 不加入 generated card pool，也不代表正式牌組可以構築；權威轉接仍在
 * convertOfficialCardToExtraDeckCard 的單元測試中驗證。
 */
export const createBs8ExtraDeckDemoState = (
  conditionMet: boolean,
): GameState => {
  const p1Deck = DECK_CREATORS.red('player-one')
  const p2Deck = DECK_CREATORS.red('player-two')
  // Pick durable, deterministic witnesses so the browser flow can observe
  // both parts of Avatar's Then clause without a faint/replacement modal
  // obscuring the HP changes.  These remain ordinary Standard cards; only
  // Avatar itself is the localhost-only EXTRA candidate fixture.
  const p1Cookie = p1Deck.find((card) => card.id === 'ST1-009') as CookieCard
  const p2Cookie = p2Deck.find((card) => card.id === 'ST1-014') as CookieCard
  if (!p1Cookie || !p2Cookie) {
    throw new Error('BS8-005 fixture requires the Red starter HP witnesses')
  }
  const usedP1 = new Set([p1Cookie.instanceId])
  const usedP2 = new Set([p2Cookie.instanceId])
  const p1HpCards = p1Deck
    .filter((card) => !usedP1.has(card.instanceId))
    .slice(0, 3)
  p1HpCards.forEach((card) => usedP1.add(card.instanceId))
  const p1SupportCards = p1Deck
    .filter(
      (card) =>
        !usedP1.has(card.instanceId) &&
        card.energyColor === 'red',
    )
    .slice(0, 3)
  if (p1SupportCards.length !== 3) {
    throw new Error('BS8-005 fixture requires three active Red supports')
  }
  p1SupportCards.forEach((card) => usedP1.add(card.instanceId))
  const p2HpCards = p2Deck
    .filter((card) => !usedP2.has(card.instanceId))
    .slice(0, 6)
  p2HpCards.forEach((card) => usedP2.add(card.instanceId))
  const avatarSource = (bs8FormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.baseCardNumber === 'BS8-005',
  )
  if (!avatarSource) {
    throw new Error('BS8-005 fixture requires the formal EXTRA card record')
  }
  const avatarConversion = convertOfficialCardToExtraDeckCard(
    avatarSource,
    'demo-avatar',
  )
  if (avatarConversion.status !== 'converted') {
    throw new Error(
      `BS8-005 fixture cannot convert the formal EXTRA card: ${avatarConversion.reason}`,
    )
  }
  const avatar: ExtraDeckCard = {
    ...avatarConversion.extraDeckCard,
    // Keep a stable id for Browser selectors while preserving the official
    // card text, artwork, play requirement, and attack Then effects above.
    instanceId: 'bs8-005-demo-avatar',
    // The demo names the materialized unit explicitly as a Cookie so its
    // battle-area label is unambiguous; its model type remains `extra` here.
    name: 'Avatar of Ruin Cookie',
  }

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        extraDeck: [avatar],
        battleArea: [
          {
            card: p1Cookie,
            hpCards: p1HpCards,
            rested: false,
            battleEntryId: `${p1Cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: p1SupportCards.map((card) => ({ card, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        battleArea: [
          {
            card: p2Cookie,
            hpCards: p2HpCards,
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:2`,
          },
        ],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    extraDeckPlayUsedThisTurn: false,
    cookiesFaintedThisTurn: {
      'player-one': conditionMet ? 2 : 1,
      'player-two': 0,
    },
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

/**
 * 僅供 localhost Browser A/B 的 BS8-076 下一個 Active Phase 情境。它直接
 * 放在規則引擎已建立的「選擇 0 張或恰好 2 張手牌」決策點，讓 Browser 驗證
 * 實際 command 能令目標保持 rested 或恢復 active；不屬於 Standard 牌池／對戰。
 */
export const createBs8076ActivePreventionDemoState = (): GameState => {
  const state = createCardCheckDemoState('BS8-076')
  const player = state.players['player-one']
  const target = player.battleArea.find(
    (entry) => entry.card.instanceId === 'self-extra-1',
  )
  if (!target) throw new Error('BS8-076 active-phase fixture requires its target Cookie')

  const targetCard = {
    ...target.card,
    name: 'BS8-076 Active Phase Target',
  }
  const source = {
    sourcePlayerId: 'player-two' as const,
    sourceInstanceId: 'bs8-076-active-prevention-source',
    sourceCardName: 'Icicle Yeti Cookie',
    effectText:
      'During your opponent\'s next Active Phase, that Cookie is not set as active unless your opponent discards 2 cards from their hand.',
  }

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'active',
    pendingBattle: null,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        hand: [
          testSupportCard('bs8-076-active-discard-1', 'blue'),
          testSupportCard('bs8-076-active-discard-2', 'blue'),
        ],
        battleArea: player.battleArea.map((entry) =>
          entry.card.instanceId === target.card.instanceId
            ? { ...entry, card: targetCard, rested: true }
            : entry,
        ),
      },
    },
    conditionalCookieActivePreventions: {
      'player-one': [
        {
          ...source,
          cookieInstanceId: targetCard.instanceId,
          discardHandToSetActive: 2,
        },
      ],
    },
    pendingOpponentHandDiscard: {
      playerId: 'player-one',
      count: 2,
      optional: true,
      ...source,
      activePhaseCookieInstanceId: targetCard.instanceId,
    },
  }
}

/**
 * BS8-084 的獨立 Browser A/B：攻擊方必須先棄 1 張手牌，才能攻擊休息中的
 * Sherbet Cookie。此情境只供 localhost candidate 驗收使用，不會把 BS8
 * 加入正式卡池或一般牌組。
 */
export const createBs8084AttackRequirementDemoState = (
  payable: boolean,
): GameState => {
  const state = createCardCheckDemoState('BS8-084')
  const sherbet = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS8-084',
  )
  if (!sherbet) {
    throw new Error('BS8-084 attack-discard fixture requires Sherbet Cookie')
  }

  const attacker = cardCheckFillerCookie(
    'player-one-bs8-084-tax-attacker',
    1,
    3,
    0,
    'blue',
  )
  const defender: CookieCard = {
    ...sherbet.card,
    instanceId: 'player-two-BS8-084-tax-defender',
  }
  const defenderHpCards = Array.from(
    { length: defender.hp },
    (_, index) => testSupportCard(`BS8-084-tax-defender-hp-${index + 1}`, 'blue'),
  )

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        // The positive path has exactly one actual card to discard. The
        // negative path has no hand cards, so beginAttack must reject before
        // resting the attacker or starting a pending battle.
        hand: payable
          ? [testSupportCard('BS8-084-required-discard-card', 'blue')]
          : [],
        battleArea: [
          cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 4),
        ],
        supportArea: [],
      },
      'player-two': {
        ...state.players['player-two'],
        hand: [],
        battleArea: [
          cardCheckBattleEntry(defender, defenderHpCards, 1, true),
        ],
        supportArea: [],
      },
    },
    pendingBattle: null,
    pendingOpponentHandDiscard: null,
  }
}

export const createSupportToTrashSkillDemoState = (): GameState => {
  const p1Deck = createOfficialGreenStarterDeck('player-one')
  const p2Deck = createOfficialGreenStarterDeck('player-two')
  const strawberryCrepe = p1Deck.find(
    (card) => card.id === 'ST3-002',
  ) as CookieCard
  const supportCards = p1Deck
    .filter((card) => card.type !== 'cookie')
    .slice(0, 2)
  const defender = p2Deck.find(
    (card) => card.id === 'ST3-001',
  ) as CookieCard
  const opponentSupportCards = p2Deck
    .filter((card) => card.type !== 'cookie')
    .slice(0, 2)
  const hpCards = p2Deck
    .filter((card) => card.instanceId !== defender.instanceId)
    .slice(0, 2)

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: strawberryCrepe,
            hpCards: [],
            rested: false,
            battleEntryId: `${strawberryCrepe.instanceId}:battle:1`,
          },
        ],
        supportArea: supportCards.map((card) => ({
          card,
          rested: false,
        })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: defender,
            hpCards,
            rested: false,
            battleEntryId: `${defender.instanceId}:battle:2`,
          },
        ],
        supportArea: opponentSupportCards.map((card) => ({
          card,
          rested: false,
        })),
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createTrapResponseDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST2-020')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard
  const breakArea: CookieCard[] = []
  let breakLevel = 0
  for (const card of p1Deck) {
    if (card.type !== 'cookie' || card.instanceId === defender.instanceId) {
      continue
    }
    breakArea.push(card)
    breakLevel += card.level
    if (breakLevel >= 5) break
  }
  const requiredColor = Object.keys(trap.trap!.cost.energy ?? trap.trap!.cost)[0] as
    | 'red'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'black'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  if (supports.length !== requiredCount) {
    throw new Error('測試牌組沒有足夠的同色或萬用支援卡支付陷阱費用。')
  }

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [trap],
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
    supportArea: payable
      ? supports.map((card) => ({ card, rested: false }))
      : [],
    breakArea,
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: [],
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:2`,
      },
    ],
  }
  const state: GameState = {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }

  return {
    ...state,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attacker.attack,
      remainingDamage: attacker.attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createBlockerResponseDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const blockerCookie: CookieCard = {
    ...defender,
    instanceId: 'blocker-cookie-demo',
    id: 'BS1-009',
    name: 'Affogato Cookie',
    level: 1,
    hp: 3,
    attack: 1,
    attackCost: 2,
    energyColor: 'red',
    skill: {
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, trashBattleCookie: undefined },
      text: '{bl} 《{R}》',
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    attackEffects: [],
    effectText: '',
    trap: undefined,
    flip: undefined,
  }

  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== defender.instanceId &&
        (card.energyColor === 'red' || card.energyColor === 'wild'),
    )
    .slice(0, 1)

  const breakArea: CookieCard[] = []
  let breakLevel = 0
  for (const card of p1Deck) {
    if (card.type !== 'cookie' || card.instanceId === defender.instanceId) {
      continue
    }
    breakArea.push(card)
    breakLevel += card.level
    if (breakLevel >= 5) break
  }

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [],
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
      {
        card: blockerCookie,
        hpCards: [],
        rested: false,
        battleEntryId: `${blockerCookie.instanceId}:battle:2`,
      },
    ],
    supportArea: payable
      ? supports.map((card) => ({ card, rested: false }))
      : [],
    breakArea,
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: [],
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:3`,
      },
    ],
  }
  const state: GameState = {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 4,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }

  return {
    ...state,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attacker.attack,
      remainingDamage: attacker.attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createTrapAndBlockerDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST2-020')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const blockerCookie: CookieCard = {
    ...defender,
    instanceId: 'blocker-cookie-demo',
    id: 'BS1-009',
    name: 'Affogato Cookie',
    level: 1,
    hp: 3,
    attack: 1,
    attackCost: 2,
    energyColor: 'red',
    skill: {
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, trashBattleCookie: undefined },
      text: '{bl} 《{R}》',
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    attackEffects: [],
    effectText: '',
    trap: undefined,
    flip: undefined,
  }

  const requiredColor = Object.keys(trap.trap!.cost.energy ?? trap.trap!.cost)[0] as
    | 'red'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'black'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
  const trapSupports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  const blockerSupports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        card.instanceId !== blockerCookie.instanceId &&
        (card.energyColor === 'red' || card.energyColor === 'wild'),
    )
    .slice(0, 1)

  const allSupports = [...trapSupports, ...blockerSupports]

  const breakArea: CookieCard[] = []
  let breakLevel = 0
  for (const card of p1Deck) {
    if (
      card.type !== 'cookie' ||
      card.instanceId === defender.instanceId ||
      card.instanceId === blockerCookie.instanceId
    ) {
      continue
    }
    breakArea.push(card)
    breakLevel += card.level
    if (breakLevel >= 5) break
  }

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [trap],
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
      {
        card: blockerCookie,
        hpCards: [],
        rested: false,
        battleEntryId: `${blockerCookie.instanceId}:battle:2`,
      },
    ],
    supportArea: payable
      ? allSupports.map((card) => ({ card, rested: false }))
      : [],
    breakArea,
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: [],
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:3`,
      },
    ],
  }
  const state: GameState = {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 4,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }

  return {
    ...state,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attacker.attack,
      remainingDamage: attacker.attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createFlipResponseDemoState = (): GameState => {
  const p1Deck = DECK_CREATORS.red('player-one')
  const p2Deck = DECK_CREATORS.red('player-two')
  const revealedFlip = p1Deck.find(
    (card) => card.id === 'ST1-001' && card.flip,
  )!
  const defender = p1Deck.find(
    (card) =>
      card.type === 'cookie' &&
      card.instanceId !== revealedFlip.instanceId,
  ) as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard
  const hand = p1Deck
    .filter(
      (card) =>
        card.instanceId !== revealedFlip.instanceId &&
        card.instanceId !== defender.instanceId,
    )
    .slice(0, 6)
  const usedP1 = new Set([
    revealedFlip.instanceId,
    defender.instanceId,
    ...hand.map((card) => card.instanceId),
  ])

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
    hand,
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: [],
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:2`,
      },
    ],
  }

  return {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: 1,
      remainingDamage: 0,
      stage: 'flip',
      trapUsed: false,
      revealedHpCard: revealedFlip,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createReplacementChoiceDemoState = (): GameState => {
  const p1Deck = DECK_CREATORS.red('player-one')
  const p2Deck = DECK_CREATORS.red('player-two')
  const remainingCookie = p1Deck.find(
    (card) => card.type === 'cookie',
  ) as CookieCard
  const replacementCookie = p1Deck.find(
    (card) =>
      card.type === 'cookie' &&
      card.instanceId !== remainingCookie.instanceId,
  ) as CookieCard
  const opponentCookie = p2Deck.find(
    (card) => card.type === 'cookie',
  ) as CookieCard
  const usedP1 = new Set([
    remainingCookie.instanceId,
    replacementCookie.instanceId,
  ])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [replacementCookie],
        battleArea: [
          {
            card: remainingCookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${remainingCookie.instanceId}:battle:1`,
          },
        ],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: opponentCookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${opponentCookie.instanceId}:battle:2`,
          },
        ],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacement: {
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    },
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}

const testCookieCard = (
  instanceId: string,
  level = 1,
  hp = 1,
  attack = 1,
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level,
  hp,
  attack,
  attackCost: 0,
})

const testSupportCard = (
  instanceId: string,
  color: EnergyColor | 'wild' = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: color,
})

const baseTestState = (
  activePlayerId: PlayerId,
  phase: TurnPhase,
): GameState => ({
  players: {
    'player-one': {
      id: 'player-one',
      name: '玩家',
      ...createTestPlayerState(),
    },
    'player-two': {
      id: 'player-two',
      name: 'AI 對手',
      ...createTestPlayerState(),
    },
  },
  firstPlayerId: activePlayerId,
  activePlayerId,
  turnNumber: 1,
  phase,
  status: 'playing',
  result: null,
  supportPlacedThisTurn: false,
  skillUsesThisTurn: [],
  nextBattleEntrySequence: 3,
  attackModifiers: [],
  damageReceivedModifiers: [],
  flipDisabledUntilTurn: {},
  pendingReplacement: null,
  departedCookieCounts: {
    'player-one': 0,
    'player-two': 0,
  },
  pendingOnPlay: null,
  pendingRefresh: null,
  pendingBattle: null,
})

export const createItemUsageDemoState = (payable: boolean): GameState => {
  const itemCard: GameCard = {
    id: 'test-item',
    instanceId: 'test-item-1',
    name: '測試物品',
    type: 'item',
    item: {
      cost: { red: 1 },
      text: '測試物品效果',
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
  }

  const p1Cookie = testCookieCard('p1-cookie')
  const p2Cookie = testCookieCard('p2-cookie')
  const support = testSupportCard('pay-1', 'red')

  const state = baseTestState('player-one', payable ? 'main' : 'support')

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [itemCard],
        battleArea: [
          {
            card: p1Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p1Cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: payable
          ? [{ card: support, rested: false }]
          : [],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:2`,
          },
        ],
      },
    },
  }
}

export const createOpponentDiscardHandDemoState = (): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const roguefort = p2Deck.find((card) => card.id === 'ST2-001') as CookieCard
  const yellowSupport = p2Deck.find(
    (card) =>
      card.type !== 'cookie' &&
      (card.energyColor === 'yellow' || card.energyColor === 'wild'),
  )!
  const opponentCookie = p1Deck.find((card) => card.type === 'cookie') as CookieCard

  const p2HpCards = Array.from({ length: roguefort.hp }, (_, i) =>
    testSupportCard(`roguefort-hp-${i}`),
  )
  const p1HpCards = Array.from({ length: opponentCookie.hp }, (_, i) =>
    testSupportCard(`opp-hp-${i}`),
  )

  const p1HandCards = p1Deck
    .filter(
      (card) =>
        card.instanceId !== opponentCookie.instanceId &&
        card.type !== 'cookie',
    )
    .slice(0, 3)

  const usedP2 = new Set([
    roguefort.instanceId,
    yellowSupport.instanceId,
  ])
  const usedP1 = new Set([
    opponentCookie.instanceId,
    ...p1HandCards.map((c) => c.instanceId),
  ])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: p1HandCards,
        battleArea: [
          {
            card: opponentCookie,
            hpCards: p1HpCards,
            rested: false,
            battleEntryId: `${opponentCookie.instanceId}:battle:1`,
          },
        ],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        hand: [roguefort],
        battleArea: [
          {
            card: roguefort,
            hpCards: p2HpCards,
            rested: false,
            battleEntryId: `${roguefort.instanceId}:battle:2`,
          },
        ],
        supportArea: [{ card: yellowSupport, rested: false }],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOpponentHandDiscard: {
      playerId: 'player-one',
      count: 1,
      sourcePlayerId: 'player-two',
      sourceInstanceId: roguefort.instanceId,
      sourceCardName: 'Roguefort Cookie',
      effectText: 'opponent-discard-hand',
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createFaintDamageDemoState = (): GameState => {
  const p2Cookie = testCookieCard('p2-target', 1, 2)
  const faintCookie: CookieCard = {
    ...testCookieCard('cherry-cookie', 2),
    name: 'Cherry Cookie',
    attackCost: 0,
    attackEnergyCost: {},
    skill: {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: "When this Cookie faints, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
      faint: true,
    },
  }
  const state = baseTestState('player-one', 'main')
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        breakArea: [faintCookie],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [testSupportCard('hp-1'), testSupportCard('hp-2')],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:1`,
          },
        ],
      },
    },
    pendingFaintEffects: [
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: faintCookie.instanceId,
        effect: {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
        context: {
          sourcePlayerId: 'player-one',
          sourceInstanceId: faintCookie.instanceId,
        },
      },
    ],
  }
}

export const createPretzelSnareDemoState = (attack: number): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const trap = p1Deck.find((card) => card.id === 'ST2-021')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const requiredColor = Object.keys(
    trap.trap!.cost.energy ?? trap.trap!.cost,
  )[0] as 'yellow'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  const defenderHpCards = Array.from({ length: defender.hp }, (_, i) =>
    testSupportCard(`def-hp-${i}`),
  )
  const attackerHpCards = Array.from({ length: attacker.hp }, (_, i) =>
    testSupportCard(`atk-hp-${i}`),
  )

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [trap],
    battleArea: [
      {
        card: defender,
        hpCards: defenderHpCards,
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
    supportArea: supports.length === requiredCount
      ? supports.map((card) => ({ card, rested: false }))
      : [],
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: attackerHpCards,
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:2`,
      },
    ],
  }

  return {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attack,
      remainingDamage: attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createStageUsageDemoState = (payable: boolean): GameState => {
  const stageCard: GameCard = {
    id: 'test-stage',
    instanceId: 'test-stage-1',
    name: '測試場景',
    type: 'stage',
    stageAbility: {
      placementCost: { red: 1 },
      cost: { red: 1 },
      text: '測試場景效果',
      restSource: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
  }

  const oldStage: GameCard = {
    id: 'old-stage',
    instanceId: 'old-stage-1',
    name: '舊場景',
    type: 'stage',
  }

  const p1Cookie = testCookieCard('p1-cookie')
  const p2Cookie = testCookieCard('p2-cookie')
  const support1 = testSupportCard('pay-1', 'red')
  const support2 = testSupportCard('pay-2', 'red')

  if (payable) {
    const state = baseTestState('player-one', 'main')
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [stageCard],
          battleArea: [
            {
              card: p1Cookie,
              hpCards: [],
              rested: false,
              battleEntryId: `${p1Cookie.instanceId}:battle:1`,
            },
          ],
          supportArea: [
            { card: support1, rested: false },
            { card: support2, rested: false },
          ],
          stage: { card: oldStage, rested: false },
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              card: p2Cookie,
              hpCards: [],
              rested: false,
              battleEntryId: `${p2Cookie.instanceId}:battle:2`,
            },
          ],
        },
      },
    }
  }

  const state = baseTestState('player-one', 'main')
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [
          {
            card: p1Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p1Cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: [
          { card: support1, rested: false },
          { card: support2, rested: false },
        ],
        stage: { card: stageCard, rested: true },
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:2`,
          },
        ],
      },
    },
  }
}
export const createBlueActivateSkillDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const werewolf = p1Deck.find((c) => c.id === 'ST4-012') as CookieCard
  const handCards = p1Deck.filter((c) => c.instanceId !== werewolf.instanceId && c.type !== 'cookie').slice(0, payable ? 3 : 0)
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const usedP1 = new Set([werewolf.instanceId, ...handCards.map((c) => c.instanceId)])
  const usedP2 = new Set([defender.instanceId])
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: handCards,
        battleArea: [{ card: werewolf, hpCards: [], rested: false, battleEntryId: `${werewolf.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: [], rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null, pendingBattle: null,
  }
}

export const createBlueOptionalCostAttackDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const caviar = p1Deck.find((c) => c.id === 'ST4-013') as CookieCard
  const costCards = p1Deck
    .filter((c) => c.instanceId !== caviar.instanceId && c.type !== 'cookie')
    .slice(0, payable ? 2 : 1)
  const deployableCookie = p1Deck.find(
    (c) => c.instanceId !== caviar.instanceId && c.type === 'cookie',
  )
  const handCards = payable && deployableCookie
    ? [...costCards, deployableCookie]
    : costCards
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const defenderHpCards = p2Deck
    .filter((c) => c.instanceId !== defender.instanceId)
    .slice(0, 2)
  const usedP1 = new Set([caviar.instanceId, ...handCards.map((c) => c.instanceId)])
  const usedP2 = new Set([
    defender.instanceId,
    ...defenderHpCards.map((c) => c.instanceId),
  ])
  const attackEffects = caviar.attackEffects ?? []
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: handCards,
        battleArea: [{ card: caviar, hpCards: [], rested: true, battleEntryId: `${caviar.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: defenderHpCards, rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-one', defenderPlayerId: 'player-two',
      attackerInstanceId: caviar.instanceId, targetInstanceId: defender.instanceId,
      declaredDamage: 1, remainingDamage: 0, stage: 'attack-effect',
      trapUsed: false, revealedHpCard: null, preventKnockoutTargetIds: [],
      faintedColors: [], attackEffects, attackEffectIndex: 0,
    },
  }
}

export const createBlueInspectDeckDemoState = (): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const caviar = p1Deck.find((c) => c.id === 'ST4-013') as CookieCard
  const deckTop3 = p1Deck.filter((c) => c.instanceId !== caviar.instanceId).slice(0, 3)
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const usedP1 = new Set([caviar.instanceId, ...deckTop3.map((c) => c.instanceId)])
  const usedP2 = new Set([defender.instanceId])
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        battleArea: [{ card: caviar, hpCards: [], rested: false, battleEntryId: `${caviar.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: [], rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null, pendingBattle: null,
    pendingInspectDeck: {
      playerId: 'player-one',
      sourceInstanceId: caviar.instanceId,
      sourceCardName: 'Captain Caviar Cookie',
      revealedCards: deckTop3,
      lookCount: 3,
      pickCount: 1,
    },
  }
}

export const createSt5010OnPlayDemoState = (): GameState => {
  const p1Deck = createOfficialPurpleStarterDeck('player-one')
  const p2Deck = createOfficialPurpleStarterDeck('player-two')
  const carol = p1Deck.find(
    (card): card is CookieCard => card.id === 'ST5-010',
  )!
  const support = p1Deck.find(
    (card) =>
      card.instanceId !== carol.instanceId &&
      card.energyColor === 'purple',
  )!
  const target = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const replacement = p2Deck.find(
    (card): card is CookieCard =>
      card.type === 'cookie' && card.instanceId !== target.instanceId,
  )!
  const usedP1 = new Set([carol.instanceId, support.instanceId])
  const usedP2 = new Set([target.instanceId, replacement.instanceId])
  const targetHpCards = p2Deck
    .filter((card) => !usedP2.has(card.instanceId))
    .slice(0, 2)
  targetHpCards.forEach((card) => usedP2.add(card.instanceId))

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [carol],
        supportArea: [{ card: support, rested: false }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        hand: [replacement],
        battleArea: [
          {
            card: target,
            hpCards: targetHpCards,
            rested: false,
            battleEntryId: `${target.instanceId}:battle:1`,
          },
        ],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 2,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacement: {
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    },
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createAiDiscardRevealDemoState = (): GameState => {
  const base = createDemoGame(7, { player: 'purple', ai: 'purple' })
  const ai = base.players['player-two']
  const hand = ai.hand.slice(0, 2)
  const handIds = new Set(hand.map((card) => card.instanceId))

  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...base.players,
      'player-two': {
        ...ai,
        hand,
        deck: ai.deck.filter((card) => !handIds.has(card.instanceId)),
      },
    },
    pendingOpponentHandDiscard: {
      playerId: 'player-two',
      count: 2,
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'ai-discard-reveal-source',
      sourceCardName: '公開棄牌測試',
      effectText: 'opponent-discard-hand',
    },
  }
}

export const createBlueSt4DemoState = (
  cardId: 'ST4-016' | 'ST4-017' | 'ST4-018' | 'ST4-019',
): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const item = p1Deck.find((card) => card.id === cardId)!
  const battleCookie = p1Deck.find(
    (card): card is CookieCard =>
      card.type === 'cookie' &&
      (cardId !== 'ST4-017' || card.level === 1) &&
      card.energyColor === 'blue',
  )!
  const opponentCookie = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const retainedCookie =
    cardId === 'ST4-016' || cardId === 'ST4-017'
      ? p1Deck.find(
          (card): card is CookieCard =>
            card.type === 'cookie' &&
            card.instanceId !== battleCookie.instanceId,
        )
      : undefined
  const paymentCount = cardId === 'ST4-016' || cardId === 'ST4-018' ? 2 : 1
  const reserved = new Set([
    item.instanceId,
    battleCookie.instanceId,
    ...(retainedCookie ? [retainedCookie.instanceId] : []),
  ])
  const hpCards = p1Deck
    .filter((card) => !reserved.has(card.instanceId))
    .slice(0, 3)
  hpCards.forEach((card) => reserved.add(card.instanceId))
  const supportCards = p1Deck
    .filter((card) => !reserved.has(card.instanceId) && card.energyColor === 'blue')
    .slice(0, paymentCount)
  supportCards.forEach((card) => reserved.add(card.instanceId))
  const extraHand = p1Deck
    .filter((card) => !reserved.has(card.instanceId))
    .slice(0, cardId === 'ST4-019' ? 3 : 0)
  extraHand.forEach((card) => reserved.add(card.instanceId))
  const usedP2 = new Set([opponentCookie.instanceId])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        hand: [item, ...extraHand],
        deck: p1Deck.filter((card) => !reserved.has(card.instanceId)),
        battleArea: [
          {
            card: battleCookie,
            hpCards,
            rested: false,
            battleEntryId: `${battleCookie.instanceId}:battle:1`,
          },
          ...(retainedCookie
            ? [{
                card: retainedCookie,
                hpCards: [],
                rested: false,
                battleEntryId: `${retainedCookie.instanceId}:battle:3`,
              }]
            : []),
        ],
        supportArea: supportCards.map((card) => ({ card, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        battleArea: [{
          card: opponentCookie,
          hpCards: [],
          rested: false,
          battleEntryId: `${opponentCookie.instanceId}:battle:2`,
        }],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createBlueSt4TrapDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST4-020')!
  const defender = p1Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const attacker = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const usedP1 = new Set([trap.instanceId, defender.instanceId])
  const support = p1Deck.find(
    (card) =>
      !usedP1.has(card.instanceId) &&
      (card.energyColor === 'blue' || card.energyColor === 'wild'),
  )!
  usedP1.add(support.instanceId)
  const discardCandidates = p1Deck
    .filter((card) => !usedP1.has(card.instanceId))
    .slice(0, payable ? 3 : 1)
  discardCandidates.forEach((card) => usedP1.add(card.instanceId))
  const usedP2 = new Set([attacker.instanceId])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [trap, ...discardCandidates],
        battleArea: [{
          card: defender,
          hpCards: [],
          rested: false,
          battleEntryId: `${defender.instanceId}:battle:1`,
        }],
        supportArea: [{ card: support, rested: false }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        battleArea: [{
          card: attacker,
          hpCards: [],
          rested: false,
          battleEntryId: `${attacker.instanceId}:battle:2`,
        }],
      },
    },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attacker.attack,
      remainingDamage: attacker.attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Generic, data-driven "card check" test state.
//
// Instead of one hand-built scenario per card (as above), this builds a
// minimal legal GameState for ANY official card number by looking it up in
// the shared card pool and inspecting which ability field the created
// GameCard actually carries (`skill` / `attackEffects` / `flip` / `trap` /
// `item` / `stageAbility`). A handful of scenario "shapes" are dispatched by
// that inspection, reusing the same field conventions as the hand-built
// scenarios above (phase 'main', mulligan/starting-cookie already resolved,
// support/energy pre-placed for cost payment, a spread of legal opponent
// targets across levels/remaining-HP so level- or HP-filtered target
// selectors have at least one match, etc.).
// ---------------------------------------------------------------------------

const cardCheckFillerCookie = (
  instanceId: string,
  level: number,
  hp: number,
  damage = 0,
  energyColor?: EnergyColor,
): { cookie: CookieCard; hpCards: GameCard[] } => {
  const cookie: CookieCard = {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'cookie',
    level,
    hp,
    attack: 1,
    attackCost: 0,
    energyColor,
  }
  const remainingHp = Math.max(0, hp - damage)
  const hpCards = Array.from({ length: remainingHp }, (_, i) =>
    testSupportCard(`${instanceId}-hp-${i}`),
  )
  return { cookie, hpCards }
}

const cardCheckBattleEntry = (
  cookie: CookieCard,
  hpCards: GameCard[],
  sequence: number,
  rested = false,
) => ({
  card: cookie,
  hpCards,
  rested,
  battleEntryId: `${cookie.instanceId}:battle:${sequence}`,
})

const getPTestCard = (cardNumber: string): GameCard => {
  const source = (pFormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.cardNumber === cardNumber,
  )
  if (!source) throw new Error(`P test fixture requires ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(source)
  if (conversion.status !== 'converted') {
    throw new Error(`P test fixture cannot convert ${cardNumber}`)
  }
  return conversion.gameCard
}

const getBs6FormalTestCard = (cardNumber: string): GameCard | null => {
  const trimmed = cardNumber.trim()
  const source = (bs6FormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.cardNumber === trimmed,
  ) ?? (bs6FormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.baseCardNumber === trimmed,
  )
  if (!source) return null

  const conversion = convertOfficialCardToGameCard(source, 'card-check-1')
  if (conversion.status !== 'converted') {
    throw new Error(`BS6 formal test fixture cannot convert ${cardNumber}: ${conversion.reason}`)
  }
  return {
    ...conversion.gameCard,
    instanceId: `player-one-${source.cardNumber}-1`,
  }
}

/**
 * BS7 維持 inventory 候選狀態；這個 fallback 只讓 localhost 的 card-check
 * Browser fixture 經相同 adapter 驗證，絕不寫入 generated card pool。
 */
const getBs7CandidateTestCard = (cardNumber: string): GameCard | null => {
  const trimmed = cardNumber.trim()
  const source = (bs7CandidateDocument.cards as OfficialCardRecord[]).find(
    (record) => record.cardNumber === trimmed,
  ) ?? (bs7CandidateDocument.cards as OfficialCardRecord[]).find(
    (record) => record.baseCardNumber === trimmed,
  )
  if (!source) return null

  const conversion = convertOfficialCardToGameCard(source, 'card-check-1')
  if (conversion.status !== 'converted') {
    throw new Error(`BS7 candidate test fixture cannot convert ${cardNumber}: ${conversion.reason}`)
  }
  return {
    ...conversion.gameCard,
    instanceId: `player-one-${source.cardNumber}-1`,
  }
}

/**
 * BS8 同樣維持在 candidates 隔離區。這個 fallback 僅限 localhost 的
 * `card:`／`card-negative:` Browser 驗收，不能寫入正式 card pool 或 Standard
 * 對戰；EXTRA 仍須經獨立的 staging 流程驗證。
 */
const getBs8CandidateTestCard = (cardNumber: string): GameCard | null => {
  const trimmed = cardNumber.trim()
  const source = (bs8FormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.cardNumber === trimmed,
  ) ?? (bs8FormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.baseCardNumber === trimmed,
  )
  if (!source || source.flags.extra) return null

  const conversion = convertOfficialCardToGameCard(source, 'card-check-1')
  if (conversion.status !== 'converted') {
    throw new Error(`BS8 candidate test fixture cannot convert ${cardNumber}: ${conversion.reason}`)
  }
  return {
    ...conversion.gameCard,
    instanceId: `player-one-${source.cardNumber}-1`,
  }
}

const getCardCheckCard = (cardNumber: string): GameCard => {
  const entry = getCardPoolEntry(cardNumber)
  // BS6-091 is represented only by variants in the formal API. Resolve it
  // through the formal adapter so its variant-only skill/attack normalization
  // is preserved in the generic Browser card-check fixture.
  if (entry && entry.baseCardNumber !== 'BS6-091') {
    return createCard(entry, 'player-one', 1)
  }

  // P-0XX 已在正式卡池；仍保留原始資料 fallback，讓本機 card-check 可精確
  // 指定異圖，或以基礎卡號查找同卡的第一筆官方記錄。
  const trimmed = cardNumber.trim()
  const source = (pFormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.cardNumber === trimmed,
  ) ?? (pFormalDocument.cards as OfficialCardRecord[]).find(
    (record) => record.baseCardNumber === trimmed,
  )
  if (!source) {
    const bs6Formal = getBs6FormalTestCard(trimmed)
    if (bs6Formal) return bs6Formal
    const bs7Candidate = getBs7CandidateTestCard(trimmed)
    if (bs7Candidate) return bs7Candidate
    const bs8Candidate = getBs8CandidateTestCard(trimmed)
    if (bs8Candidate) return bs8Candidate
    throw new Error(`找不到卡片編號 ${cardNumber} 的官方資料。`)
  }

  const conversion = convertOfficialCardToGameCard(source, 'card-check-1')
  if (conversion.status !== 'converted') {
    throw new Error(`候選卡片 ${cardNumber} 無法轉換：${conversion.reason}`)
  }
  return {
    ...conversion.gameCard,
    instanceId: `player-one-${source.cardNumber}-1`,
  }
}

/**
 * Builds a minimal legal GameState positioned so the given card's ability
 * (if any) can be triggered through the real UI. Throws if the card number
 * isn't in the shared official card pool.
 */
export const createCardCheckDemoState = (
  cardNumber: string,
  options: { preferSkillSurface?: boolean } = {},
): GameState => {
  // EXTRA cards are deliberately not GameCards.  Route the generic localhost
  // card-check URL through the isolated EXTRA fixture instead of allowing the
  // normal `createCard` fallback to silently classify `type: extra` as an item
  // and place it in the player's hand.
  if (cardNumber.trim().split('@')[0] === 'BS8-005') {
    return createBs8ExtraDeckDemoState(true)
  }
  // The strict ability surface has an explicit duplicate-card fixture for
  // BS8-011. It proves Once Per Turn is tracked per physical battle entry;
  // the ordinary skill card-check route also exposes two real copies below.
  if (
    cardNumber.trim().split('@')[0] === 'BS8-011' &&
    options.preferSkillSurface
  ) {
    return createBs8011DoubleSkillDemoState()
  }
  const card = getCardCheckCard(cardNumber)
  // Some official alternate-art records omit their printed colour even though
  // the normalized runtime attack still has a coloured energy cost (for
  // example BS8-083@2).  Browser candidate fixtures must pay that actual
  // runtime cost instead of manufacturing an unrelated purple shortfall.
  const attackPaymentColor =
    card.type === 'cookie'
      ? card.attackEnergyCost
        ? (Object.entries(card.attackEnergyCost) as [EnergyColor, number][]).find(
            ([, amount]) => amount > 0,
          )?.[0]
        : undefined
      : undefined
  const payColor: EnergyColor = card.energyColor && card.energyColor !== 'wild'
    ? card.energyColor
    : attackPaymentColor ?? 'purple'

  // A spread of opponent battle cookies covering several levels and
  // remaining-HP totals so level/remaining-HP-filtered target selectors have
  // at least one legal candidate.
  const opp1 = cardCheckFillerCookie(
    'opp-lv1',
    1,
    card.id === 'BS2-050' ? 3 : 6,
    0,
    'red',
  )
  const opp2 = cardCheckFillerCookie(
    'opp-lv3',
    3,
    card.id === 'BS2-050' ? 3 : 8,
    card.id === 'BS2-050' ? 0 : 3,
    'yellow',
  )
  const opponentStage: GameCard = {
    id: 'opp-stage-card',
    instanceId: 'opp-stage-card-1',
    name: '對手場景卡',
    type: 'stage',
  }
  const opponentBreakArea: CookieCard[] = [
    cardCheckFillerCookie('opp-break-1', 2, 4, 0, 'red').cookie,
    cardCheckFillerCookie('opp-break-2', 2, 4, 0, 'yellow').cookie,
  ]

  // Extra battle cookies for the player, beyond the card under test, so
  // self-side target selectors and trash-battle-cookie costs have
  // candidates that aren't the tested card itself.
  const selfExtra1Base = cardCheckFillerCookie(
    'self-extra-1',
    card.id === 'BS5-005' ? 2 : card.id === 'BS8-043' ? 3 : 1,
    4,
    0,
    card.id === 'BS5-005' ? 'red' : payColor,
  )
  const selfExtra1 = card.id === 'P-117' || card.id === 'BS7-002' || card.id === 'BS7-003' || card.id === 'BS7-008' || card.id === 'BS7-010' || card.id === 'BS7-011' || card.id === 'BS7-012' || card.id === 'BS7-014' || card.id === 'BS7-015' || card.id === 'BS7-017' || card.id === 'BS7-018' || card.id === 'BS7-019' || card.id === 'BS7-021' || card.id === 'BS7-022' || card.id === 'BS7-024' || card.id === 'BS7-025' || card.id === 'BS7-026' || card.id === 'BS7-027' || card.id === 'BS7-028' || card.id === 'BS7-029' || card.id === 'BS7-030' || card.id === 'BS7-031' || card.id === 'BS7-032' || card.id === 'BS7-033' || card.id === 'BS7-035' || card.id === 'BS7-036' || card.id === 'BS7-037' || card.id === 'BS7-038' || card.id === 'BS7-039' || card.id === 'BS7-040' || card.id === 'BS7-041' || card.id === 'BS7-043' || card.id === 'BS7-044' || card.id === 'BS7-045' || card.id === 'BS7-046' || card.id === 'BS7-048' || card.id === 'BS7-049' || card.id === 'BS7-050' || card.id === 'BS7-051' || card.id === 'BS7-053' || card.id === 'BS7-055' || card.id === 'BS7-056' || card.id === 'BS7-057' || card.id === 'BS7-058' || card.id === 'BS7-059' || card.id === 'BS7-060' || card.id === 'BS7-061' || card.id === 'BS7-062' || card.id === 'BS7-068' || card.id === 'BS7-069' || card.id === 'BS7-070' || card.id === 'BS7-072' || card.id === 'BS7-075' || card.id === 'BS7-076' || card.id === 'BS7-078' || card.id === 'BS7-083' || card.id === 'BS7-096' || card.id === 'BS7-100' || card.id === 'BS7-105'
      ? {
          ...selfExtra1Base,
          cookie: {
            ...selfExtra1Base.cookie,
            ...(card.id === 'P-117'
              ? { level: 2, energyColor: 'blue' as EnergyColor }
              : card.id === 'BS7-025' || card.id === 'BS7-027' || card.id === 'BS7-028' || card.id === 'BS7-029' || card.id === 'BS7-030' || card.id === 'BS7-031' || card.id === 'BS7-032' || card.id === 'BS7-033' || card.id === 'BS7-035' || card.id === 'BS7-036' || card.id === 'BS7-037' || card.id === 'BS7-038' || card.id === 'BS7-039' || card.id === 'BS7-040' || card.id === 'BS7-041' || card.id === 'BS7-043' || card.id === 'BS7-044' || card.id === 'BS7-045' || card.id === 'BS7-046' || card.id === 'BS7-048' || card.id === 'BS7-049' || card.id === 'BS7-050' || card.id === 'BS7-051'
                ? { energyColor: 'yellow' as EnergyColor }
              : card.id === 'BS7-053' || card.id === 'BS7-055' || card.id === 'BS7-056' || card.id === 'BS7-057' || card.id === 'BS7-058' || card.id === 'BS7-059' || card.id === 'BS7-060' || card.id === 'BS7-061' || card.id === 'BS7-062'
                  ? { energyColor: 'green' as EnergyColor }
              : card.id === 'BS7-069' || card.id === 'BS7-070' || card.id === 'BS7-072' || card.id === 'BS7-075' || card.id === 'BS7-076' || card.id === 'BS7-078' || card.id === 'BS7-083'
                  ? { energyColor: 'blue' as EnergyColor }
                : card.id === 'BS7-096' || card.id === 'BS7-100' || card.id === 'BS7-105'
                  ? { energyColor: 'purple' as EnergyColor }
                : { energyColor: 'red' as EnergyColor }),
            ...(card.id === 'BS7-014'
              ? { name: 'Kouign-Amann Cookie' }
              : card.id === 'BS7-035'
                ? { name: 'Capsaicin Cookie' }
              : {}),
            keywords: ['arena'] as ['arena'],
          },
          ...(card.id === 'BS7-017'
            ? { hpCards: selfExtra1Base.hpCards.slice(0, 2) }
            : card.id === 'BS7-026'
              ? { hpCards: selfExtra1Base.hpCards.slice(0, 2) }
            : {}),
      }
    : card.id === 'BS6-096' || card.id === 'BS7-001'
      ? {
          ...selfExtra1Base,
          cookie: {
            ...selfExtra1Base.cookie,
            level: 3,
          },
        }
    : selfExtra1Base

  // Generous energy support to pay any skill/item/trap/stage energy cost.
  const energySupportColors: EnergyColor[] = card.id === 'P-032'
    ? ['red', 'yellow', 'green', 'blue', 'purple', 'red', 'yellow']
    : Array.from({ length: card.id === 'BS4-062' ? 8 : 6 }, () => payColor)
  const energySupports = energySupportColors.map((color, i) =>
    testSupportCard(`support-pay-${i}`, color),
  )
  const arenaSupportCookie = (
    instanceId: string,
    level = 1,
    energyColor: EnergyColor = payColor,
  ): CookieCard => ({
    ...cardCheckFillerCookie(instanceId, level, Math.max(2, level + 1), 0, energyColor).cookie,
    instanceId,
    keywords: ['arena'] as ['arena'],
  })
  const arenaSupportEntries = (
    prefix: string,
    count: number,
    level = 1,
    energyColor: EnergyColor = payColor,
  ) =>
    Array.from({ length: count }, (_, index) => ({
      card: arenaSupportCookie(`${prefix}-${index + 1}`, level, energyColor),
      rested: false,
    }))
  const arenaConditionSupportArea =
    card.id === 'BS7-053' || card.id === 'BS7-058'
      ? arenaSupportEntries(`${card.id}-arena-condition`, 5, 1, 'green')
      : null
  // 物品／技能的支援區回手代價若限定卡牌種類，通用 card-check fixture
  // 也要提供同類型候選，才能在正式 UI 實際走過支付代價而不是只測到
  // 「沒有合法候選」的略過路徑（例如 BS6-062 的 Cookie 代價）。
  const supportToHandType =
    card.item?.cost.supportToHandType ??
    card.skill?.cost.supportToHandType ??
    card.stageAbility?.cost.supportToHandType
  const supportToHandColor =
    card.item?.cost.supportToHandColor ??
    card.skill?.cost.supportToHandColor ??
    card.stageAbility?.cost.supportToHandColor
  const supportCostColor = supportToHandColor ?? payColor
  const supportCostCandidates: GameCard[] =
    supportToHandType === 'cookie'
      ? card.id === 'BS6-062'
        ? Array.from({ length: 3 }, (_, index) =>
            cardCheckFillerCookie(
              `${card.id}-support-cost-cookie-${index + 1}`,
              1,
              2,
              0,
              supportCostColor,
            ).cookie,
          )
        : [
            cardCheckFillerCookie(
              `${card.id}-support-cost-cookie`,
              1,
              2,
              0,
              supportCostColor,
            ).cookie,
          ]
      : supportToHandType
        ? [testSupportCard(`${card.id}-support-cost-${supportToHandType}`, supportCostColor)]
        : supportToHandColor
          ? [testSupportCard(`${card.id}-support-cost-${supportToHandColor}`, supportCostColor)]
          : []
  // Hand filler cards for discard-hand style costs, beyond the tested card.
  const handFillers = Array.from({ length: 4 }, (_, i) =>
    testSupportCard(`hand-filler-${i}`, i % 2 === 0 ? payColor : 'wild'),
  )
  // Some OnPlay effects require an additional Cookie in hand (for example,
  // BS3-038 places a level-2-or-higher Cookie from hand into the break area).
  // Keep that legal candidate in the browser card-check fixture without
  // changing any production deck or runtime rule.
  const handCookieFiller = cardCheckFillerCookie(
    'hand-cookie-filler',
    2,
    4,
    0,
    payColor,
  ).cookie
  // BS8's Cheese / conditional-deployment cards name a real Cookie rather
  // than accepting a generic filler. Keep the legal candidate data local to
  // the candidate Browser fixture so it never leaks into Standard decks.
  const bs8GoldenCheeseFixture: CookieCard = {
    ...cardCheckFillerCookie('BS8-golden-cheese-break', 3, 6, 0, 'yellow').cookie,
    name: 'Golden Cheese Cookie',
  }
  const bs8BlueLevelTwoHandFixture = cardCheckFillerCookie(
    'BS8-blue-lv2-hand',
    2,
    4,
    0,
    'blue',
  ).cookie
  const bs8YellowLevelThreeHandFixture = cardCheckFillerCookie(
    'BS8-yellow-lv3-hand',
    3,
    5,
    0,
    'yellow',
  ).cookie
  // Trash (discard pile) filler for skills that select from trash.
  const trashFillers: GameCard[] = [
    cardCheckFillerCookie('trash-cookie-1', 1, 3).cookie,
    cardCheckFillerCookie('trash-cookie-2', 2, 4, 0, payColor).cookie,
    testSupportCard('trash-item-1', payColor),
    ...Array.from({ length: 5 }, (_, i) =>
      testSupportCard(`trash-purple-cost-${i}`, 'purple'),
    ),
    // BS3-113 的 OnPlay 條件是自己的棄牌區至少 15 張紫色卡。card-check
    // fixture 必須把條件建立成真，才能在實際瀏覽器驗證後續的逐一全體傷害
    // 與目標排序 UI，而不是只停在「條件未滿足」的略過提示。
    ...(card.id === 'BS3-113'
      ? Array.from({ length: 8 }, (_, i) =>
          testSupportCard(`BS3-113-purple-trash-${i}`, 'purple'),
        )
      : []),
    ...(card.id === 'BS5-094'
      ? Array.from({ length: 5 }, (_, i) =>
          cardCheckFillerCookie(
            `BS5-094-purple-cookie-${i}`,
            1,
            3,
            0,
            'purple',
          ).cookie,
        )
      : []),
    // BS8-031 first moves a real LV.3 Cookie from trash; BS8-114 needs 30
    // cards while BS8-113/117/120/125 each use the printed 15-card threshold.
    ...(card.id === 'BS8-031'
      ? [cardCheckFillerCookie('BS8-031-trash-lv3', 3, 5, 0, 'yellow').cookie]
      : []),
    ...(['BS8-113', 'BS8-117', 'BS8-120', 'BS8-125'].includes(card.id)
      ? Array.from({ length: 7 }, (_, index) =>
          testSupportCard(`${card.id}-trash-threshold-${index + 1}`, 'purple'),
        )
      : []),
    ...(card.id === 'BS8-114'
      ? Array.from({ length: 22 }, (_, index) =>
          testSupportCard(`BS8-114-trash-threshold-${index + 1}`, 'purple'),
        )
      : []),
    // BS6-096 pays by moving its source Cookie to the trash before playing
    // a purple LV.1 Cookie.  Keep both the LV.3 condition and the legal
    // purple LV.1 candidate visible in the generic Browser card-check route.
    ...(card.id === 'BS6-096'
      ? [
          cardCheckFillerCookie(
            'BS6-096-purple-lv1',
            1,
            3,
            0,
            'purple',
          ).cookie,
        ]
      : []),
    // BS5-093 的 Activate 代價要求 3 張紫色、非 FLIP 餅乾；generic
    // trash filler 只有 2 張餅乾，會讓 Browser 只看到不合法分支，因此
    // 專用正向 fixture 補上三張可實際選取的候選。
    ...(card.id === 'BS5-093'
      ? Array.from({ length: 3 }, (_, index) =>
          cardCheckFillerCookie(
            `BS5-093-purple-cookie-${index + 1}`,
            1,
            3,
            0,
            'purple',
          ).cookie,
        )
      : []),
  ]
  // Deploying a cookie draws HP cards from the top of the deck
  // (see deployCookie in actions.ts); an empty deck immediately triggers
  // deck-exhaustion (`pendingRefresh`), which in turn blocks on-play skill
  // resolution and other pending-state-gated actions. Give both players a
  // generous filler deck so no card-check scenario accidentally exhausts it.
  const deckFiller = (prefix: string): GameCard[] =>
    Array.from({ length: 20 }, (_, i) => testSupportCard(`${prefix}-deck-${i}`, payColor))
  // Conditional item card-check routes should be immediately testable from
  // the generic `card:` URL. BS4-106/107 inspect the opponent's trash, so the
  // neutral empty pile would only exercise the unmet branch and hide their
  // target/Then UI from manual Browser verification.
  const opponentTrashCount =
    card.id === 'BS4-106' ? 10 : card.id === 'BS4-107' ? 15 : 0
  const opponentTrashFillers = Array.from(
    { length: opponentTrashCount },
    (_, index) =>
      testSupportCard(`${card.id}-opponent-trash-${index + 1}`, 'purple'),
  )
  // BS6-019 requires all of the following public conditions before its
  // second item effect can be exercised: our Cookie must still have an HP
  // card (the generic battle Cookie has four), the opponent must have at
  // most one Cookie in their break area (the base fixture is empty), and
  // there must be active opponent support cards to rest.  The generic item
  // fixture used to leave the opponent support area empty, so the card
  // stopped after the first HP-to-hand step and never exposed the real
  // second-step target UI.
  const opponentSupportArea =
    card.id === 'BS6-019'
      ? scenarioSupports('BS6-019-opponent-support', 3, 'red')
      : card.id === 'BS8-071'
        ? scenarioSupports('BS8-071-opponent-support', 2, 'green')
      : undefined

  // Own break area filler for break-area-level conditions (flip cards) and
  // for skills that select own-color cookies from the break area (e.g.
  // "Select {Y} Cookies from your break area" — colorless fillers would give
  // such skills zero legal candidates and silently never activate).
  const ownBreakArea: CookieCard[] =
    card.id === 'BS7-027' || card.id === 'BS7-028' || card.id === 'BS7-029' || card.id === 'BS7-032' || card.id === 'BS7-039' || card.id === 'BS7-043'
      ? [
          {
            ...cardCheckFillerCookie('BS7-027-arena-break', 1, 3, 0, 'yellow').cookie,
            keywords: ['arena'] as ['arena'],
          },
        ]
    : card.id === 'BS7-038'
      ? [
          {
            ...cardCheckFillerCookie('BS7-038-arena-break', 1, 2, 0, 'yellow').cookie,
            keywords: ['arena'] as ['arena'],
          },
        ]
    : card.id === 'BS7-020'
      ? [
          cardCheckFillerCookie('BS7-020-break-lv3-a', 3, 4, 0, payColor).cookie,
          cardCheckFillerCookie('BS7-020-break-lv3-b', 3, 4, 0, payColor).cookie,
        ]
      : card.id === 'BS5-042'
      ? [
          cardCheckFillerCookie('BS5-042-break-lv3', 3, 4, 0, payColor).cookie,
          cardCheckFillerCookie('BS5-042-break-lv2', 2, 4, 0, payColor).cookie,
        ]
      : card.id === 'BS6-024'
        ? [
            // Roll Cake Cookie counts only LV.3 Cookies in the owner's break
            // area. Keep one real LV.3 candidate visible for its attack Then.
            cardCheckFillerCookie('BS6-024-break-lv3', 3, 4, 0, payColor).cookie,
            cardCheckFillerCookie('BS6-024-break-lv2', 2, 4, 0, payColor).cookie,
          ]
      : card.id === 'BS6-025'
        ? [
            cardCheckFillerCookie('BS6-025-break-lv2', 2, 4, 0, payColor).cookie,
          ]
    : card.id === 'BS6-036'
        ? [
            // Zombie Cookie gains +1 HP for each exact LV.3 Cookie in its
            // break area. Keep a real LV.3 candidate visible in the generic
            // attack fixture so paying the optional yellow cost exercises the
            // actual HP-gain path instead of resolving as a zero-count no-op.
            cardCheckFillerCookie('BS6-036-break-lv3', 3, 4, 0, payColor).cookie,
            cardCheckFillerCookie('BS6-036-break-lv2', 2, 4, 0, payColor).cookie,
          ]
      : card.id === 'BS8-031'
        ? [
            cardCheckFillerCookie('BS8-031-break-lv1', 1, 3, 0, 'yellow').cookie,
            cardCheckFillerCookie('BS8-031-break-lv2', 2, 4, 0, 'yellow').cookie,
          ]
      : card.id === 'BS8-032' || card.id === 'BS8-034'
        ? [bs8GoldenCheeseFixture]
      : [
          cardCheckFillerCookie('self-break-1', 2, 4, 0, payColor).cookie,
          cardCheckFillerCookie('self-break-2', 2, 4, 0, payColor).cookie,
        ]

  const baseState = (): GameState => ({
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller('p1'),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller('p2'),
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 10,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  })

  // The real game caps each side's battle area at 2 cookies.
  const opponentBattleArea = [
    cardCheckBattleEntry(
      card.id === 'BS7-007'
        ? { ...opp1.cookie, keywords: ['arena'] as ['arena'] }
        : opp1.cookie,
      opp1.hpCards,
      1,
    ),
    cardCheckBattleEntry(opp2.cookie, opp2.hpCards, 2),
  ]

  // --- Non-cookie cards (item / trap / stage) --------------------------
  if (card.type === 'item') {
    const state = baseState()
    // Keep the real BS6-084 card-check path above its hand-count threshold so
    // Browser verification exercises the order "discard cost, then condition"
    // instead of only the already-satisfied branch.
    const itemHand =
      card.id === 'BS6-084'
        ? [
            card,
            ...handFillers,
            testSupportCard('BS6-084-hand-filler-extra', 'wild'),
          ]
        : card.id === 'BS8-047'
          ? [card, bs8YellowLevelThreeHandFixture, ...handFillers]
          : card.id === 'BS8-096' || card.id === 'BS8-097'
            // Item conditions are checked before the card leaves the hand.
            // Keep the total at two, so this Browser fixture exercises the
            // printed \"2 or less\" branch instead of a disabled hand card.
            ? [card, ...handFillers.slice(0, 1)]
        : [card, ...handFillers]
    const itemBreakArea =
      card.id === 'BS7-020'
        ? ownBreakArea
      : card.id === 'BS8-047'
        ? [
            {
              ...bs8GoldenCheeseFixture,
              instanceId: 'BS8-047-yellow-lv3-break',
            },
          ]
      : card.id === 'BS6-041'
        ? [
            ...ownBreakArea,
            cardCheckFillerCookie('bs6-041-break-3', 1, 3, 0, 'yellow').cookie,
          ]
        : card.id === 'BS5-042'
          ? ownBreakArea
        : undefined
    const itemDeck = card.id === 'BS7-063'
      ? [
          arenaSupportCookie('BS7-063-deck-arena', 1, 'green'),
          ...deckFiller('p1').slice(1),
        ]
      : deckFiller('p1')
    const itemDiscardPile = card.id === 'BS7-105'
      ? [
          ...trashFillers,
          {
            ...cardCheckFillerCookie('BS7-105-trash-arena', 1, 3, 0, 'purple').cookie,
            keywords: ['arena'] as ['arena'],
          },
        ]
      : card.id === 'BS8-048'
        ? [
            ...trashFillers,
            {
              ...testSupportCard('BS8-048-soul-jam', 'yellow'),
              name: 'Soul Jam: Light of Destruction',
            },
          ]
      : trashFillers
    const itemPlayerSupportArea =
      card.id === 'BS8-071'
        ? energySupports.slice(0, 1)
        : [...energySupports, ...supportCostCandidates]
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: itemHand,
          battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 4)],
          deck: itemDeck,
          supportArea: itemPlayerSupportArea.map((c) => ({
            card: c,
            rested: false,
          })),
          ...(itemBreakArea ? { breakArea: itemBreakArea } : {}),
          discardPile: itemDiscardPile,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: opponentBattleArea,
          stage: { card: opponentStage, rested: false },
          discardPile: opponentTrashFillers,
          ...(opponentSupportArea
            ? {
                supportArea: opponentSupportArea,
                // Keep the card's "1 Cookie or less" condition explicit in
                // the fixture instead of relying on createTestPlayerState's
                // empty default.
                breakArea: [],
              }
            : {}),
          ...(card.id === 'BS7-020' ? { breakArea: opponentBreakArea } : {}),
        },
      },
      ...(card.id === 'BS7-041'
        ? {
            arenaCookiesPlacedInBreakThisTurn: {
              'player-one': 1,
              'player-two': 0,
            },
          }
        : {}),
    }
  }

  if (card.type === 'stage') {
    const stageBattleCookie = card.id === 'P-032'
      ? { ...selfExtra1.cookie, keywords: ['ancient'] as ['ancient'] }
      : card.id === 'BS8-125'
        ? {
            ...selfExtra1.cookie,
            name: 'Dark Cacao Cookie',
            energyColor: 'purple' as EnergyColor,
            attackCost: 1,
            attackEnergyCost: { purple: 1 },
          }
      : selfExtra1.cookie
    const stageHand = card.id === 'P-028'
      ? [card, handCookieFiller, ...handFillers]
      : card.id === 'BS6-043'
        ? [card, handCookieFiller, ...handFillers]
        : card.id === 'BS7-086'
          ? [
              card,
              {
                ...handCookieFiller,
                instanceId: 'BS7-086-hand-blue-arena',
                energyColor: 'blue' as EnergyColor,
                keywords: ['arena'] as ['arena'],
              },
              ...handFillers,
            ]
        : [card, ...handFillers]
    const stageBreakArea = card.id === 'P-028'
      ? [
          cardCheckFillerCookie('p028-break-lv1', 1, 2, 0, 'yellow').cookie,
          ...ownBreakArea,
        ]
      : ownBreakArea
    const oldStage: GameCard = { id: 'old-stage', instanceId: 'old-stage-1', name: '舊場景', type: 'stage' }
    const stageDiscardPile = card.id === 'BS7-107'
      ? [
          ...trashFillers,
          {
            ...cardCheckFillerCookie('BS7-107-trash-arena-1', 1, 3, 0, 'purple').cookie,
            keywords: ['arena'] as ['arena'],
          },
          {
            ...cardCheckFillerCookie('BS7-107-trash-arena-2', 2, 4, 0, 'purple').cookie,
            keywords: ['arena'] as ['arena'],
          },
        ]
      : trashFillers
    const state = baseState()
    const stageBattleFixture = card.id === 'BS6-021'
      ? cardCheckFillerCookie(
          'BS6-021-condition-cookie',
          2,
          4,
          3,
          payColor,
        )
      : { cookie: stageBattleCookie, hpCards: selfExtra1.hpCards }
    // BS6-064 activates only while our support area is smaller than the
    // opponent's.  The generic stage fixture normally supplies generous
    // payment energy on our side, which made the condition false and left the
    // card with no usable Activate path.  Keep enough active payment cards,
    // but mirror the real support-count condition for this card.
    const stagePlayerSupportArea =
      card.id === 'BS6-064'
        ? energySupports.slice(0, 2).map((c) => ({ card: c, rested: false }))
      : card.id === 'BS6-043'
          ? energySupports.map((c, index) => ({ card: c, rested: index < 2 }))
        : card.id === 'BS7-065'
          ? [
              ...energySupports.map((c) => ({ card: c, rested: false })),
              ...arenaSupportEntries('BS7-065-support-arena', 1, 1, 'green'),
            ]
        : [...energySupports, ...supportCostCandidates].map((c) => ({
            card: c,
            rested: false,
          }))
    const stageOpponentSupportArea =
      card.id === 'BS6-064'
        ? scenarioSupports('BS6-064-opponent-support', 4, 'green')
        : undefined
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: stageHand,
          battleArea: [
            {
              ...cardCheckBattleEntry(
                stageBattleFixture.cookie,
                stageBattleFixture.hpCards,
                4,
              ),
              ...(card.id === 'BS8-099' ? { rested: true } : {}),
            },
          ],
          supportArea: stagePlayerSupportArea,
          stage: { card: oldStage, rested: false },
          breakArea: stageBreakArea,
          discardPile: stageDiscardPile,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea:
            card.id === 'BS8-099'
              ? opponentBattleArea.map((entry) => ({ ...entry, rested: true }))
              : opponentBattleArea,
          ...(stageOpponentSupportArea
            ? { supportArea: stageOpponentSupportArea }
            : {}),
        },
      },
      ...(card.id === 'BS7-022'
        ? {
            // BS7-022 的正向路徑直接以正式回合旗標表示己方 Arena Cookie
            // 本回合已造成效果傷害，保留場景登場／Activate／目標流程。
            arenaCookieDealtEffectDamageThisTurn: {
              'player-one': true,
              'player-two': false,
            },
          }
        : {}),
      ...(card.id === 'BS7-043'
        ? {
            // BS7-043 的正向路徑保留正式事件旗標與 Arena 休息區卡，
            // 讓場景啟動效果在 Browser 可選到合法 Cookie。
            arenaCookiesPlacedInBreakThisTurn: {
              'player-one': 1,
              'player-two': 0,
            },
          }
        : {}),
    }
  }

  if (card.type === 'trap') {
    // BS2-050 can only target an opponent Cookie with 3 or fewer remaining
    // HP.  Keep that condition satisfied in the generic trap fixture so the
    // response modal exposes the real target/payment flow instead of letting
    // the attack resolve directly into a replacement prompt.
    const defender = cardCheckFillerCookie(
      'trap-defender',
      2,
      card.id === 'BS2-050' ? 3 : 5,
      0,
      payColor,
    )
    // A high-attack attacker so "attacker attack more than N" trap
    // conditions have a chance of being met, plus 2 extra opponent battle
    // cookies (beyond the attacker) so traps that select an opponent target
    // (rather than just redirecting/countering the current attack) have
    // legal candidates.
    const attacker: CookieCard = { ...cardCheckFillerCookie('trap-attacker', 2, 5, 0, 'black').cookie, attack: 6 }
    const attackerHpCards = Array.from({ length: attacker.hp }, (_, index) =>
      testSupportCard(`trap-attacker-hp-${index + 1}`, 'black'),
    )
    const bigTrashFillers = Array.from({ length: 16 }, (_, i) =>
      cardCheckFillerCookie(`trash-bulk-${i}`, 1, 3).cookie,
    )
    const trapBreakArea: CookieCard[] = card.id === 'BS5-087'
      ? [
          cardCheckFillerCookie('BS5-087-break-1', 3, 4).cookie,
          cardCheckFillerCookie('BS5-087-break-2', 3, 4).cookie,
        ]
      : card.id === 'BS6-042'
        ? [
            // Clever Advice requires at least three Cookies in the owner's
            // break area before it can be selected as an attack-response
            // Trap. Keep the count condition true in the generic card-check
            // state so the real payment/target flow is reachable.
            cardCheckFillerCookie('BS6-042-break-1', 1, 3).cookie,
            cardCheckFillerCookie('BS6-042-break-2', 1, 3).cookie,
            cardCheckFillerCookie('BS6-042-break-3', 2, 4).cookie,
          ]
        : card.id === 'BS7-042'
          ? Array.from({ length: 3 }, (_, index) => ({
              ...cardCheckFillerCookie(
                `BS7-042-arena-break-${index + 1}`,
                index === 2 ? 2 : 1,
                3,
                0,
                'yellow',
              ).cookie,
              keywords: ['arena'] as ['arena'],
            }))
      : card.id === 'BS7-108'
        ? [cardCheckFillerCookie('BS7-108-break-lv4', 4, 4, 0, 'purple').cookie]
        : card.id === 'BS8-048'
          ? [cardCheckFillerCookie('BS8-048-break-lv3', 3, 5, 0, 'yellow').cookie]
        : []
    const trapOpponentSecondCookie =
      card.id === 'BS5-109'
        ? opp1.cookie
        : card.id === 'BS7-108'
          ? cardCheckFillerCookie('BS7-108-opponent-lv3', 3, 6, 0, 'black').cookie
          : opp2.cookie
    const trapBattleArea =
      card.id === 'BS6-106'
        ? [cardCheckBattleEntry(defender.cookie, defender.hpCards, 4)]
        : card.id === 'BS7-108'
          ? [
              cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
              cardCheckBattleEntry(
                trapOpponentSecondCookie,
                Array.from({ length: trapOpponentSecondCookie.hp }, (_, index) =>
                  testSupportCard(`BS7-108-opponent-lv3-hp-${index + 1}`, 'black'),
                ),
                6,
              ),
            ]
        : [
            cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
            cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
          ]
    const trapTrashFillers =
      card.id === 'BS6-106'
        ? [
            ...trashFillers,
            ...bigTrashFillers,
            cardCheckFillerCookie(
              'BS6-106-purple-hp2-trash-cookie',
              1,
              2,
              0,
              'purple',
            ).cookie,
          ]
        : card.id === 'BS7-106'
          ? [
              ...trashFillers,
              ...bigTrashFillers,
              {
                ...cardCheckFillerCookie(
                  'BS7-106-trash-arena',
                  1,
                  3,
                  0,
                  'purple',
                ).cookie,
                keywords: ['arena'] as ['arena'],
              },
            ]
          : card.id === 'BS8-048'
            ? [
                ...trashFillers,
                {
                  ...testSupportCard('BS8-048-soul-jam', 'yellow'),
                  name: 'Soul Jam: Light of Destruction',
                },
              ]
          : [...trashFillers, ...bigTrashFillers]
    const state = baseState()
    return {
      ...state,
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: card.id === 'BS7-085'
            ? [card, handFillers[0]!]
            : [card, ...handFillers],
          battleArea: card.id === 'BS7-085'
            ? trapBattleArea.map((entry, index) =>
                index === 1
                  ? { ...entry, card: { ...entry.card, keywords: ['arena'] as ['arena'] } }
                  : entry,
              )
            : trapBattleArea,
          // BS6-063 的卡面寫的是「有 5 張卡牌」，不是「5 張以上」；
          // 付款只會將支援卡橫置，不會減少張數，因此要以恰好 5 張
          // 建立成立分支，才能在支付後繼續進入牌庫頂放置效果。
          supportArea: (card.id === 'BS6-063'
            ? energySupports.slice(0, 5)
            : energySupports
          ).map((c) => ({ card: c, rested: false })),
          breakArea: trapBreakArea,
          discardPile: trapTrashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: card.id === 'BS7-108'
            ? [
                cardCheckBattleEntry(attacker, attackerHpCards, 5, true),
                cardCheckBattleEntry(
                  trapOpponentSecondCookie,
                  Array.from({ length: trapOpponentSecondCookie.hp }, (_, index) =>
                    testSupportCard(`BS7-108-opponent-lv3-hp-${index + 1}`, 'black'),
                  ),
                  6,
                  true,
                ),
              ]
            : [
                cardCheckBattleEntry(attacker, attackerHpCards, 5, true),
                cardCheckBattleEntry(
                  trapOpponentSecondCookie,
                  trapOpponentSecondCookie === opp1.cookie
                    ? opp1.hpCards
                    : opp2.hpCards,
                  6,
                  true,
                ),
              ],
          stage: { card: opponentStage, rested: false },
          ...(card.id === 'BS7-108'
            ? {
                breakArea: [
                  cardCheckFillerCookie('BS7-108-opponent-break-lv1', 1, 3, 0, 'black').cookie,
                ],
              }
            : {}),
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: defender.cookie.instanceId,
        declaredDamage: attacker.attack,
        remainingDamage: attacker.attack,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
  }

  // --- Cookie / flip cards ----------------------------------------------

  // Flip-attachment cards trigger when revealed as an HP card during an
  // attack, not from the player's hand — mirror createFlipResponseDemoState.
  if (card.flip) {
    const defender = cardCheckFillerCookie('flip-defender', 2, 5, 4, payColor) // 1 HP card left: the flip card itself
    const attacker = cardCheckFillerCookie('flip-attacker', 2, 5, 0, 'black')
    // Keep enough break level for the generic FLIP fixture while leaving room
    // for the defeated target's level-2 Cookie. The generic card-check state
    // must remain playable after FLIP resolves; otherwise the target faint
    // would correctly end the game before the FLIP result can be inspected.
    const bigOwnBreakArea: CookieCard[] = [
      cardCheckFillerCookie('self-break-big-1', 3, 5).cookie,
      cardCheckFillerCookie('self-break-big-2', 2, 5).cookie,
    ]
    const state = baseState()
    return {
      ...state,
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: handFillers,
          battleArea: [
            cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
            cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
          ],
          breakArea: bigOwnBreakArea,
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 5, true),
          ],
          breakArea: opponentBreakArea,
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.cookie.instanceId,
        targetInstanceId: defender.cookie.instanceId,
        declaredDamage: 1,
        remainingDamage: 0,
        stage: 'flip',
        trapUsed: false,
        revealedHpCard: card,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
  }

  // Faint-triggered skill ("when this Cookie faints ..."): mirror
  // createFaintDamageDemoState — the card is already in the break area with
  // a pending faint effect queued.
  if (card.skill?.faint) {
    const target = cardCheckFillerCookie('faint-target', 2, 5, 0, payColor)
    const state = baseState()
    const faintCard: CookieCard = { ...(card as CookieCard) }
    const faintCost = getFaintTriggeredCost(card.skill)
    const pendingFaintEffects: PendingFaintEffect[] = card.skill.effects.map(
      (effect, index) => ({
        sourcePlayerId: 'player-one',
        sourceInstanceId: faintCard.instanceId,
        sourceCardName: faintCard.name,
        ...(card.skill?.faintOptional && index === 0
          ? { optional: true }
          : {}),
        effect,
        context: {
          sourcePlayerId: 'player-one',
          sourceInstanceId: faintCard.instanceId,
        },
        ...(card.skill?.sourceEnergy
          ? { sourceEnergy: card.skill.sourceEnergy }
          : {}),
        ...(faintCost && index === 0 ? { cost: faintCost } : {}),
      }),
    )
    // BS2-060's faint skill checks the opponent's trash count.  Put the
    // opponent on the condition-met side of that check so the card-check
    // route reaches the real draw effect and emits a public effect trace.
    const opponentTrashForFaint =
      card.id === 'BS2-060'
        ? Array.from({ length: 20 }, (_, index) =>
            testSupportCard(`BS2-060-opponent-trash-${index + 1}`, 'purple'),
          )
        : []
    const faintArenaHand =
      card.id === 'BS7-048' || card.id === 'BS7-075'
        ? {
            ...handCookieFiller,
            instanceId: `${card.id}-hand-arena`,
            keywords: ['arena'] as ['arena'],
          }
        : null
    const faintSupportArea =
      card.id === 'BS7-050'
        ? [
            ...energySupports.map((c) => ({ card: c, rested: false })),
            {
              card: testSupportCard('BS7-050-support-return', payColor),
              rested: false,
            },
          ]
        : card.id === 'BS7-048'
          ? energySupports.map((c) => ({ card: c, rested: false }))
          : undefined
    const faintDeck = card.id === 'BS7-090'
      ? [
          arenaSupportCookie('BS7-090-deck-arena-1', 1, 'red'),
          testSupportCard('BS7-090-deck-non-arena-1', 'purple'),
          arenaSupportCookie('BS7-090-deck-arena-2', 2, 'blue'),
          testSupportCard('BS7-090-deck-non-arena-2', 'green'),
          arenaSupportCookie('BS7-090-deck-arena-3', 1, 'yellow'),
          ...deckFiller('p1').slice(5),
        ]
      : state.players['player-one'].deck
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: faintDeck,
          breakArea: [faintCard, ...ownBreakArea],
          // Keep a legal Cookie in the battle area so resolving the faint
          // effect can continue through draw/Then UI without ending the demo
          // immediately for "no Cookie available".
          battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 4)],
          // BS3-061 pays its faint cost from the support area before checking
          // the 5-card condition. Start with six cards so the default
          // card-check route exercises the condition-met path.
          ...(card.id === 'BS3-061' || card.id === 'BS5-047' || card.id === 'BS6-101' || card.id === 'BS7-040'
            ? { supportArea: energySupports.map((c) => ({ card: c, rested: false })) }
            : faintSupportArea
              ? { supportArea: faintSupportArea }
            : {}),
          ...(card.id === 'BS2-043' || card.id === 'BS5-007' || card.id === 'BS7-090'
            ? { hand: handFillers }
            : card.id === 'BS5-026'
              ? { hand: [handCookieFiller, ...handFillers] }
              : faintArenaHand
                ? { hand: [faintArenaHand, ...handFillers] }
                : {}),
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            cardCheckBattleEntry(
              target.cookie,
              target.hpCards,
              4,
              card.id === 'BS7-050',
            ),
            ...opponentBattleArea,
          ],
          ...(opponentTrashForFaint.length > 0
            ? { discardPile: opponentTrashForFaint }
            : {}),
        },
      },
      pendingFaintEffects,
    }
  }

  // Attack-post-effect cookies ("Then ..." attack text): mirror
  // createAttackEffectDemoState / createBlueOptionalCostAttackDemoState.
  const cookieCard = card as CookieCard
  // OnPlay 牌同時擁有攻擊後效果時，card-check 仍須優先驗證登場能力；否則
  // 像 BS3-113 會被錯帶進 attack-effect fixture，根本無法在瀏覽器走到
  // OnPlay 的逐一傷害目標選擇。
  if (
    cookieCard.attackEffects &&
    cookieCard.attackEffects.length > 0 &&
    !options.preferSkillSurface &&
    // BS3-113, BS6-031, BS6-072, BS6-074, BS6-079, and BS7-046 are card-check entries used to verify an
    // OnPlay skill. Their secondary attack effects must not hide the deploy
    // UI; dedicated attack fixtures still cover those later effects.
    cookieCard.id !== 'BS3-113' &&
    cookieCard.id !== 'BS6-031' &&
    cookieCard.id !== 'BS6-072' &&
    cookieCard.id !== 'BS6-074' &&
    cookieCard.id !== 'BS6-079' &&
    cookieCard.id !== 'BS7-046' &&
    cookieCard.id !== 'BS7-059'
  ) {
    const state = baseState()
    // BS6-018 needs the player to declare a real attack while its source is at
    // exactly 1 HP. Starting it in the generic post-attack window would rest
    // the card and auto-skip the unmet condition before the player can test it.
    // BS8 promotion Browser A/B must prove the real attack declaration and
    // its printed payment.  Pre-populating `pendingBattle` would make the
    // B fixture resolve a Then effect even after all support cards were
    // rested, which is only a post-attack smoke path—not evidence that the
    // attack is legal.  Keep the older BS6-018 exception and route every BS8
    // attack-after card through the normal attacker -> energy -> target flow.
    const usesManualAttackFixture =
      cookieCard.id === 'BS6-018' || cookieCard.id.startsWith('BS8-')
    // BS6-016's Then requires the attacking Cookie to have exactly 1 remaining
    // HP. Keep that condition true in the positive card-check route so the
    // real target-selection UI is reachable instead of being auto-skipped.
    const usesLowHpAttackFixture =
      usesManualAttackFixture || cookieCard.id === 'BS6-016'
    // The generic fixture should enter the card's real post-attack UI rather
    // than silently auto-skipping an effect whose condition happens to be
    // false in the neutral spread above. Keep these adjustments local to the
    // browser fixture; they do not alter the official card pool or rules.
    const attackSourceHpCount =
      usesLowHpAttackFixture
        ? 1
      : cookieCard.id === 'BS6-053'
        ? cookieCard.hp
      : cookieCard.id === 'BS4-039'
        ? 2
        : cookieCard.id === 'BS5-098'
          ? 1
          : cookieCard.id === 'BS5-013'
            ? 4
            : cookieCard.id === 'BS5-010'
              ? 2
              : cookieCard.id === 'P-130'
                ? 3
              : cookieCard.id.startsWith('P-')
                ? Math.max(1, cookieCard.hp)
          // A card-check attack fixture represents the attack as already
          // declared, so the source Cookie is rested; it must nevertheless
          // retain its full HP stack. An empty stack makes the card appear
          // fainted (0/HP) and causes the real post-attack flow to be
          // skipped, which is especially visible for BS6-059/060/061.
          : cookieCard.hp
    const attackSourceHpCards = Array.from(
      { length: attackSourceHpCount },
      (_, index) => testSupportCard(`${cookieCard.id}-source-hp-${index + 1}`),
    )
    const attackOpponentBattleArea = opponentBattleArea.map((entry, index) =>
      cookieCard.id === 'BS4-016' && index === 0
        ? {
            ...entry,
            hpCards: [testSupportCard(`${cookieCard.id}-target-hp-1`)],
          }
        : entry,
    )
    const attackOwnBreakArea =
      cookieCard.id === 'BS4-023' || cookieCard.id === 'BS4-029'
        ? [
            cardCheckFillerCookie(
              `${cookieCard.id}-yellow-break-lv3`,
              3,
              5,
              0,
              'yellow',
            ).cookie,
            ...ownBreakArea,
          ]
        : ownBreakArea
    const optionalAttackCost = cookieCard.attackEffects?.find(
      (effect) => effect.kind === 'optional-cost-attack',
    )
    const attackSupportToHandCandidates =
      optionalAttackCost?.kind === 'optional-cost-attack' &&
      optionalAttackCost.cost.supportToHandType === 'cookie'
        ? [
            {
              card: cardCheckFillerCookie(
                `${cookieCard.id}-attack-support-cookie`,
                1,
                2,
                0,
                payColor,
              ).cookie,
              rested: false,
            },
          ]
        : []
    const attackPlayerSupportAreaBase =
      cookieCard.id === 'BS6-053'
        ? energySupports.slice(0, 5).map((card) => ({ card, rested: false }))
      : cookieCard.id === 'BS6-059'
        ? energySupports.slice(0, 5).map((card) => ({ card, rested: false }))
      // BS8-054/067 need fewer own support cards than the opponent while
      // retaining exactly enough printed green energy for the real attack.
      : cookieCard.id === 'BS8-054'
        ? energySupports.slice(0, 1).map((card) => ({ card, rested: false }))
      : cookieCard.id === 'BS8-067'
        ? energySupports.slice(0, 2).map((card) => ({ card, rested: false }))
      : cookieCard.id === 'BS4-053' || cookieCard.id === 'BS4-061'
        ? [
            ...energySupports.map((card) => ({ card, rested: false })),
            ...scenarioSupports(
              `${cookieCard.id}-condition-support`,
              1,
              'green',
            ),
          ]
        : energySupports.map((card) => ({ card, rested: false }))
    const attackPlayerSupportArea = [
      ...attackPlayerSupportAreaBase,
      ...attackSupportToHandCandidates,
    ]
    const attackOpponentSupportArea =
      cookieCard.id === 'BS4-049'
        ? scenarioSupports('BS4-049-condition-support', 7, 'green')
        : cookieCard.id === 'BS6-079'
          ? scenarioSupports('BS6-079-condition-support', 4, 'blue')
        : cookieCard.id === 'BS6-007'
          ? scenarioSupports('BS6-007-condition-support', 2, 'red')
          : cookieCard.id === 'BS8-054' || cookieCard.id === 'BS8-067'
            ? scenarioSupports(`${cookieCard.id}-condition-support`, 3, 'green')
          : []
    const attackArenaHand = Array.from({ length: 2 }, (_, index) => ({
      ...cardCheckFillerCookie(
        `${cookieCard.id}-attack-arena-hand-${index + 1}`,
        1,
        2,
        0,
        payColor,
      ).cookie,
      keywords: ['arena'] as ['arena'],
    }))
    const attackPlayerHand =
      cookieCard.id === 'BS4-073' || cookieCard.id === 'BS4-083'
        ? [
            ...handFillers,
            testSupportCard(`${cookieCard.id}-condition-hand`, 'blue'),
          ]
        // BS8-083 draws only until the hand reaches three cards. The generic
        // attack fixture otherwise starts with four filler cards, making the
        // real Then condition false and turning the positive Browser route
        // into an empty post-attack smoke path.
        : cookieCard.id === 'BS8-083'
          ? handFillers.slice(0, 2)
        // BS8-084 may draw only with three or fewer hand cards. Keep exactly
        // three non-source cards so the positive Browser route reaches the
        // printed conditional draw rather than a silent no-op.
        : cookieCard.id === 'BS8-084'
          ? handFillers.slice(0, 3)
        : cookieCard.id === 'P-111'
          ? [
              {
                ...handCookieFiller,
                instanceId: `${cookieCard.id}-hand-arena-cookie`,
                keywords: ['arena'] as ['arena'],
              },
              ...handFillers,
            ]
        : cookieCard.id === 'BS7-038' || cookieCard.id === 'BS7-039'
          ? [handCookieFiller, ...handFillers]
        : cookieCard.id === 'BS7-066' || cookieCard.id === 'BS7-067'
          ? [...attackArenaHand, ...handFillers]
        : cookieCard.id === 'BS7-082'
          ? handFillers.slice(0, 3)
        : cookieCard.id === 'BS7-073'
          ? handFillers.slice(0, 3)
        : cookieCard.id === 'BS5-071'
          ? handFillers.slice(0, 2)
          : handFillers
    const attackOpponentDiscard =
      cookieCard.id === 'BS4-089'
        ? [
            ...trashFillers,
            ...Array.from({ length: 8 }, (_, index) =>
              testSupportCard(`BS4-089-condition-trash-${index + 1}`),
            ),
        ]
        : trashFillers
    const attackArenaTrash = Array.from(
      { length: cookieCard.id === 'BS7-094' ? 30 : 7 },
      (_, index) => ({
      ...cardCheckFillerCookie(
        `${cookieCard.id}-attack-arena-trash-${index + 1}`,
        1,
        2,
        0,
        'purple',
      ).cookie,
      keywords: ['arena'] as ['arena'],
      }),
    )
    const attackPlayerDiscard =
      cookieCard.id === 'BS4-090'
        ? [
            ...trashFillers,
            ...Array.from({ length: 3 }, (_, index) =>
              createCard(
                getCardPoolEntry('BS4-102')!,
                'player-one',
                300 + index,
              ),
            ),
          ]
        : cookieCard.id === 'BS7-088' ||
            cookieCard.id === 'BS7-094' ||
            cookieCard.id === 'BS7-095' ||
            cookieCard.id === 'BS7-097' ||
            cookieCard.id === 'BS7-098' ||
            cookieCard.id === 'BS7-101' ||
            cookieCard.id === 'BS7-102' ||
            cookieCard.id === 'BS7-103'
          ? [...trashFillers, ...attackArenaTrash]
          : trashFillers
    const attackOpponentHand =
      cookieCard.id === 'BS7-089'
        ? Array.from({ length: 6 }, (_, index) =>
            testSupportCard(`${cookieCard.id}-opponent-hand-${index + 1}`, 'purple'),
          )
        : []
    // BS6-013's Then condition is specifically another *Chess Choco Cookie*
    // in the same battle area.  A generic filler Cookie is not a legal
    // substitute, so keep a second real card instance in the positive route.
    const chessChocoPartner =
      cookieCard.id === 'BS6-013'
        ? {
            ...cookieCard,
            instanceId: `${cookieCard.instanceId}-partner`,
          }
        : null
    const chessChocoPartnerHpCards = chessChocoPartner
      ? Array.from(
          { length: chessChocoPartner.hp },
          (_, index) =>
            testSupportCard(`BS6-013-partner-hp-${index + 1}`, payColor),
        )
      : []
    const attackBattleArea =
      // BS8-112's Then can play a LV.2+ Cookie from trash. Reserve a real
      // battle slot so the Browser positive path proves an actual placement,
      // rather than accepting the optional no-selection branch.
      cookieCard.id === 'BS4-029' || cookieCard.id === 'BS8-112'
        ? [
            cardCheckBattleEntry(
              card as CookieCard,
              attackSourceHpCards,
              4,
              !usesManualAttackFixture,
            ),
          ]
        : cookieCard.id === 'BS6-013' && chessChocoPartner
          ? [
              cardCheckBattleEntry(
                card as CookieCard,
                attackSourceHpCards,
                4,
                !usesManualAttackFixture,
              ),
              cardCheckBattleEntry(chessChocoPartner, chessChocoPartnerHpCards, 6),
            ]
          : [
              cardCheckBattleEntry(
                card as CookieCard,
                attackSourceHpCards,
                4,
                !usesManualAttackFixture,
              ),
              cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
            ]
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: attackPlayerHand,
          battleArea: attackBattleArea,
          supportArea: attackPlayerSupportArea,
          breakArea: attackOwnBreakArea,
          discardPile: attackPlayerDiscard,
        },
        'player-two': {
          ...state.players['player-two'],
          ...(attackOpponentHand.length > 0 ? { hand: attackOpponentHand } : {}),
          battleArea: attackOpponentBattleArea,
          supportArea: attackOpponentSupportArea,
          stage: { card: opponentStage, rested: false },
          discardPile: attackOpponentDiscard,
        },
      },
      ...(cookieCard.id === 'BS7-039'
        ? {
            arenaCookiesPlacedInBreakThisTurn: {
              'player-one': 1,
              'player-two': 0,
            },
          }
        : {}),
      pendingBattle: usesManualAttackFixture
        ? null
        : {
            attackerPlayerId: 'player-one',
            defenderPlayerId: 'player-two',
            attackerInstanceId: card.instanceId,
            targetInstanceId: opp1.cookie.instanceId,
            declaredDamage: cookieCard.attack,
            remainingDamage: 0,
            stage: 'attack-effect',
            trapUsed: false,
            revealedHpCard: null,
            preventKnockoutTargetIds: [],
            faintedColors:
              cookieCard.id === 'BS6-007' || cookieCard.id === 'P-053'
                ? [
                    opp1.cookie.energyColor && opp1.cookie.energyColor !== 'wild'
                      ? opp1.cookie.energyColor
                      : 'red',
                  ]
                : cookieCard.id === 'BS5-085' || cookieCard.id === 'BS5-097'
                  ? ['yellow']
                  : [],
            // Keep the public faint metadata alongside faintedColors.  The
            // latter is the condition key used by the shared effect engine;
            // this richer field makes the fixture traceable to the opponent
            // Cookie that supposedly fainted during the preceding damage.
            ...(cookieCard.id === 'BS6-007' || cookieCard.id === 'P-053'
              ? {
                  faintedCookies: [
                    {
                      playerId: 'player-two' as const,
                      energyColor: opp1.cookie.energyColor,
                      level: opp1.cookie.level,
                    },
                  ],
                }
              : {}),
            attackEffects: cookieCard.attackEffects,
            attackEffectIndex: 0,
          },
    }
  }

  // Activatable / passive / block-triggered skill.
  if (card.skill) {
    const state = baseState()
    if (card.skill.trigger === 'opponent-attack') {
      // Opponent-attack response skills must begin in the real trap response
      // window.  Keeping this state separate from the Activate/passive path
      // makes BS5-092's human Browser fixture exercise payment and the later
      // pendingAbilityEffect target selection instead of showing no button.
      const source = card as CookieCard
      const sourceHpCards = Array.from({ length: source.hp }, (_, index) =>
        testSupportCard(`${card.id}-response-source-hp-${index + 1}`, payColor),
      )
      const attacker = cardCheckFillerCookie(
        'response-attacker',
        2,
        5,
        0,
        'red',
      )
      return {
        ...state,
        firstPlayerId: 'player-two',
        activePlayerId: 'player-two',
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: handFillers,
            battleArea: [
              cardCheckBattleEntry(source, sourceHpCards, 4),
              cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
            ],
            supportArea: energySupports.map((c) => ({ card: c, rested: false })),
            discardPile: trashFillers,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: [
              cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 5, true),
              cardCheckBattleEntry(opp1.cookie, opp1.hpCards, 7),
            ],
          },
        },
        pendingBattle: {
          attackerPlayerId: 'player-two',
          defenderPlayerId: 'player-one',
          attackerInstanceId: attacker.cookie.instanceId,
          // The opponent attacks a Cookie in the defender's battle area.
          // Using the opponent-side filler here made the Browser arrow point
          // across two cards on the same side, which was both misleading and
          // not a legal attack declaration.
          targetInstanceId: selfExtra1.cookie.instanceId,
          declaredDamage: attacker.cookie.attack,
          remainingDamage: attacker.cookie.attack,
          stage: 'trap',
          trapUsed: false,
          revealedHpCard: null,
          preventKnockoutTargetIds: [],
          faintedColors: [],
          attackEffects: [],
          attackEffectIndex: 0,
        },
      }
    }
    if (card.skill.trigger === 'block') {
      // Blocker-style skill: triggers when the opponent attacks another of
      // the player's cookies — mirror createBlockerResponseDemoState.
      const defender = cardCheckFillerCookie('blocker-defender', 2, 5, 0, payColor)
      const attacker = cardCheckFillerCookie('blocker-attacker', 2, 5, 0, 'black')
      const blockerCard = card as CookieCard
      const blockerHpCards = Array.from({ length: blockerCard.hp }, (_, index) =>
        testSupportCard(`${card.id}-blocker-hp-${index + 1}`, payColor),
      )
      return {
        ...state,
        firstPlayerId: 'player-two',
        activePlayerId: 'player-two',
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: handFillers,
            battleArea: [
              cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
              // A deployed Cookie must retain a legal HP stack.  An empty
              // stack made the fixture treat a healthy Blocker as fainted
              // immediately after redirection and opened a replacement loop.
              cardCheckBattleEntry(blockerCard, blockerHpCards, 6),
            ],
            supportArea: energySupports.map((c) => ({ card: c, rested: false })),
            discardPile: trashFillers,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: [
              cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 5, true),
            ],
          },
        },
        pendingBattle: {
          attackerPlayerId: 'player-two',
          defenderPlayerId: 'player-one',
          attackerInstanceId: attacker.cookie.instanceId,
          targetInstanceId: defender.cookie.instanceId,
          declaredDamage: attacker.cookie.attack,
          remainingDamage: attacker.cookie.attack,
          stage: 'trap',
          trapUsed: false,
          revealedHpCard: null,
          preventKnockoutTargetIds: [],
          faintedColors: [],
          attackEffects: [],
          attackEffectIndex: 0,
        },
      }
    }

    if (hasCookieOnPlayEffects(card)) {
      // On-play skills ({ap} in the card text) resolve when the cookie is
      // deployed from hand, not via a battlefield "activate skill" button —
      // mirror createOpponentDiscardHandDemoState / createSt5010OnPlayDemoState:
      // the card sits in hand, ready to deploy into an empty battle-area
      // slot, with the opponent's diverse battle area (and one own-side
      // cookie already on the field) providing legal targets for whatever
      // the on-play effect selects.
      const fromTrashOnPlay = Boolean(card.skill.fromTrashArea)
      const fromSupportOnPlay = Boolean(card.skill.fromSupportArea)
      const fromBreakOnPlay = Boolean(card.skill.onPlayFromBreakArea)
      const bs6091BreakArea =
        card.id === 'BS6-091'
          ? [
              {
                ...card,
                instanceId: 'BS6-091-break-excluded',
              } as CookieCard,
              cardCheckFillerCookie(
                'BS6-091-break-eligible-purple-lv1',
                1,
                2,
                0,
                'purple',
              ).cookie,
              ...ownBreakArea,
            ]
          : ownBreakArea
      const bs6091DiscardPile =
        trashFillers
      const bs6091Hand =
        fromTrashOnPlay
          ? [handCookieFiller, ...handFillers]
          : fromSupportOnPlay
            ? [handCookieFiller, ...handFillers]
          : fromBreakOnPlay
            ? [handCookieFiller, ...handFillers]
          : card.id === 'BS7-074'
            ? [card, ...handFillers.slice(0, 3)]
          : card.id === 'BS7-081'
            ? [card, ...handFillers.slice(0, 2)]
            : [card, handCookieFiller, ...handFillers]
      const bs6091BattleArea =
        fromTrashOnPlay
          ? [
              cardCheckBattleEntry(
                card as CookieCard,
                Array.from({ length: (card as CookieCard).hp }, (_, index) =>
                  testSupportCard(
                    `${card.id}-source-hp-${index + 1}`,
                    'purple',
                  ),
                ),
                6,
              ),
            ]
          : fromSupportOnPlay
            ? [
                cardCheckBattleEntry(
                  card as CookieCard,
                  Array.from({ length: (card as CookieCard).hp }, (_, index) =>
                    testSupportCard(
                      `${card.id}-support-source-hp-${index + 1}`,
                      payColor,
                    ),
                  ),
                  6,
                ),
              ]
          : fromBreakOnPlay
            ? [
                cardCheckBattleEntry(
                  card as CookieCard,
                  Array.from({ length: (card as CookieCard).hp }, (_, index) =>
                    testSupportCard(
                      `${card.id}-break-source-hp-${index + 1}`,
                      payColor,
                    ),
                  ),
                  6,
                ),
              ]
          // BS7-045 plays an Arena Cookie from the support area during its
          // OnPlay resolution. Keep one open battle slot after Kumiho enters;
          // otherwise the legal support candidate is hidden by the real
          // two-Cookie battle-area cap.
          : card.id === 'BS7-045'
            ? []
            : [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6)]
      const bs6091PendingOnPlay =
        fromTrashOnPlay
          ? {
              playerId: 'player-one' as const,
              sourceInstanceId: card.instanceId,
              origin: 'trash' as const,
            }
          : fromSupportOnPlay
            ? {
                playerId: 'player-one' as const,
                sourceInstanceId: card.instanceId,
              origin: 'support' as const,
            }
          : fromBreakOnPlay
            ? {
                playerId: 'player-one' as const,
                sourceInstanceId: card.instanceId,
                origin: 'break' as const,
              }
          : null
      const onPlayArenaSupport = {
        ...cardCheckFillerCookie(
          `${card.id}-onplay-arena-support`,
          1,
          3,
          0,
          'yellow',
        ).cookie,
        instanceId: `${card.id}-onplay-arena-support`,
        keywords: ['arena'] as ['arena'],
      }
      const onPlayPlayerSupportArea =
        card.id === 'BS6-058'
          ? scenarioSupports('BS6-058-player-support', 2, 'green')
          : card.id === 'BS7-045'
            ? [
                ...energySupports.map((c) => ({ card: c, rested: false })),
                { card: onPlayArenaSupport, rested: false },
              ]
          : card.id === 'BS7-061'
            ? [
                ...energySupports.map((c) => ({ card: c, rested: false })),
                ...arenaSupportEntries('BS7-061-onplay-arena', 1, 1, 'green'),
              ]
          : energySupports.map((c) => ({ card: c, rested: false }))
      const onPlayOpponentSupportArea =
        card.id === 'BS6-058'
          ? scenarioSupports('BS6-058-opponent-support', 4, 'green')
          : card.id === 'BS7-044'
            ? scenarioSupports('BS7-044-opponent-support', 3, 'green')
          : []
      return {
        ...state,
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: bs6091Hand,
            battleArea: bs6091BattleArea,
            supportArea: onPlayPlayerSupportArea,
            breakArea: bs6091BreakArea,
            discardPile: bs6091DiscardPile,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: opponentBattleArea,
            supportArea: onPlayOpponentSupportArea,
            stage: { card: opponentStage, rested: false },
            breakArea: opponentBreakArea,
          },
        },
        pendingOnPlay: bs6091PendingOnPlay,
        cookiesPlayedFromTrashThisTurn: fromTrashOnPlay
          ? { 'player-one': true }
          : undefined,
        ...(card.id === 'BS7-016'
          ? {
              // BS7-016 的正向 fixture 讓 On Play 條件直接讀取正式回合旗標。
              arenaCookieDealtEffectDamageThisTurn: {
                'player-one': true,
                'player-two': false,
              },
            }
          : {}),
      }
    }

    if (card.id === 'BS7-013' || card.id === 'BS7-077') {
      // BS7-013／BS7-077 本身是持續被動，單靠 generic card-check 沒有可按的
      // 啟動按鈕；放入一張只供 fixture 使用的 LV.2 紅色【Arena】餅乾，
      // 讓 Browser 能以正式 On Play 效果傷害路徑觀察 +1／未加成 A/B。
      const effectDamageSourceId = `${card.id}-effect-source`
      const effectDamageSource: CookieCard = {
        id: effectDamageSourceId,
        instanceId: `${effectDamageSourceId}-1`,
        name: 'Arena LV.2 效果傷害測試餅乾',
        type: 'cookie',
        level: 2,
        hp: 3,
        attack: 1,
        attackCost: 0,
        energyColor: 'red',
        keywords: ['arena'],
        skill: {
          trigger: 'on-play',
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: { energy: {} },
          text: '測試：造成 1 點效果傷害。',
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      }
      return {
        ...state,
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: [effectDamageSource, ...handFillers],
            battleArea: [
              cardCheckBattleEntry(
                card as CookieCard,
                Array.from({ length: (card as CookieCard).hp }, (_, index) =>
                  testSupportCard(`BS7-013-source-hp-${index + 1}`, 'red'),
                ),
                4,
              ),
            ],
            supportArea: energySupports.map((c) => ({ card: c, rested: false })),
            discardPile: trashFillers,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: opponentBattleArea,
          },
        },
      }
    }

    // 'activate' / 'passive' (and any other non-block, non-on-play
    // trigger): put the card on the battlefield with enough hand/support/
    // trash to pay whatever cost it has, plus a spread of legal targets on
    // both sides.
    const sourceHpCards =
      card.id === 'BS4-005'
        ? [testSupportCard('BS4-005-source-hp')]
        : card.id === 'BS6-055'
          ? Array.from({ length: (card as CookieCard).hp }, (_, index) =>
              testSupportCard(`BS6-055-source-hp-${index + 1}`, 'green'),
            )
        // BS6-001 與 BS7-001 需要從同一張紅色餅乾的 HP 堆支付；card-check
        // 提供完整堆疊，讓支付後仍保留可結算的來源與目標選擇。
        : card.id === 'BS6-001' || card.id === 'BS7-001' || card.id === 'BS7-012'
          ? Array.from({ length: (card as CookieCard).hp }, (_, index) =>
              testSupportCard(`${card.id}-source-hp-${index + 1}`, 'red'),
            )
        : card.id === 'BS5-005'
          ? [testSupportCard('BS5-005-source-hp')]
        : card.id === 'BS5-016'
          ? Array.from({ length: (card as CookieCard).hp }, (_, index) =>
              testSupportCard(`BS5-016-source-hp-${index + 1}`),
            )
        : card.id === 'BS5-023'
          ? Array.from({ length: 3 }, (_, index) =>
              testSupportCard(`BS5-023-source-hp-${index + 1}`),
            )
        : card.id === 'BS6-012'
          ? Array.from({ length: (card as CookieCard).hp }, (_, index) =>
              testSupportCard(`BS6-012-source-hp-${index + 1}`, 'red'),
            )
          : [testSupportCard(`${card.id}-source-hp`)]
    const arenaSkillSupport =
      card.id === 'BS7-049' || card.id === 'BS7-051'
        ? arenaSupportCookie(`${card.id}-arena-support-cost`, 1, 'yellow')
        : card.id === 'BS7-055'
          ? arenaSupportCookie(`${card.id}-support-cookie`, 1, 'green')
          : card.id === 'BS7-057'
            ? arenaSupportCookie(`${card.id}-support-arena-lv2`, 2, 'green')
            : null
    const skillDeck =
      card.id === 'BS7-051'
        ? [
            {
              ...cardCheckFillerCookie(
                'BS7-051-deck-arena',
                1,
                3,
                0,
                'yellow',
              ).cookie,
              keywords: ['arena'] as ['arena'],
            },
            testSupportCard('BS7-051-deck-item-1', payColor),
            testSupportCard('BS7-051-deck-item-2', payColor),
            ...deckFiller('p1').slice(3),
        ]
        : deckFiller('p1')
    const skillHand =
      card.id === 'BS7-068'
        ? handFillers.slice(0, 2)
        : card.id === 'BS5-019' || card.id === 'BS6-032'
          ? [handCookieFiller, ...handFillers]
          : card.id === 'BS6-081'
            ? [...handFillers, testSupportCard('BS6-081-condition-hand', payColor)]
            : card.id === 'BS8-032' || card.id === 'BS8-034' || card.id === 'BS8-039'
              ? [handCookieFiller, ...handFillers]
              : card.id === 'BS8-078'
                ? [bs8BlueLevelTwoHandFixture, ...handFillers.slice(0, 2)]
                : card.id === 'BS8-092'
                  ? handFillers.slice(0, 1)
                  : handFillers
    const skillPlayerSupportArea =
      card.id === 'BS6-055'
        ? scenarioSupports('BS6-055-player-support', 4, 'green')
        : card.id === 'BS8-052' || card.id === 'BS8-057' || card.id === 'BS8-062'
          ? []
          : card.id === 'BS8-061'
            ? energySupports.slice(0, 1).map((c) => ({ card: c, rested: false }))
          : arenaConditionSupportArea
            ? [
                ...energySupports.map((c) => ({ card: c, rested: false })),
                ...arenaConditionSupportArea,
              ]
            : arenaSkillSupport
              ? [
                  ...energySupports.map((c) => ({ card: c, rested: false })),
                  { card: arenaSkillSupport, rested: false },
                ]
              : [...energySupports, ...supportCostCandidates].map((c) => ({
                  card: c,
                  rested: false,
                }))
    const skillOpponentSupportArea =
      card.id === 'BS8-052'
        ? scenarioSupports('BS8-052-opponent-support', 2, 'green')
        : card.id === 'BS8-057' || card.id === 'BS8-062'
          ? scenarioSupports(`${card.id}-opponent-support`, 1, 'green')
          : card.id === 'BS8-061'
            ? scenarioSupports('BS8-061-opponent-support', 3, 'green')
            : card.id === 'BS6-045'
              ? scenarioSupports('BS6-045-opponent-support', 10, 'green')
              : card.id === 'BS6-055'
                ? scenarioSupports('BS6-055-opponent-support', 6, 'green')
                : undefined
    const skillSource = card as CookieCard
    // BS8-011 is a normal Once Per Turn skill on each physical Cookie.  The
    // generic card-check route should expose two real copies as well, so a
    // player can verify that resolving one source does not consume the other
    // source's skill entry.  Keep unique card and HP-stack IDs just as the
    // real deploy path does.
    const bs8011SecondEntry =
      card.id === 'BS8-011'
        ? cardCheckBattleEntry(
            {
              ...skillSource,
              instanceId: `${skillSource.instanceId}-second`,
            },
            Array.from({ length: skillSource.hp }, (_, index) =>
              testSupportCard(`BS8-011-second-source-hp-${index + 1}`, payColor),
            ),
            5,
          )
        : null
    const skillBattleArea = [
      {
        ...cardCheckBattleEntry(skillSource, sourceHpCards, 4),
        ...(card.id === 'BS7-032' || card.id === 'BS7-053' || card.id === 'BS8-113'
          ? { rested: true }
          : {}),
      },
      ...(bs8011SecondEntry
        ? [bs8011SecondEntry]
        : card.id === 'BS7-055' || card.id === 'BS8-032' || card.id === 'BS8-034' || card.id === 'BS8-039' || card.id === 'BS8-120'
          ? []
          : [
              {
                ...cardCheckBattleEntry(
                  selfExtra1.cookie,
                  selfExtra1.hpCards,
                  6,
                ),
                // BS8-028@1／029@1 與 BS8-043 的「本回合從 break 登場」
                // 條件由唯一同伴承載，避免把正在發動的來源錯當成該事件。
                ...(card.id === 'BS8-028' || card.id === 'BS8-029' || card.id === 'BS8-043'
                  ? { enteredFrom: 'break' as const, enteredTurn: state.turnNumber }
                  : {}),
              },
            ]),
    ]
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: skillDeck,
          hand: skillHand,
          battleArea: skillBattleArea,
          supportArea: skillPlayerSupportArea,
          breakArea: ownBreakArea,
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: opponentBattleArea,
          stage: { card: opponentStage, rested: false },
          ...(skillOpponentSupportArea
            ? { supportArea: skillOpponentSupportArea }
            : {}),
          breakArea: opponentBreakArea,
        },
      },
      ...(card.id === 'BS7-004' || card.id === 'BS7-016'
        ? {
            // BS7-004／BS7-016 的正向 Browser fixture 以正式 runtime flag
            // 表示「己方 Arena Cookie 本回合已造成效果傷害」，不直接改寫
            // 技能效果或付款規則。
            arenaCookieDealtEffectDamageThisTurn: {
              'player-one': true,
              'player-two': false,
            },
          }
        : {}),
      ...(card.id === 'BS8-010'
        ? {
            // Red Velvet Cookie's Activate is live only after the owner's
            // Cookie fainted this turn. Preserve that official turn fact in
            // the strict skill fixture rather than accidentally validating
            // its separate attack Then route.
            cookiesFaintedThisTurn: { 'player-one': 1, 'player-two': 0 },
          }
        : {}),
      ...(card.id === 'BS7-027' || card.id === 'BS7-028' || card.id === 'BS7-029' || card.id === 'BS7-032'
        ? {
            // BS7-027 的正向 fixture 以正式回合旗標表示己方 Arena
            // 餅乾本回合已進入休息區，並在 breakArea 保留實體卡作為證據。
            arenaCookiesPlacedInBreakThisTurn: {
              'player-one': 1,
              'player-two': 0,
            },
          }
        : {}),
    }
  }

  // No skill/flip/attackEffects/item/trap/stageAbility text: a vanilla
  // cookie. Light check only — verify it can be deployed and can attack.
  const state = baseState()
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [card, ...handFillers],
        battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 4)],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: opponentBattleArea,
      },
    },
  }
}

/**
 * Localhost-only BS8-011 duplicate-source fixture.
 *
 * Saffron Buffalo Shaman is Once Per Turn per card instance, not a global
 * per-name limit. The fixture exposes two real BS8-011 Cookie entries with
 * unique card/battle-entry IDs and full HP, so Browser validation can activate
 * one source and then verify the other remains available in the same turn.
 */
export const createBs8011DoubleSkillDemoState = (): GameState => {
  const state = createCardCheckDemoState('BS8-011')
  const player = state.players['player-one']
  const source = player.battleArea.find(
    (entry) => entry.card.id === 'BS8-011',
  )
  if (!source || source.card.type !== 'cookie' || !source.card.skill) {
    throw new Error(
      'BS8-011 duplicate-skill fixture requires a Cookie skill source',
    )
  }

  const sourceCard = source.card as CookieCard
  const makeEntry = (instanceId: string, sequence: number) =>
    cardCheckBattleEntry(
      { ...sourceCard, instanceId },
      Array.from({ length: sourceCard.hp }, (_, index) =>
        testSupportCard(`bs8-011-double-${sequence}-hp-${index + 1}`, 'red'),
      ),
      sequence,
    )

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: [
          makeEntry('player-one-BS8-011-double-a', 21),
          makeEntry('player-one-BS8-011-double-b', 22),
        ],
      },
    },
    skillUsesThisTurn: [],
    pendingBattle: null,
    pendingOnPlay: null,
  }
}

/**
 * BS2-015 支付「將這個餅乾放入棄牌區」後的兩條正式流程：
 * 手牌沒有餅乾時立即敗北；有餅乾時先強制補位，再繼續結算技能。
 */
/**
 * Focused P-082 fixture for validating both official alternative payments.
 * The cookie route deliberately provides one non-FLIP LV.1 Cookie with 1 HP
 * in the trash; the energy route leaves that candidate out.
 */
/**
 * Builds the generic Browser B fixture for a formal card.
 *
 * The card remains in the same placement and timing as the positive
 * card-check state, but every support card is rested. This makes coloured
 * energy and support-card costs unavailable while preserving the real UI
 * entry point for the negative browser path.
 */
export const createCardNegativeDemoState = (
  cardNumber: string,
  options: { preferSkillSurface?: boolean } = {},
): GameState => {
  const state = createCardCheckDemoState(cardNumber, options)
  const player = state.players['player-one']
  const baseCardNumber = cardNumber.split('@')[0]
  if (baseCardNumber === 'BS8-005') {
    // Keep the card in EXTRA Deck and make only its official faint-count
    // requirement fail; this is the negative Browser path for the same
    // `card-negative:` entry point, not an unrelated energy failure.
    return createBs8ExtraDeckDemoState(false)
  }
  const negativeDiscardPile =
    cardNumber === 'BS5-093' || cardNumber.startsWith('BS5-093@')
      ? player.discardPile.filter(
          (card) =>
            card.id !== 'BS5-093-purple-cookie-2' &&
            card.id !== 'BS5-093-purple-cookie-3',
        )
      : cardNumber === 'BS5-092' || cardNumber.startsWith('BS5-092@')
        ? player.discardPile.filter((card) => card.type === 'cookie')
        : player.discardPile
  if (baseCardNumber === 'BS8-028' || baseCardNumber === 'BS8-029') {
    // 正向 Browser fixture 以同伴的本回合 Break 登場事件滿足合併技能的
    // 條件；B 路徑必須移除那個真實狀態，不能僅把無關支援卡改為休息。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) => {
        const rest = { ...entry }
        delete rest.enteredFrom
        delete rest.enteredTurn
        return rest
      }),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: true,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS8-061') {
    // Preserve the green attack payment, but remove the two-card support gap.
    // The negative Browser route therefore proves the passive +1 attack is
    // absent while the source can still declare its printed attack.
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          supportArea: player.supportArea.slice(0, 1).map((support) => ({
            ...support,
            rested: false,
          })),
          discardPile: negativeDiscardPile,
        },
        'player-two': {
          ...state.players['player-two'],
          supportArea: state.players['player-two'].supportArea.slice(0, 1).map(
            (support) => ({ ...support, rested: false }),
          ),
        },
      },
    }
  }
  if (baseCardNumber === 'BS8-075') {
    // Keep the green stage-placement payment live, but lower the support count
    // below six so the post-placement neutral attack surcharge is absent.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.slice(0, 5).map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS8-125') {
    // Replacing the fixture's old stage moves that card to trash.  Start at
    // thirteen so the real placement ends at fourteen, below the printed
    // fifteen-card threshold; Dark Cacao must therefore keep its purple
    // attack payment in the Browser B path.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile.slice(0, 13),
    })
  }
  // Keep the negative route meaningful for cards whose legality depends on a
  // board condition rather than only on payment.  BS6-042 must be blocked by
  // its "3 Cookies in break" condition while leaving payment energy active;
  // BS6-043 must reach its end-phase trigger with no yellow Cookie in hand so
  // the mandatory first step is skipped by the real effect queue.
  if (baseCardNumber === 'BS6-042') {
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      breakArea: player.breakArea.slice(0, 2),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS6-043') {
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      hand: player.hand.filter((card) => card.type !== 'cookie'),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS6-021') {
    // Keep the red placement/activation payment available, but remove the
    // LV.2+ target so the Then draw condition is provably unmet.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) => ({
        ...entry,
        card: { ...entry.card, level: 1 },
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS6-016') {
    // The positive BS6-016 card-check fixture intentionally starts at 1 HP.
    // Restore the Cookie to full HP here so the negative route proves the
    // remaining-HP condition blocks the Then effect rather than relying on an
    // unrelated unavailable payment.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) =>
        entry.card.id === 'BS6-016'
          ? {
              ...entry,
              hpCards: Array.from({ length: entry.card.hp }, (_, index) =>
                testSupportCard('BS6-016-negative-hp-' + (index + 1)),
              ),
            }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS6-018') {
    // Preserve the real attack declaration path and legal payment, but keep
    // White Choco at full HP so its "remaining HP is 1" follow-up is blocked.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) =>
        entry.card.id === 'BS6-018'
          ? {
              ...entry,
              hpCards: [
                ...entry.hpCards,
                testSupportCard('BS6-018-negative-hp'),
              ],
              rested: false,
            }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-001') {
    // 保留自身 HP 費用的合法選項，僅將正向路徑的唯一 LV.3 目標降為 LV.2。
    // Browser B 因此能證明規則層不會讓「最多 1 張己方 LV.3」誤選 LV.2，
    // 而不是退化成只因沒有能量而無法操作。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, level: 2 } }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-002' || baseCardNumber === 'BS7-025' || baseCardNumber === 'BS7-030') {
    // 保留同色同伴與附著的 LV.2 餅乾，只移除【Arena】關鍵字；Browser B
    // 因此驗證的是官方的「指定顏色【Arena】Cookie」合併條件，而非付款或等級。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-003') {
    // 保留紅色／能量支付，僅移除另一張餅乾的【Arena】關鍵字；Browser B
    // 因此驗證的是「another Arena Cookie」條件，而不是因為沒有能量而無法登場。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-004') {
    // 保留紅色付款能量與對手目標，只清除「Arena Cookie 已造成效果傷害」
    // 的回合旗標，讓 Browser B 針對真正的條件失敗，而不是支付失敗。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookieDealtEffectDamageThisTurn: {
          'player-one': false,
          'player-two': false,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-010') {
    // 保留昏厥 pending effect 與對手目標，只移除己方同伴的【Arena】關鍵字；
    // Browser B 因此驗證的是條件失敗，而不是因為沒有可選目標或支付失敗。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-011') {
    // 保留紅色同伴與 FLIP 翻牌流程，只移除同伴的【Arena】關鍵字；
    // Browser B 因此證明雙重條件中的場上條件會阻擋抽牌，而不是因為
    // 沒有 pending FLIP 或沒有牌庫可抽。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-012') {
    // 保留啟動技能所需的來源餅乾與支援區支付，但移除戰鬥區所有
    // Arena 關鍵字；Browser B 因此會在真正的 HP payment 邊界被阻擋，
    // 而不是用疲勞支援卡掩蓋條件。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) => ({
        ...entry,
        card: { ...entry.card, keywords: [] },
      })),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-013' || baseCardNumber === 'BS7-077') {
    // 保留 BS7-013／BS7-077 光環與測試餅乾的正式 On Play 傷害路徑，只移除
    // 傷害來源餅乾的 Arena 關鍵字；Browser B 會由 2 點降為 1 點，
    // 證明顏色／等級／關鍵字 selector 確實參與效果傷害計算。
    return updateDemoPlayer(state, 'player-one', {
      hand: player.hand.map((card) =>
        card.id === `${baseCardNumber}-effect-source`
          ? { ...card, keywords: [] }
          : card,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-014') {
    // 保留 Activate 的棄牌／LV.2+ 傷害流程，但移除 Kouign-Amann 名稱，
    // 讓 Browser B 只阻擋靜態 +1 攻擊光環，不是因為支付或目標不足。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, name: 'self-extra-1' } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-016') {
    // 只清除回合效果傷害旗標；保留登場、抽牌與牌庫資料，讓 Browser B
    // 證明條件不成立，而不是被支付或目標缺失提早擋住。
    return {
      ...state,
      arenaCookieDealtEffectDamageThisTurn: {
        'player-one': false,
        'player-two': false,
      },
      players: {
        ...state.players,
        'player-one': {
          ...player,
          supportArea: player.supportArea.map((support) => ({
            ...support,
            rested: false,
          })),
          discardPile: negativeDiscardPile,
        },
      },
    }
  }
  if (baseCardNumber === 'BS7-017') {
    // 保留 2 HP 的同伴與所有手牌／牌庫資料，只移除 Arena 關鍵字，讓
    // Browser B 走到同一張 On Play 的抽 2／棄 1 UI 後證明條件不成立。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-018' || baseCardNumber === 'BS7-019' || baseCardNumber === 'BS7-021' || baseCardNumber === 'BS7-024' || baseCardNumber === 'BS7-026') {
    // 保留攻擊後目標／支付流程。BS7-018/019/021 的效果明確是「another」
    // Arena，因此只移除同伴；BS7-024 的 HP 回手代價則可選攻擊來源本身，
    // 所以要把來源與同伴的 Arena 關鍵字都移除，Browser B 才能證明沒有
    // 合法 HP 候選而略過追加傷害。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        baseCardNumber === 'BS7-024'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-027') {
    // 保留黃色支付與戰鬥區 Cookie，但清除「本回合 Arena 餅乾進入休息區」
    // 的事件旗標並移除 breakArea 證據；Browser B 因此驗證條件失敗，而非
    // 因為能量不足或沒有合法 Cookie 目標。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookiesPlacedInBreakThisTurn: {
          'player-one': 0,
          'player-two': 0,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        breakArea: player.breakArea.filter(
          (breakCard) => !breakCard.keywords?.includes('arena'),
        ),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-028' || baseCardNumber === 'BS7-029' || baseCardNumber === 'BS7-032') {
    // 保留技能與黃色支付，但清除本回合 Arena 餅乾進入休息區的事件旗標，
    // 讓 Browser B 走條件阻擋而不是能量不足。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookiesPlacedInBreakThisTurn: {
          'player-one': 0,
          'player-two': 0,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        breakArea: player.breakArea.filter(
          (breakCard) => !breakCard.keywords?.includes('arena'),
        ),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-033') {
    // 保留登場流程與對手目標，但移除唯一其他餅乾的 Arena 關鍵字；
    // Browser B 會在第一段沒有合法目標時阻擋，而不是因為支付失敗。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-035') {
    // 保留 OnPlay 來源目標與支付流程，只移除 Capsaicin Cookie 名稱；
    // Browser B 因此證明名稱條件不成立，而不是沒有來源卡。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, name: 'self-extra-1' } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-036') {
    // 保留 OnPlay 的 no-Skill 目標位置，只移除唯一同伴的 Arena 關鍵字；
    // Browser B 會在 Arena selector 沒有候選時阻擋。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-037') {
    // 保留自身送入休息區的 Activate 代價與對手目標，只移除另一張
    // 黃色 Arena Cookie；Browser B 因條件失敗而不建立 1 點傷害目標。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-038') {
    // 保留手牌 Cookie 與攻擊後第一段，僅移除既有休息區 Cookie 的 Arena
    // 關鍵字；Browser B 仍能實際放牌，但第二段返回手牌沒有合法候選。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      breakArea: player.breakArea.map((breakCard) => ({
        ...breakCard,
        keywords: [],
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-039') {
    // 保留黃色支付與攻擊目標，只清除「Arena Cookie 已進入休息區」事件；
    // Browser B 因此驗證全體 1 傷害的條件分支，而非支付失敗。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookiesPlacedInBreakThisTurn: {
          'player-one': 0,
          'player-two': 0,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-040') {
    // 保留昏厥觸發與黃色來源能量，僅移除己方目標的 Arena 關鍵字；
    // Browser B 因此證明「最多 1 張己方 Arena」沒有合法目標。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-041') {
    // 保留物品支付與攻擊目標，只清除本回合 Arena Cookie 進入休息區旗標；
    // Browser B 會略過 +1 攻擊段，但仍可進入後續抽牌段。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookiesPlacedInBreakThisTurn: {
          'player-one': 0,
          'player-two': 0,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-042') {
    // 保留陷阱攻擊回應與第一段 -1 攻擊，僅將自己的 Arena 休息區候選降至
    // 2 張；Browser B 因 Then 的「至少 3 張」條件不成立而不套用第二段。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      breakArea: player.breakArea.slice(0, 2),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-043') {
    // 保留場景放置與黃色啟動能量，但清除本回合 Arena Cookie 進入休息區
    // 的事件旗標與 break 區證據；Browser B 會在真正的 HP 條件分支被略過。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookiesPlacedInBreakThisTurn: {
          'player-one': 0,
          'player-two': 0,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        breakArea: player.breakArea.filter(
          (breakCard) => !breakCard.keywords?.includes('arena'),
        ),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-044') {
    // 保留來源餅乾的 OnPlay 視窗，但將對手支援區全部預先橫置；Browser B
    // 因「最多橫置 2 張」沒有合法候選而略過效果。
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          supportArea: player.supportArea.map((support) => ({
            ...support,
            rested: false,
          })),
          discardPile: negativeDiscardPile,
        },
        'player-two': {
          ...state.players['player-two'],
          supportArea: state.players['player-two'].supportArea.map((support) => ({
            ...support,
            rested: true,
          })),
        },
      },
    }
  }
  if (baseCardNumber === 'BS7-045') {
    // 保留 OnPlay 來源與流程，只移除唯一的 Arena 支援區 Cookie，驗證
    // 「Play up to 1 Arena Cookie」的目標篩選。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-046') {
    // 保留支援區登場的 OnPlay 視窗，但清空手牌使「棄置 1 張牌」代價
    // 真正不可支付；不可把後續牌庫頂效果誤當成已執行。
    return updateDemoPlayer(state, 'player-one', {
      hand: [],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-048') {
    // 保留綠色來源能量，移除手牌中的 Arena 卡；Browser B 會在昏厥
    // 的關鍵字目標邊界被阻擋，而不是因為替代能量不可支付。
    return updateDemoPlayer(state, 'player-one', {
      hand: player.hand.filter((card) => !card.keywords?.includes('arena')),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-050') {
    // 保留昏厥待處理與對手橫置目標，但移除所有支援區卡牌；Browser B
    // 因「返回 1 張支援卡」代價無法支付而只能略過，不會誤套用傷害。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: [],
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-049' || baseCardNumber === 'BS7-051') {
    // 保留主動技能來源與一般能量，但移除唯一可支付的【Arena】支援卡；
    // Browser B 因官方尖括號代價無法支付而不能啟動技能。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-053' || baseCardNumber === 'BS7-058') {
    // 保留同一張正式來源與一般能量，但移除 5 張 Arena 支援卡；Browser B
    // 因此驗證支援區關鍵字門檻失敗，而不是把任意支援卡誤算成 Arena。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-054') {
    // On Play 的第一段是「返回 1 張支援卡」代價；清空支援區後應在
    // 真正的代價邊界阻擋，不得直接執行後續放置效果。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: [],
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-055') {
    // 保留 Activate 的來源與回合條件，只移除支援區 Cookie 候選；能量
    // 支援仍在場，Browser B 針對「Play 1 Cookie」的目標邊界驗證。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => support.card.type !== 'cookie')
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-056' || baseCardNumber === 'BS7-062') {
    // 保留正式 FLIP 戰鬥流程與附著卡，只移除綠色 Arena 同伴；Browser B
    // 因此分別驗證場上顏色／關鍵字條件，而不是牌庫或 HP 目標缺失。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? {
              ...entry,
              card: {
                ...entry.card,
                keywords: [],
                energyColor: 'green',
              },
            }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-057') {
    // 保留綠色能量支付，但移除 LV.2+ Arena 支援餅乾；因此 Activate
    // 不會建立合法選擇，避免將任意能量支援卡當成登場目標。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-059') {
    // 這張卡的 card-check 正向路徑驗證「從支援區登場」的 On Play；
    // 反向移除對手餅乾，讓可選 2 傷害效果保持可發動但沒有目標。
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          supportArea: player.supportArea.map((support) => ({
            ...support,
            rested: false,
          })),
          discardPile: negativeDiscardPile,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [],
        },
      },
    }
  }
  if (baseCardNumber === 'BS7-060') {
    // Browser B must prove the source-zone gate, not merely skip an optional
    // draw. Move the test Cookie back to hand and clear the pending support
    // placement so deploying it from hand does not create the OnPlay window.
    const sourceEntry = player.battleArea.find(
      (entry) => entry.card.id === baseCardNumber,
    )
    if (!sourceEntry) return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
    return updateDemoPlayer(
      { ...state, pendingOnPlay: null },
      'player-one',
      {
        hand: [sourceEntry.card, ...player.hand],
        battleArea: player.battleArea.filter(
          (entry) => entry.card.instanceId !== sourceEntry.card.instanceId,
        ),
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-061') {
    // 保留 On Play 的抽牌效果與其他能量支援，只移除 Arena 支援代價。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-063') {
    // 保留綠色能量支付與檢視 3 張流程，但把牌庫頂的 Arena 候選改成
    // 一般卡，Browser B 因此證明關鍵字篩選而不是付款失敗。
    return updateDemoPlayer(state, 'player-one', {
      deck: player.deck.map((card) => ({ ...card, keywords: [] })),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-064') {
    // 保留綠色能量與第一段攻擊下降，只移除棄牌區 Cookie 候選；
    // Browser B 因此不會誤執行 Then 的「回到支援區」移動。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile.filter((card) => card.type !== 'cookie'),
    })
  }
  if (baseCardNumber === 'BS7-065') {
    // 保留場景啟動與能量支援，只移除支援區的 Arena Cookie；登場段可
    // 略過且不應錯誤執行「If you do」抽牌。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea
        .filter((support) => !support.card.keywords?.includes('arena'))
        .map((support) => ({ ...support, rested: false })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-068') {
    // 正向只有兩張手牌，反向補到四張；回合結束效果仍可被觀察，但不再
    // 需要抽牌，證明「直到 4 張」的動態上限。
    return updateDemoPlayer(state, 'player-one', {
      hand: [
        ...player.hand,
        testSupportCard('BS7-068-negative-hand-1', 'blue'),
        testSupportCard('BS7-068-negative-hand-2', 'green'),
      ],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-081') {
    // Keep the real On Play deployment and blue payment path, but leave four
    // cards after the tested Cookie enters the battle area so the "3 cards or
    // less" condition is demonstrably false rather than payment-blocked.
    return updateDemoPlayer(state, 'player-one', {
      hand: [
        ...player.hand,
        testSupportCard('BS7-081-negative-extra-hand-1', 'blue'),
        testSupportCard('BS7-081-negative-extra-hand-2', 'green'),
      ],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-083') {
    // 保留手牌門檻，但移除另一張 Arena Cookie，讓「another Arena」條件
    // 失敗而不建立抽牌決策。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-086') {
    // 保留藍色能量與場景啟動，只移除藍色 Arena 手牌代價。
    return updateDemoPlayer(state, 'player-one', {
      hand: player.hand.filter(
        (card) => card.id === baseCardNumber || !card.keywords?.includes('arena'),
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-085') {
    // 保留藍色支付與第一段攻擊下降，但讓支付後手牌超過 2 張，
    // 並移除己方 Arena 關鍵字；Browser B 只跳過條件式抽牌 Then。
    return updateDemoPlayer(state, 'player-one', {
      hand: [
        ...player.hand,
        testSupportCard('BS7-085-negative-hand-1', 'blue'),
        testSupportCard('BS7-085-negative-hand-2', 'green'),
      ],
      battleArea: player.battleArea.map((entry) => ({
        ...entry,
        card: { ...entry.card, keywords: [] },
      })),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-090') {
    // 保留昏厥流程與兩張手牌代價，只把牌庫頂的 Arena 牌替換成普通卡；
    // 檢視 5 張仍會完成，但不會有合法加入手牌的候選。
    return updateDemoPlayer(state, 'player-one', {
      deck: player.deck.map((card) => ({ ...card, keywords: [] })),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-096' || baseCardNumber === 'BS7-100') {
    // FLIP A/B 保留附著目標與手牌數，只移除紫色 Arena 同伴。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? {
              ...entry,
              card: {
                ...entry.card,
                keywords: [],
                energyColor: 'purple',
              },
            }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-105') {
    // 保留紫色雙能量支付，只移除棄牌區 Arena Cookie；Then +1 HP 不應執行。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: player.discardPile.filter(
        (card) => !card.keywords?.includes('arena'),
      ),
    })
  }
  if (baseCardNumber === 'BS7-106') {
    // 保留紫色能量與棄 1 張手牌代價，只移除棄牌區 Arena Cookie；
    // Browser B 仍可結算第一段攻擊下降，但無法進入回收 Then。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: player.discardPile.filter(
        (card) => !card.keywords?.includes('arena'),
      ),
    })
  }
  if (baseCardNumber === 'BS7-107') {
    // 保留場景啟動與牌庫底效果，只移除棄牌區中沒有 FLIP 的 Arena
    // Cookie 候選，Browser B 會看到 0 張合法卡可選。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: player.discardPile.filter(
        (card) => !card.keywords?.includes('arena'),
      ),
    })
  }
  if (baseCardNumber === 'BS7-108') {
    // 保留無色支付、對手 LV.3 目標與第一段 -1 攻擊，將己方休息區
    // 降為不足 3 級差；Browser B 因此只略過條件式第二段 -2。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      breakArea: [],
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-066' || baseCardNumber === 'BS7-067') {
    // 保留攻擊後目標與流程，只移除 Arena 手牌代價；Browser B 不得把
    // 一般手牌誤當作合法支付。
    return updateDemoPlayer(state, 'player-one', {
      hand: player.hand.filter((card) => !card.keywords?.includes('arena')),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-069') {
    // 保留棄 2 張手牌的 Activate 代價，但移除另一張餅乾的 Arena 關鍵字，
    // 讓技能在無合法目標時不產生攻擊修正。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-072' || baseCardNumber === 'BS7-078') {
    // 保留正式 FLIP／附著目標，只移除藍色 Arena 同伴，讓條件分支失敗。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-073') {
    // 保留 LV.1 攻擊目標，但把手牌增加到 4 張，證明低手牌門檻會阻擋
    // 3 點追加傷害而不是因為攻擊目標不存在。
    return updateDemoPlayer(state, 'player-one', {
      hand: [...player.hand, testSupportCard('BS7-073-negative-extra-hand', 'blue')],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-070') {
    // 保留藍色能量與攻擊後抽牌，只移除另一張藍色 Arena Cookie；第一段
    // 牌庫底目標因此不成立，Browser B 不會誤移除一般餅乾。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? {
              ...entry,
              card: { ...entry.card, keywords: [], energyColor: 'blue' },
            }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-094') {
    // Keep the purple attack payment available while removing the 30 Arena
    // trash cards that satisfy Tea Knight's passive +3 attack condition.
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: player.discardPile.filter(
        (card) => !card.keywords?.includes('arena'),
      ),
    })
  }
  if (baseCardNumber === 'BS7-088' ||
      baseCardNumber === 'BS7-095' ||
      baseCardNumber === 'BS7-097' ||
      baseCardNumber === 'BS7-098' ||
      baseCardNumber === 'BS7-101' ||
      baseCardNumber === 'BS7-102' ||
      baseCardNumber === 'BS7-103') {
    // 保留紫色能量與攻擊目標，只移除棄牌區 Arena 候選；各卡的 Then
    // 條件／洗回代價因此在正式 runtime 入口被擋下。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: player.discardPile.filter(
        (card) => !card.keywords?.includes('arena'),
      ),
    })
  }
  if (baseCardNumber === 'BS7-089') {
    // 保留攻擊流程，但將對手手牌降到 5 張，證明「至少 6 張」是攻擊後
    // 隨機棄牌的真正條件，而不是因為對手沒有手牌 UI。
    const updated = updateDemoPlayer(state, 'player-one', {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      })
    return {
      ...updated,
      players: {
        ...updated.players,
        'player-two': {
          ...updated.players['player-two'],
          hand: updated.players['player-two'].hand.slice(0, 5),
        },
      },
    }
  }
  if (baseCardNumber === 'BS7-091') {
    // 牌庫為空時「最多 3 張」自然結算為 0 張，仍保留攻擊後流程可走完。
    return updateDemoPlayer(state, 'player-one', {
      deck: [],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-074') {
    // On Play 正向路徑剛好 3 張手牌；反向增加 1 張，讓「3 張或以下」
    // 條件明確不成立。
    return updateDemoPlayer(state, 'player-one', {
      hand: [...player.hand, testSupportCard('BS7-074-negative-extra-hand', 'blue')],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-075') {
    // 保留昏厥待處理與牌庫，只移除 Arena 手牌代價，避免錯誤抽牌。
    return updateDemoPlayer(state, 'player-one', {
      hand: player.hand.filter((card) => !card.keywords?.includes('arena')),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-076') {
    // 保留來源放回牌庫底的代價與技能流程，只移除另一張藍色 Arena Cookie。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-079') {
    // Keep the real opponent-attack response window open, but remove the
    // single discard candidate.  Browser B therefore proves the response
    // cannot be declared without its printed hand cost.
    return updateDemoPlayer(state, 'player-one', {
      hand: [],
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-020') {
    // 保留紅色支付與 LV.1 對手目標，只把己方休息區降回一般等級，
    // 讓 Browser B 證明「高出對手至少 2 級」條件被阻擋。
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      breakArea: player.breakArea.map((breakCard) => ({
        ...breakCard,
        level: 2,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS7-022') {
    // 保留場景放置與紅色 Activate 付款，只清除本回合 Arena 效果傷害旗標，
    // 讓 Browser B 證明追加傷害條件未成立而非付款不可用。
    return updateDemoPlayer(
      {
        ...state,
        arenaCookieDealtEffectDamageThisTurn: {
          'player-one': false,
          'player-two': false,
        },
      },
      'player-one',
      {
        supportArea: player.supportArea.map((support) => ({
          ...support,
          rested: false,
        })),
        discardPile: negativeDiscardPile,
      },
    )
  }
  if (baseCardNumber === 'BS7-015') {
    // 保留攻擊後的實際目標與支付流程，只移除另一張餅乾的 Arena 關鍵字；
    // Browser B 因條件不成立而不再追加 2 傷害。
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.instanceId === 'self-extra-1'
          ? { ...entry, card: { ...entry.card, keywords: [] } }
          : entry,
      ),
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'BS6-007') {
    // Keep the attack and two active opponent supports available, but clear
    // the recorded faint metadata.  This makes the negative route prove that
    // Blue Slushy's conditional rest-support effect is skipped for the actual
    // reason (no opponent Cookie fainted), rather than because payment failed.
    const withoutFaintEvidence = state.pendingBattle
      ? {
          ...state,
          pendingBattle: {
            ...state.pendingBattle,
            faintedColors: [],
            faintedCookies: [],
          },
        }
      : state
    return updateDemoPlayer(withoutFaintEvidence, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      discardPile: negativeDiscardPile,
    })
  }
  if (baseCardNumber === 'P-053') {
    // The positive fixture records the attacked opponent Cookie as fainted so
    // the post-battle deck-to-support effect is observable. The negative
    // route keeps the same resolved attack window but removes that evidence.
    return state.pendingBattle
      ? {
          ...state,
          pendingBattle: {
            ...state.pendingBattle,
            faintedColors: [],
            faintedCookies: [],
          },
        }
      : state
  }
  if (baseCardNumber === 'P-130') {
    // P-130's printed HP is below its attack-follow-up threshold. The
    // positive fixture supplies the gained HP; return to printed HP here so
    // the negative path proves the threshold blocks target selection.
    return updateDemoPlayer(state, 'player-one', {
      battleArea: player.battleArea.map((entry) =>
        entry.card.id === 'P-130'
          ? {
              ...entry,
              hpCards: Array.from({ length: entry.card.hp }, (_, index) =>
                testSupportCard(`P-130-negative-hp-${index + 1}`),
              ),
            }
          : entry,
      ),
    })
  }
  if (baseCardNumber === 'BS6-013') {
    // Retain the real attacker but remove the second same-name Cookie.  The
    // attack-after condition must therefore be false while the rest of the
    // attack fixture remains intact.
    const sourceInstanceId = state.pendingBattle?.attackerInstanceId
    return updateDemoPlayer(state, 'player-one', {
      supportArea: player.supportArea.map((support) => ({
        ...support,
        rested: false,
      })),
      battleArea: player.battleArea.filter(
        (entry) => entry.card.instanceId === sourceInstanceId,
      ),
      discardPile: negativeDiscardPile,
    })
  }
  return updateDemoPlayer(state, 'player-one', {
    supportArea: player.supportArea.map((support) => ({
      ...support,
      rested: true,
    })),
    discardPile: negativeDiscardPile,
  })
}

/**
 * Local Browser A/B fixture for BS6-079's OnPlay movement target.
 * `blocked` uses the real BS6-010 card record so the UI can prove both the
 * valid-target path and the Timekeeper movement-protection path.
 */
export const createBs6079OnPlayDemoState = (blocked: boolean): GameState => {
  const handState = createCardCheckDemoState('BS6-079')
  const handSource = handState.players['player-one'].hand.find(
    (card) => card.id === 'BS6-079',
  )
  if (!handSource) throw new Error('BS6-079 Browser fixture hand card is missing')

  // Exercise the same legal command as the normal UI instead of manufacturing
  // a battlefield card. This keeps the dedicated A/B fixture faithful to the
  // OnPlay flow while still leaving the pending effect open for the blocker
  // comparison below.
  const state = applyGameCommand(handState, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: handSource.instanceId,
  })
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS6-079',
  )
  if (!source) throw new Error('BS6-079 Browser fixture source is missing')

  let blocker: CookieCard | undefined
  if (blocked) {
    const blockerCard = getCardCheckCard('BS6-010')
    if (blockerCard.type !== 'cookie') {
      throw new Error('BS6-010 Browser fixture blocker is not a Cookie')
    }
    blocker = { ...blockerCard, instanceId: 'demo-bs6-010' }
  }

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    pendingBattle: null,
    pendingAbilityEffect: undefined,
    pendingOnPlay: {
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      origin: 'hand',
    },
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        battleArea: blocker
          ? [cardCheckBattleEntry(blocker, [], 1)]
          : state.players['player-two'].battleArea,
      },
    },
  }
}

/**
 * BS4-026 登場效果的正式卡池 A/B fixture。反向情境保留對手原本的 LV.1
 * 合法目標，再放入真正的 BS6-010，確保紀錄說明的是「被阻止」而不是「沒有目標」。
 */
export const createBs4026OnPlayDemoState = (blocked: boolean): GameState => {
  const cardCheckState = createCardCheckDemoState('BS4-026')
  const battleSource = cardCheckState.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS4-026',
  )
  if (!battleSource || battleSource.card.type !== 'cookie') {
    throw new Error('BS4-026 Browser fixture source is missing')
  }

  // The generic BS4-026 card-check state keeps the source in the battle area
  // so its OnPlay target selector is available. Move that same official card
  // back to hand, then use the real deploy command for this dedicated route.
  const handState: GameState = {
    ...cardCheckState,
    pendingBattle: null,
    players: {
      ...cardCheckState.players,
      'player-one': {
        ...cardCheckState.players['player-one'],
        hand: [
          battleSource.card,
          ...cardCheckState.players['player-one'].hand,
        ],
        battleArea: cardCheckState.players['player-one'].battleArea.filter(
          (entry) => entry.card.instanceId !== battleSource.card.instanceId,
        ),
      },
    },
  }

  const state = applyGameCommand(handState, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: battleSource.card.instanceId,
  })
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS4-026',
  )
  if (!source) throw new Error('BS4-026 Browser fixture source is missing')

  if (!blocked) {
    return {
      ...state,
      activePlayerId: 'player-one',
      phase: 'main',
      pendingBattle: null,
      pendingAbilityEffect: undefined,
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
        origin: 'hand',
      },
    }
  }

  const blockerCard = getCardCheckCard('BS6-010')
  if (blockerCard.type !== 'cookie') {
    throw new Error('BS6-010 Browser fixture blocker is not a Cookie')
  }
  const blocker = { ...blockerCard, instanceId: 'demo-bs6-010' }

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    pendingBattle: null,
    pendingAbilityEffect: undefined,
    pendingOnPlay: {
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      origin: 'hand',
    },
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          cardCheckBattleEntry(blocker, [], 1),
          ...state.players['player-two'].battleArea,
        ],
      },
    },
  }
}

/**
 * BS6-031 的攻擊後效果由正式卡池卡片與 `resolve-attack-effect` 指令建立。
 * `payable=false` 只橫置支援區，保留完整待支付視窗以驗證玩家提示與紀錄。
 */
export const createBs6031AttackAfterDemoState = (payable: boolean): GameState => {
  const cardCheckState = createCardCheckDemoState('BS6-031')
  const handSource = cardCheckState.players['player-one'].hand.find(
    (card) => card.id === 'BS6-031',
  )
  if (!handSource || handSource.type !== 'cookie' || !handSource.attackEffects?.length) {
    throw new Error('BS6-031 Browser fixture attack card is missing')
  }

  const sourceHpCards = Array.from({ length: handSource.hp }, (_, index) =>
    testSupportCard(`BS6-031-attack-hp-${index + 1}`, 'yellow'),
  )
  const attackState: GameState = {
    ...cardCheckState,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...cardCheckState.players,
      'player-one': {
        ...cardCheckState.players['player-one'],
        hand: cardCheckState.players['player-one'].hand.filter(
          (card) => card.instanceId !== handSource.instanceId,
        ),
        battleArea: [
          cardCheckBattleEntry(handSource, sourceHpCards, 4, true),
          ...cardCheckState.players['player-one'].battleArea,
        ],
        supportArea: cardCheckState.players['player-one'].supportArea.map(
          (support) => ({ ...support, rested: !payable }),
        ),
      },
    },
    pendingBattle: {
      attackerPlayerId: 'player-one',
      defenderPlayerId: 'player-two',
      attackerInstanceId: handSource.instanceId,
      targetInstanceId: cardCheckState.players['player-two'].battleArea[0].card.instanceId,
      declaredDamage: handSource.attack,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: handSource.attackEffects,
      attackEffectIndex: 0,
    },
  }

  return applyGameCommand(attackState, {
    kind: 'resolve-attack-effect',
    playerId: 'player-one',
    targetIds: [],
  })
}

/**
 * BS4-077 的自我回牌庫底是尖括號內的發動代價，不是效果；即使 BS6-010
 * 在對手戰鬥區，仍須能從正式 UI 發動，並在紀錄標出兩者的差異。
 */
export const createBs4077TimekeeperCostDemoState = (): GameState => {
  const state = createCardCheckDemoState('BS4-077')
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS4-077',
  )
  const timekeeper = getCardCheckCard('BS6-010')
  if (!source || timekeeper.type !== 'cookie') {
    throw new Error('BS4-077 Timekeeper cost fixture requires both official Cookies')
  }

  const blueAlly = scenarioCookie('bs4-077-blue-ally', 1, 2, 'blue')
  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    pendingBattle: null,
    pendingAbilityEffect: undefined,
    pendingOnPlay: undefined,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [
          source,
          cardCheckBattleEntry(blueAlly.cookie, blueAlly.hpCards, 2),
        ],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          cardCheckBattleEntry(
            { ...timekeeper, instanceId: 'demo-bs6-010' },
            [],
            1,
          ),
        ],
      },
    },
  }
}

/**
 * Local Browser A/B fixture for BS6-008's current-battle Trap lock.
 *
 * The attacker is the real BS6-008 card and the defender holds the real
 * BS6-020 Tonic Spray with two active red supports, so the open branch proves
 * that an otherwise payable Trap reaches the response window. The blocked
 * branch only changes the attacker's remaining HP from 5 to 4 and then uses
 * the real `beginAttack` rule path, which must set `trapsDisabled` before the
 * UI decides whether to render the Trap response modal.
 */
export const createBs6008TrapDemoState = (
  remainingHp: 4 | 5,
): GameState => {
  const base = createCardCheckDemoState('BS6-008')
  const source = base.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS6-008',
  )
  const defender = base.players['player-one'].battleArea.find(
    (entry) => entry.card.id !== 'BS6-008',
  )
  const trap = getCardCheckCard('BS6-020')
  if (!source || !defender || trap.type !== 'trap') {
    throw new Error('BS6-008 Trap fixture requires both official cards')
  }

  const attacker = {
    ...source,
    hpCards: Array.from({ length: remainingHp }, (_, index) =>
      testSupportCard(`bs6-008-attacker-hp-${index + 1}`, 'red'),
    ),
  }
  const state: GameState = {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    pendingBattle: null,
    pendingAbilityEffect: undefined,
    pendingOnPlay: undefined,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [{ ...trap, instanceId: 'bs6-008-trap' }, ...base.players['player-one'].hand],
        battleArea: [defender],
        supportArea: scenarioSupports('bs6-008-trap-support', 2, 'red'),
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [attacker],
        supportArea: scenarioSupports('bs6-008-attack-support', 3, 'red'),
      },
    },
  }

  return beginAttack(
    state,
    attacker.card.instanceId,
    defender.card.instanceId,
    [
      'bs6-008-attack-support-1',
      'bs6-008-attack-support-2',
      'bs6-008-attack-support-3',
    ],
  )
}

/**
 * BS5-060 的專用結束階段夾具。
 *
 * `card:` 夾具直接把遊戲放在攻擊後續效果視窗，但不模擬攻擊支付後
 * 支援卡變成休息狀態。這裡保留同一個真實攻擊後視窗，只把支援區狀態
 * 分成可觀察的 A/B 路徑：A 有 4 張休息卡，B 全部已啟動。
 */
export const createBs5CroissantEndPhaseDemoState = (
  supportState: 'rested' | 'active',
): GameState => {
  const state = createCardCheckDemoState('BS5-060')
  const player = state.players['player-one']
  return updateDemoPlayer(state, 'player-one', {
    supportArea: player.supportArea.map((support, index) => ({
      ...support,
      rested: supportState === 'rested' ? index < 4 : false,
    })),
  })
}

export const createP082TrapDemoState = (
  payment: 'energy' | 'cookie',
): GameState => {
  const state = createCardCheckDemoState('BS5-021')
  const player = state.players['player-one']
  const trap = getPTestCard('P-082')
  const alternativeCookie = cardCheckFillerCookie(
    'p082-alternative-cookie',
    1,
    1,
    0,
    'yellow',
  ).cookie

  return {
    ...state,
    // Keep the defender in control while the dedicated trap response window
    // is being inspected; otherwise the AI can consume the pending attack
    // before a Browser test can select the payment path.
    activePlayerId: 'player-one',
    players: {
      ...state.players,
      'player-one': {
        ...player,
        hand: player.hand.map((card, index) => (index === 0 ? trap : card)),
        // P-082's main payment is {Y}{N}; the base BS5-021 trap fixture uses
        // red supports, which made the normal payment path unavailable and
        // caused the browser auto-skip to hide the response modal.
        supportArea: scenarioSupports('p082-trap-support', 6, 'yellow'),
        discardPile:
          payment === 'cookie'
            ? [...player.discardPile, alternativeCookie]
            : player.discardPile,
      },
    },
  }
}

/** P-084 fixtures make the dynamic neutral-cost branch observable in Browser. */
export const createP084ItemConditionDemoState = (
  conditionMet: boolean,
): GameState => {
  const state = createCardCheckDemoState('BS5-020')
  const item = getPTestCard('P-084')
  return {
    ...state,
    cookiesFaintedThisTurn: {
      'player-one': conditionMet ? 1 : 0,
      'player-two': 0,
    },
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: state.players['player-one'].hand.map((card, index) =>
          index === 0 ? item : card,
        ),
        // Red pays the dynamic {N} cost, but not the original {G} cost.
        supportArea: scenarioSupports('p084-condition-support', 1, 'red'),
      },
    },
  }
}

/** P-147 fixture for Special Play payment followed by the real On Play window. */
export const createP147SpecialPlayDemoState = (): GameState => {
  const state = createCardCheckDemoState('BS3-063')
  const specialPlayCookie = getPTestCard('P-147')
  const sacrifice = scenarioCookie('p147-special-sacrifice', 1, 4, 'black')

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: state.players['player-one'].hand.map((card, index) =>
          index === 0 ? specialPlayCookie : card,
        ),
        battleArea: [cardCheckBattleEntry(sacrifice.cookie, sacrifice.hpCards, 600)],
        supportArea: scenarioSupports('p147-special-support', 6, 'black'),
      },
      'player-two': {
        ...state.players['player-two'],
        hand: Array.from({ length: 4 }, (_, index) =>
          testSupportCard(`p147-opponent-hand-${index + 1}`, 'purple'),
        ),
      },
    },
  }
}

/**
 * Focused browser fixture for BS4-024's redirect-attack rule.
 * The player can attack while the opponent has Kumiho Cookie plus a Yellow
 * LV.3 Cookie, so the target restriction is observable through the real UI.
 */
export const createBs4024TargetRestrictionDemoState = (): GameState => {
  const state = createCardCheckDemoState('BS4-024')
  const player = state.players['player-one']
  const opponent = state.players['player-two']
  const kumiho = player.battleArea.find(
    (entry) => entry.card.id === 'BS4-024',
  )
  const attacker = player.battleArea.find(
    (entry) => entry.card.id !== 'BS4-024',
  )
  const yellowLevel3 = opponent.battleArea.find(
    (entry) => entry.card.energyColor === 'yellow' && entry.card.level === 3,
  )

  if (!kumiho || !attacker || !yellowLevel3) {
    throw new Error('BS4-024 target-restriction fixture is incomplete')
  }

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    pendingBattle: null,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: [attacker],
      },
      'player-two': {
        ...opponent,
        battleArea: [kumiho, yellowLevel3],
        hand: [],
        supportArea: [],
      },
    },
  }
}

export const createBs2015CostDepartureDemoState = (
  replacementAvailable: boolean,
): GameState => {
  const state = createCardCheckDemoState('BS2-015')
  const player = state.players['player-one']
  const source = player.battleArea.find((entry) => entry.card.id === 'BS2-015')
  if (!source) {
    throw new Error('BS2-015 cost-departure fixture requires BS2-015')
  }

  const replacement = cardCheckFillerCookie(
    'bs2-015-replacement',
    1,
    3,
    0,
    'green',
  ).cookie
  const nonCookieHand = player.hand.filter((card) => card.type !== 'cookie')

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        hand: replacementAvailable
          ? [replacement, ...nonCookieHand]
          : nonCookieHand,
        battleArea: [source],
      },
    },
  }
}

const updateDemoPlayer = (
  state: GameState,
  playerId: PlayerId,
  patch: Partial<PlayerState>,
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: {
      ...state.players[playerId],
      ...patch,
    },
  },
})

const scenarioCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: EnergyColor,
  remainingHp = hp,
): { cookie: CookieCard; hpCards: GameCard[] } =>
  cardCheckFillerCookie(
    instanceId,
    level,
    hp,
    Math.max(0, hp - remainingHp),
    energyColor,
  )

const scenarioSupports = (
  prefix: string,
  count: number,
  energyColor: EnergyColor,
  rested = false,
) =>
  Array.from({ length: count }, (_, index) => ({
    card: testSupportCard(`${prefix}-${index + 1}`, energyColor),
    rested,
  }))

const scenarioPendingBattle = (
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  targetInstanceId: string,
  attackEffects: CookieCard['attackEffects'],
  faintedColors: EnergyColor[] = [],
  stage: PendingBattle['stage'] = 'attack-effect',
): PendingBattle => ({
  attackerPlayerId,
  defenderPlayerId,
  attackerInstanceId,
  targetInstanceId,
  declaredDamage: 1,
  remainingDamage: 0,
  stage,
  trapUsed: false,
  revealedHpCard: null,
  preventKnockoutTargetIds: [],
  faintedColors,
  attackEffects: attackEffects ?? [],
  attackEffectIndex: 0,
})

/**
 * Creates focused BS3-061 condition fixtures for browser verification.
 * The cost is payable in both routes; only the support count after paying
 * the cost differs (6 -> 5 versus 5 -> 4).
 */
export const createBs3SilverbellConditionDemoState = (
  conditionMet: boolean,
): GameState => {
  const state = createCardCheckDemoState('BS3-061')
  const player = state.players['player-one']
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        supportArea: player.supportArea.slice(0, conditionMet ? 6 : 5),
      },
    },
  }
}

/**
 * Creates focused BS4 condition fixtures for the cards that the generic
 * card-check state cannot satisfy. The `met` and `unmet` variants are both
 * intentionally legal states; the latter keeps the card available while
 * removing only the relevant condition or target.
 */
export const createBs4ConditionDemoState = (
  cardNumber: Bs4ConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)

  const setPlayer = (playerId: PlayerId, patch: Partial<PlayerState>) => {
    state = updateDemoPlayer(state, playerId, patch)
  }

  const putSourceInBattle = (
    remainingHp: number,
    rested = false,
  ): CookieCard => {
    const player = state.players['player-one']
    const source =
      player.hand.find((card) => card.id === cardNumber) ??
      player.battleArea.find((entry) => entry.card.id === cardNumber)?.card
    if (!source || source.type !== 'cookie') {
      throw new Error(`BS4 condition fixture requires Cookie ${cardNumber}`)
    }
    const otherBattleCookies = player.battleArea
      .filter((entry) => entry.card.id !== cardNumber)
      .slice(0, 1)
    const entry = cardCheckBattleEntry(
      source,
      Array.from({ length: Math.max(0, remainingHp) }, (_, index) =>
        testSupportCard(`${cardNumber}-source-hp-${index + 1}`),
      ),
      90,
      rested,
    )
    setPlayer('player-one', {
      hand: player.hand.filter((card) => card.id !== cardNumber),
      battleArea: [entry, ...otherBattleCookies],
    })
    return source
  }

  const setAttackScenario = (
    remainingHp = 2,
  ): CookieCard => {
    const source = putSourceInBattle(remainingHp, true)
    const opponent = state.players['player-two']
    const target = opponent.battleArea[0]
    if (!target) throw new Error(`BS4 condition fixture requires an opponent target for ${cardNumber}`)
    state = {
      ...state,
      activePlayerId: 'player-one',
      phase: 'main',
      pendingBattle: scenarioPendingBattle(
        'player-one',
        source.instanceId,
        'player-two',
        target.card.instanceId,
        source.attackEffects,
      ),
    }
    return source
  }

  const setOpponentTargetRemainingHp = (remainingHp: number) => {
    const opponent = state.players['player-two']
    setPlayer('player-two', {
      battleArea: opponent.battleArea.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              hpCards: Array.from({ length: remainingHp }, (_, hpIndex) =>
                testSupportCard(`${cardNumber}-target-hp-${hpIndex + 1}`),
              ),
            }
          : entry,
      ),
    })
  }

  const setDiscardCount = (playerId: PlayerId, count: number, prefix: string) => {
    setPlayer(playerId, {
      discardPile: Array.from({ length: count }, (_, index) =>
        testSupportCard(`${prefix}-${index + 1}`),
      ),
    })
  }

  const addBattleAlly = (
    level: number,
    energyColor: EnergyColor,
    instanceId: string,
  ) => {
    const player = state.players['player-one']
    const ally = scenarioCookie(instanceId, level, 5, energyColor)
    const sourceEntry = player.battleArea.find(
      (entry) => entry.card.id === cardNumber,
    )
    setPlayer('player-one', {
      battleArea: sourceEntry
        ? [sourceEntry, cardCheckBattleEntry(ally.cookie, ally.hpCards, 91)]
        : player.battleArea,
    })
  }

  switch (cardNumber) {
    case 'BS4-011': {
      const source = putSourceInBattle(2, true)
      const target = state.players['player-two'].battleArea[0]
      state = {
        ...state,
        pendingBattle: scenarioPendingBattle(
          'player-one',
          source.instanceId,
          'player-two',
          target.card.instanceId,
          source.attackEffects,
          conditionMet
            ? [
                target.card.energyColor && target.card.energyColor !== 'wild'
                  ? target.card.energyColor
                  : 'red',
              ]
            : [],
        ),
      }
      if (conditionMet) {
        const triggeredEffects = (source.skill?.effects ?? []).flatMap(
          (effect) =>
            'condition' in effect &&
            effect.condition?.kind === 'opponent-cookie-fainted-in-current-battle'
              ? [{ ...effect, condition: undefined } as CardEffect]
              : [],
        )
        state = {
          ...state,
          pendingBattle: {
            ...state.pendingBattle!,
            faintedCookies: [
              {
                playerId: 'player-two',
                energyColor: target.card.energyColor,
                level: target.card.level,
              },
            ],
          },
          pendingAbilityEffect: {
            playerId: 'player-one',
            sourcePlayerId: 'player-one',
            sourceInstanceId: source.instanceId,
            sourceCardName: source.name,
            sourceKind: 'skill',
            effects: triggeredEffects,
            effectIndex: 0,
          },
        }
      }
      return state
    }
    case 'BS4-012':
      putSourceInBattle(conditionMet ? 1 : 2)
      return state
    case 'BS4-014': {
      const source = putSourceInBattle(2)
      const opponent = state.players['player-two']
      const attacker = opponent.battleArea[0]
      const attackerCard = { ...attacker.card, level: conditionMet ? 1 : 2 }
      setPlayer('player-two', {
        battleArea: [
          { ...attacker, card: attackerCard },
          ...opponent.battleArea.slice(1),
        ],
      })
      state = {
        ...state,
        activePlayerId: 'player-two',
        pendingBattle: scenarioPendingBattle(
          'player-two',
          attackerCard.instanceId,
          'player-one',
          source.instanceId,
          [],
          [],
          'damage',
        ),
      }
      return state
    }
    case 'BS4-016':
      setAttackScenario()
      setOpponentTargetRemainingHp(conditionMet ? 1 : 2)
      return state
    case 'BS4-020': {
      if (conditionMet) {
        const target = scenarioCookie('BS4-020-red-lv3', 3, 5, 'red')
        setPlayer('player-one', {
          battleArea: [cardCheckBattleEntry(target.cookie, target.hpCards, 90)],
          breakArea: [
            scenarioCookie('BS4-020-break-1', 3, 5, 'red').cookie,
            scenarioCookie('BS4-020-break-2', 3, 5, 'red').cookie,
          ],
        })
      } else {
        setPlayer('player-one', {
          breakArea: state.players['player-one'].breakArea.filter(
            (card) => card.level < 3,
          ),
        })
      }
      return state
    }
    case 'BS4-023':
      setAttackScenario()
      if (conditionMet) {
        setPlayer('player-one', {
          breakArea: [
            scenarioCookie('BS4-023-break-lv3', 3, 5, 'yellow').cookie,
            ...state.players['player-one'].breakArea,
          ],
        })
      } else {
        setPlayer('player-one', {
          breakArea: state.players['player-one'].breakArea.filter(
            (card) =>
              !(
                card.type === 'cookie' &&
                card.level === 3 &&
                card.energyColor === 'yellow'
              ),
          ),
        })
      }
      return state
    case 'BS4-024': {
      putSourceInBattle(1)
      if (conditionMet) addBattleAlly(3, 'yellow', 'BS4-024-yellow-lv3')
      setPlayer('player-two', {
        battleArea: state.players['player-two'].battleArea.slice(0, 1),
      })
      return { ...state, activePlayerId: 'player-two', phase: 'main' }
    }
    case 'BS4-039':
      setAttackScenario(conditionMet ? 2 : 1)
      return state
    case 'BS4-040': {
      const sacrifice = scenarioCookie(
        'BS4-040-sacrifice',
        conditionMet ? 2 : 1,
        4,
        'yellow',
      )
      setPlayer('player-one', {
        battleArea: [cardCheckBattleEntry(sacrifice.cookie, sacrifice.hpCards, 90)],
        breakArea: conditionMet
          ? [scenarioCookie('BS4-040-revive', 3, 5, 'yellow').cookie]
          : state.players['player-one'].breakArea.filter((card) => card.level !== 3),
      })
      return state
    }
    case 'BS4-048':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-048-support', conditionMet ? 7 : 6, 'green', true),
      })
      return { ...state, phase: 'end', activePlayerId: 'player-one' }
    case 'BS4-049':
      setAttackScenario()
      setPlayer('player-two', {
        supportArea: scenarioSupports('BS4-049-opponent-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-052':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-052-support', conditionMet ? 5 : 4, 'green', true),
      })
      return { ...state, phase: 'end', activePlayerId: 'player-one' }
    case 'BS4-053':
      setAttackScenario()
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-053-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-059':
      putSourceInBattle(1)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-059-support', conditionMet ? 3 : 4, 'green'),
      })
      return state
    case 'BS4-061':
      setAttackScenario()
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-061-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-073':
    case 'BS4-083':
      setAttackScenario()
      setPlayer('player-one', {
        hand: Array.from({ length: conditionMet ? 5 : 4 }, (_, index) =>
          testSupportCard(`${cardNumber}-hand-${index + 1}`, 'blue'),
        ),
      })
      return state
    case 'BS4-089':
      setAttackScenario()
      setPlayer('player-two', {
        battleArea: state.players['player-two'].battleArea.slice(0, conditionMet ? 2 : 1),
      })
      setDiscardCount('player-two', conditionMet ? 15 : 14, 'BS4-089-opponent-trash')
      return state
    case 'BS4-090': {
      setAttackScenario()
      const flipEntry = getCardPoolEntry('BS4-102')
      if (!flipEntry) throw new Error('BS4 condition fixture requires BS4-102')
      setPlayer('player-one', {
        discardPile: Array.from({ length: conditionMet ? 3 : 2 }, (_, index) =>
          createCard(flipEntry, 'player-one', 300 + index),
        ),
      })
      return state
    }
    case 'BS4-094':
      putSourceInBattle(2)
      if (conditionMet) addBattleAlly(3, 'purple', 'BS4-094-purple-lv3')
      return state
    case 'BS4-106':
      setDiscardCount('player-two', conditionMet ? 10 : 9, 'BS4-106-opponent-trash')
      return state
    case 'BS4-107':
      setDiscardCount('player-two', conditionMet ? 15 : 14, 'BS4-107-opponent-trash')
      return state
  }
}

/** BS5 FLIP 的逐卡 A/B fixture：同一張翻開卡分別走發動與不發動。 */
/**
 * Builds the dedicated A/B fixtures for P-0XX cards whose generic card-check
 * state cannot expose a condition, passive timing, or end-phase effect.
 *
 * `conditionMet=false` removes only the relevant prerequisite while keeping
 * the card in a legal zone, so the Browser audit can verify a safe no-op.
 */
/**
 * BS6-039 的第一段必須在對手休息區總等級不超過 LV.6 時才可執行。
 * 兩條路徑都保留登場卡與支付所需的黃色支援，供 Browser 實際部署後驗證。
 */
export const createBs6ConditionDemoState = (
  cardNumber: Bs6ConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)
  if (cardNumber === 'BS6-012') {
    const hand = Array.from(
      { length: conditionMet ? 4 : 6 },
      (_, index) => testSupportCard(`BS6-012-condition-hand-${index + 1}`, 'red'),
    )
    state = updateDemoPlayer(state, 'player-one', { hand })
  }
  const opponentBreakArea = conditionMet
    ? [scenarioCookie(`${cardNumber}-opponent-break-lv2`, 2, 4, 'red').cookie]
    : [scenarioCookie(`${cardNumber}-opponent-break-lv7`, 7, 8, 'red').cookie]

  return updateDemoPlayer(state, 'player-two', {
    breakArea: opponentBreakArea,
  })
}

export const createPConditionDemoState = (
  cardNumber: PConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)
  const setPlayer = (playerId: PlayerId, patch: Partial<PlayerState>) => {
    state = updateDemoPlayer(state, playerId, patch)
  }

  const putSourceInBattle = (
    remainingHp = 2,
    rested = false,
  ): CookieCard => {
    const player = state.players['player-one']
    const isSourceInstance = (candidate: GameCard) =>
      candidate.id === cardNumber ||
      candidate.instanceId.startsWith(`player-one-${cardNumber}-`)
    const source =
      player.hand.find(isSourceInstance) ??
      player.battleArea.find((entry) => isSourceInstance(entry.card))?.card
    if (!source || source.type !== 'cookie') {
      throw new Error(`P condition fixture requires Cookie ${cardNumber}`)
    }
    const otherBattleCookies = player.battleArea
      .filter((entry) => entry.card.instanceId !== source.instanceId)
      .slice(0, 1)
    setPlayer('player-one', {
      hand: player.hand.filter((card) => card.instanceId !== source.instanceId),
      battleArea: [
        cardCheckBattleEntry(
          source,
          Array.from({ length: Math.max(1, remainingHp) }, (_, index) =>
            testSupportCard(`${cardNumber}-source-hp-${index + 1}`),
          ),
          90,
          rested,
        ),
        ...otherBattleCookies,
      ],
    })
    return source
  }

  const setAttackScenario = (remainingHp = 2): CookieCard => {
    const source = putSourceInBattle(remainingHp, true)
    const target = state.players['player-two'].battleArea[0]
    if (!target) {
      throw new Error(`P condition fixture requires an opponent target for ${cardNumber}`)
    }
    state = {
      ...state,
      activePlayerId: 'player-one',
      phase: 'main',
      pendingBattle: scenarioPendingBattle(
        'player-one',
        source.instanceId,
        'player-two',
        target.card.instanceId,
        source.attackEffects,
      ),
    }
    return source
  }

  const arenaCookie = (instanceId: string, level = 1): CookieCard => ({
    ...scenarioCookie(instanceId, level, Math.max(2, level + 1), 'red').cookie,
    keywords: ['arena'],
  })

  const arenaBreakArea = (count: number): CookieCard[] =>
    Array.from({ length: count }, (_, index) =>
      arenaCookie(`${cardNumber}-arena-break-${index + 1}`),
    )

  const arenaHand = (count: number): GameCard[] =>
    Array.from({ length: count }, (_, index) => ({
      ...testSupportCard(`${cardNumber}-arena-hand-${index + 1}`, 'blue'),
      keywords: ['arena'] as ['arena'],
    }))

  const arenaTrash = (count: number): GameCard[] =>
    Array.from({ length: count }, (_, index) => ({
      ...testSupportCard(`${cardNumber}-arena-trash-${index + 1}`, 'purple'),
      keywords: ['arena'] as ['arena'],
    }))

  const setPendingAttackAlly = () => {
    const player = state.players['player-one']
    const sourceEntry = player.battleArea.find(
      (entry) =>
        entry.card.id === cardNumber ||
        entry.card.instanceId.startsWith(`player-one-${cardNumber}-`),
    )
    if (!sourceEntry) throw new Error(`P condition fixture lost ${cardNumber}`)
    const ally = arenaCookie(`${cardNumber}-arena-ally`)
    setPlayer('player-one', {
      battleArea: [
        sourceEntry,
        cardCheckBattleEntry(
          ally,
          scenarioCookie(`${cardNumber}-arena-ally-hp`, 1, 2, 'red', 1).hpCards,
          91,
        ),
      ],
    })
  }

  switch (cardNumber) {
    case 'P-041':
      setAttackScenario(1)
      return { ...state, isBirthday: conditionMet }
    case 'P-058':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('P-058-support', 4, 'green'),
      })
      return { ...state, activePlayerId: 'player-one', phase: 'end' }
    case 'P-059':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'P-059-support',
          2,
          'green',
          !conditionMet,
        ),
      })
      return { ...state, activePlayerId: 'player-one', phase: 'end' }
    case 'P-064':
      setAttackScenario(conditionMet ? 1 : 2)
      return state
    case 'P-065': {
      putSourceInBattle(3)
      if (conditionMet) {
        const sourceEntry = state.players['player-one'].battleArea.find(
          (entry) => entry.card.id === cardNumber,
        )!
        const pizza = { ...arenaCookie('P-065-pizza', 3), name: 'Pizza Cookie' }
        setPlayer('player-one', {
          battleArea: [
            sourceEntry,
            cardCheckBattleEntry(
              pizza,
              scenarioCookie('P-065-pizza-hp', 3, 5, 'red').hpCards,
              91,
            ),
          ],
        })
      }
      return state
    }
    case 'P-067':
      putSourceInBattle(3)
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'P-067-self-support',
          conditionMet ? 3 : 4,
          'green',
        ),
      })
      setPlayer('player-two', {
        supportArea: scenarioSupports('P-067-opponent-support', 5, 'green'),
      })
      return state
    case 'P-071': {
      putSourceInBattle(2)
      const handCookie = cardCheckFillerCookie(
        'P-071-hand-cookie',
        1,
        2,
        0,
        'yellow',
      ).cookie
      setPlayer('player-one', {
        hand: conditionMet
          ? [handCookie, ...state.players['player-one'].hand]
          : state.players['player-one'].hand.filter((card) => card.type !== 'cookie'),
      })
      return state
    }
    case 'P-074':
      putSourceInBattle(2)
      setPlayer('player-one', { hand: conditionMet ? arenaHand(2) : [] })
      return state
    case 'P-075':
      setAttackScenario(3)
      setPlayer('player-one', {
        discardPile: Array.from(
          { length: conditionMet ? 15 : 14 },
          (_, index) => testSupportCard(`P-075-trash-${index + 1}`, 'purple'),
        ),
      })
      return state
    case 'P-093': {
      const source = putSourceInBattle(3)
      return {
        ...state,
        cookiesHpReducedThisTurn: {
          'player-one': conditionMet ? { [source.instanceId]: true } : {},
          'player-two': {},
        },
      }
    }
    case 'P-094':
      setAttackScenario(2)
      setPlayer('player-one', {
        breakArea: conditionMet
          ? [scenarioCookie('P-094-break-lv2', 2, 4, 'yellow').cookie]
          : [
              scenarioCookie('P-094-break-lv2-a', 2, 4, 'yellow').cookie,
              scenarioCookie('P-094-break-lv2-b', 2, 4, 'yellow').cookie,
            ],
      })
      return state
    case 'P-095': {
      const source = putSourceInBattle(3)
      return {
        ...state,
        itemsActivatedThisTurn: {
          'player-one': conditionMet ? 1 : 0,
          'player-two': 0,
        },
        cookiesHpReducedThisTurn: {
          'player-one': { [source.instanceId]: true },
          'player-two': {},
        },
      }
    }
    case 'P-098':
      putSourceInBattle(2)
      return {
        ...state,
        supportCardsTrashedThisTurn: {
          'player-one': conditionMet ? 2 : 0,
          'player-two': 0,
        },
      }
    case 'P-103':
    case 'P-103@1':
      setAttackScenario(3)
      if (conditionMet) setPendingAttackAlly()
      return state
    case 'P-106':
      putSourceInBattle(2)
      return {
        ...state,
        arenaCookieDealtEffectDamageThisTurn: {
          'player-one': conditionMet,
          'player-two': false,
        },
      }
    case 'P-109':
    case 'P-110':
      putSourceInBattle(2)
      setPlayer('player-one', {
        breakArea: conditionMet ? arenaBreakArea(4) : [],
      })
      return state
    case 'P-119':
      putSourceInBattle(3)
      setPlayer('player-one', {
        discardPile: conditionMet ? arenaTrash(5) : [],
      })
      return state
    case 'P-121':
      putSourceInBattle(2)
      setPlayer('player-one', {
        discardPile: conditionMet ? arenaTrash(7) : [],
      })
      return state
    case 'P-128':
      putSourceInBattle(1)
      return {
        ...state,
        cookiesFaintedThisTurn: {
          'player-one': 0,
          'player-two': conditionMet ? 1 : 0,
        },
      }
    case 'P-131':
      putSourceInBattle(1)
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'P-131-support',
          conditionMet ? 7 : 6,
          'green',
        ),
      })
      return state
    case 'P-134':
      setAttackScenario(3)
      setPlayer('player-one', {
        hand: Array.from(
          { length: conditionMet ? 7 : 6 },
          (_, index) => testSupportCard(`P-134-hand-${index + 1}`, 'blue'),
        ),
      })
      return state
    case 'P-137':
      putSourceInBattle(3)
      return {
        ...state,
        cookiesFaintedThisTurn: {
          'player-one': 0,
          'player-two': conditionMet ? 1 : 0,
        },
      }
    case 'P-142':
      setAttackScenario(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'P-142-self-support',
          conditionMet ? 2 : 3,
          'green',
        ),
      })
      setPlayer('player-two', {
        supportArea: scenarioSupports('P-142-opponent-support', 3, 'green'),
      })
      return state
    case 'P-145':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('P-145-support', 1, 'purple'),
      })
      return { ...state, activePlayerId: 'player-one', phase: 'end' }
  }
}

export const createBs5FlipDemoState = (
  cardNumber: Bs5FlipCardNumber,
  activate: boolean,
): GameState => {
  void activate
  return createCardCheckDemoState(cardNumber)
}

/**
 * BS5 六張昏厥技能的專用情境。
 * `met` 只調整該卡的關鍵條件；不成立路徑仍保留真實 pending UI，讓測試
 * 可以確認「確認／略過」後不會卡死，也不會誤執行後續效果。
 */
export const createBs5FaintDemoState = (
  cardNumber: Bs5FaintCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)
  const setPlayer = (playerId: PlayerId, patch: Partial<PlayerState>) => {
    state = updateDemoPlayer(state, playerId, patch)
  }

  switch (cardNumber) {
    case 'BS5-007':
      setPlayer('player-one', {
        hand: conditionMet
          ? [testSupportCard('BS5-007-red-item', 'red'), testSupportCard('BS5-007-extra', 'wild')]
          : [testSupportCard('BS5-007-wrong-color', 'blue')],
      })
      return state
    case 'BS5-011': {
      const opponent = state.players['player-two']
      setPlayer('player-two', {
        battleArea: opponent.battleArea.map((entry, index) => ({
          ...entry,
          card: {
            ...entry.card,
            // The unmet route must remove every LV.1 candidate, not only the
            // first Cookie in the spread used by the generic fixture.
            level: conditionMet && index === 0 ? 1 : 2,
          },
        })),
      })
      return state
    }
    case 'BS5-026': {
      if (!conditionMet) {
        setPlayer('player-one', {
          hand: state.players['player-one'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
        })
      }
      return state
    }
    case 'BS5-047':
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'BS5-047-support',
          conditionMet ? 6 : 0,
          'green',
          true,
        ),
      })
      return state
    case 'BS5-072': {
      // Keep the fainting source Cookie in the break area. The UI resolves
      // the pending faint effect by looking up that source instance; replacing
      // the whole zone here made both A/B routes silently lose the prompt.
      const source = state.players['player-one'].breakArea.find(
        (breakCard) => breakCard.id === cardNumber,
      )
      setPlayer('player-one', {
        breakArea: conditionMet
          ? [
              ...(source ? [source] : []),
              scenarioCookie('BS5-072-break-1', 3, 4, 'blue').cookie,
              scenarioCookie('BS5-072-break-2', 3, 4, 'blue').cookie,
            ]
          : source
            ? [source]
            : [],
      })
      return state
    }
    case 'BS5-107':
      // 這張卡沒有條件句；兩條路徑共用同一個「雙方各磨 2 張」流程，
      // A/B 只用來確認不會把無條件效果誤標成不可用。
      return state
  }
}

/** BS5 五張陷阱的條件成立／不成立 fixture。 */
export const createBs5TrapDemoState = (
  cardNumber: Bs5TrapCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)
  const setPlayer = (playerId: PlayerId, patch: Partial<PlayerState>) => {
    state = updateDemoPlayer(state, playerId, patch)
  }
  const player = state.players['player-one']

  switch (cardNumber) {
    case 'BS5-021':
      setPlayer('player-one', {
        battleArea: player.battleArea.map((entry, index) =>
          index === 0
            ? { ...entry, card: { ...entry.card, level: conditionMet ? 3 : 2 } }
            : entry,
        ),
      })
      return state
    case 'BS5-043':
      // 無發動條件；A/B 由玩家的發動／略過與目標選擇路徑驗證。
      return state
    case 'BS5-065':
      setPlayer('player-one', {
        supportArea: scenarioSupports(
          'BS5-065-support',
          conditionMet ? 7 : 6,
          'green',
        ),
      })
      setPlayer('player-two', {
        supportArea: scenarioSupports('BS5-065-opponent-support', 2, 'blue'),
        // The pending battle already represents the attack under audit. Keep
        // every opposing Cookie rested after that attack so the dedicated
        // test-state settles on Petrification's result instead of letting the
        // AI immediately start an unrelated second attack and replacement
        // chain while the Browser auditor is still observing this card.
        battleArea: state.players['player-two'].battleArea.map((entry) => ({
          ...entry,
          rested: true,
        })),
      })
      return state
    case 'BS5-087':
      setPlayer('player-one', {
        breakArea: conditionMet
          ? [
              scenarioCookie('BS5-087-break-1', 3, 4, 'blue').cookie,
              scenarioCookie('BS5-087-break-2', 3, 4, 'blue').cookie,
            ]
          : [],
      })
      return state
    case 'BS5-109':
      setPlayer('player-one', {
        discardPile: conditionMet
          ? Array.from({ length: 16 }, (_, index) =>
              testSupportCard(`BS5-109-trash-${index + 1}`, 'purple'),
            )
          : Array.from({ length: 5 }, (_, index) =>
              testSupportCard(`BS5-109-trash-${index + 1}`, 'purple'),
            ),
      })
      return state
  }
}

/** BS5-111 裝備於龍族餅乾，分別測試 HP 3 以下與 HP 4 以上。 */
export const createBs5Item111DemoState = (conditionMet: boolean): GameState => {
  const state = createCardCheckDemoState('BS5-111')
  const dragonEntry = getCardPoolEntry('BS5-056')
  if (!dragonEntry) throw new Error('BS5-111 fixture requires BS5-056')
  const dragon = createCard(dragonEntry, 'player-one', 901) as CookieCard
  const hpCards = Array.from(
    { length: conditionMet ? 3 : 4 },
    (_, index) => testSupportCard(`BS5-111-dragon-hp-${index + 1}`, 'green'),
  )
  return updateDemoPlayer(state, 'player-one', {
    battleArea: [cardCheckBattleEntry(dragon, hpCards, 901)],
  })
}

/** BS5-020 條件成立／不成立：己方分別有 2／1 個剩餘 HP 為 1 的餅乾。 */
export const createBs5ItemConditionDemoState = (
  cardNumber: Bs5ItemConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  const state = createCardCheckDemoState(cardNumber)
  const currentEntry = state.players['player-one'].battleArea[0]
  const second = scenarioCookie(
    `${cardNumber}-condition-cookie`,
    1,
    4,
    'red',
    conditionMet ? 1 : 2,
  )
  return updateDemoPlayer(state, 'player-one', {
    battleArea: [
      {
        ...currentEntry,
        hpCards: [testSupportCard(`${cardNumber}-first-hp`)],
      },
      cardCheckBattleEntry(second.cookie, second.hpCards, 902),
    ],
  })
}

/** BS5-022 條件成立／不成立：己方是否有真正的 Pitaya Dragon Cookie。 */
export const createBs5StageConditionDemoState = (
  cardNumber: Bs5StageConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  const state = createCardCheckDemoState(cardNumber)
  const target = conditionMet
    ? (() => {
        const entry = getCardPoolEntry('BS5-013')
        if (!entry) throw new Error('BS5-022 fixture requires BS5-013')
        return createCard(entry, 'player-one', 903) as CookieCard
      })()
    : scenarioCookie(`${cardNumber}-non-pitaya`, 3, 5, 'red', 4).cookie
  const hpCards = Array.from({ length: 4 }, (_, index) =>
    testSupportCard(`${cardNumber}-source-hp-${index + 1}`, 'red'),
  )
  return updateDemoPlayer(state, 'player-one', {
    battleArea: [cardCheckBattleEntry(target, hpCards, 903)],
  })
}

/**
 * Builds a browser-only BS3-121 scenario from the real card pool. The five
 * Ancient Cookies intentionally provide the five exact energy colours needed
 * by the stage, while five different Soul Jam cards satisfy its special
 * victory condition. This fixture does not alter any production deck.
 */
export const createBs3SpecialVictoryDemoState = (): GameState => {
  const ancientCardNumbers = [
    'BS3-017',
    'BS3-025',
    'BS3-055',
    'BS3-088',
    'BS3-100',
  ]
  const soulJamCardNumbers = [
    'BS3-019',
    'BS3-043',
    'BS3-066',
    'BS3-091',
    'BS3-115',
  ]
  const cardNumbers = ['BS3-121', ...ancientCardNumbers, ...soulJamCardNumbers]
  const entries = cardNumbers.map((cardNumber) => {
    const entry = getCardPoolEntry(cardNumber)
    if (!entry) throw new Error(`找不到 BS3 特殊勝利測試卡片 ${cardNumber}。`)
    return entry
  })
  const stage = createCard(entries[0], 'player-one', 1)
  const ancientSupports = ancientCardNumbers.map((_, index) => ({
    card: createCard(entries[index + 1], 'player-one', index + 2),
    rested: false,
  }))
  const soulJamSupports = soulJamCardNumbers.map((_, index) => ({
    card: createCard(entries[index + 6], 'player-one', index + 7),
    rested: false,
  }))
  const state = createDemoGame(20260725)

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    status: 'playing',
    result: null,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [],
        battleArea: [],
        supportArea: [...ancientSupports, ...soulJamSupports],
        breakArea: [],
        discardPile: [],
        stage: { card: stage, rested: false },
      },
    },
  }
}

export const createSoulJamEquippedDemoState = (
  soulJamCardNumber: string,
  targetCookieCardNumber: string,
): GameState => {
  const sjEntry = getCardPoolEntry(soulJamCardNumber)
  const tcEntry = getCardPoolEntry(targetCookieCardNumber)
  if (!sjEntry || !tcEntry) {
    throw new Error(
      `無法從卡池找到卡片 ${!sjEntry ? soulJamCardNumber : targetCookieCardNumber}。`,
    )
  }
  const soulJam = createCard(sjEntry, 'player-one', 1)
  const targetCookie = createCard(tcEntry, 'player-one', 2) as CookieCard
  const payColor: EnergyColor =
    targetCookie.energyColor && targetCookie.energyColor !== 'wild'
      ? targetCookie.energyColor
      : 'red'

  const hpCards = Array.from({ length: targetCookie.hp }, (_, i) =>
    testSupportCard(`${targetCookie.instanceId}-hp-${i}`, payColor),
  )
  const energySupports = Array.from({ length: 5 }, (_, i) =>
    testSupportCard(`sj-support-${i}`, payColor),
  )
  const deckFiller = Array.from({ length: 10 }, (_, i) =>
    testSupportCard(`sj-deck-${i}`, payColor),
  )
  const oppCookie = cardCheckFillerCookie('sj-opp-lv1', 1, 4, 0, 'red')

  let attackModifiers: GameState['attackModifiers'] = []
  let bonusHpCards: GameCard[] = []

  if (soulJamCardNumber === 'BS3-019') {
    attackModifiers = [
      {
        sourceInstanceId: soulJam.instanceId,
        targetInstanceId: targetCookie.instanceId,
        amount: 1,
        expiresAfterTurn: null,
      },
    ]
  }
  if (soulJamCardNumber === 'BS3-043') {
    bonusHpCards = [
      testSupportCard('sj-gain-hp-1', payColor),
      testSupportCard('sj-gain-hp-2', payColor),
    ]
  }

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: targetCookie,
            hpCards: [...hpCards, ...bonusHpCards],
            rested: false,
            battleEntryId: `${targetCookie.instanceId}:battle:1`,
            equippedCards: [soulJam],
          },
        ],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: oppCookie.cookie,
            hpCards: oppCookie.hpCards,
            rested: false,
            battleEntryId: `${oppCookie.cookie.instanceId}:battle:1`,
          },
        ],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers,
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}

/**
 * 展示 BS3-115 裝載後的對手效果保護：
 * - 對手為 P-030 Sherbet Cookie（4 張藍色能量）。
 * - BS3-100 Dark Cacao（已裝備 BS3-115）HP 全滿，
 *   BS3-088 Pure Vanilla（無保護）HP -1。
 */
export const createSoulJam115ProtectionDemoState = (): GameState => {
  const sj115Entry = getCardPoolEntry('BS3-115')
  const dcEntry = getCardPoolEntry('BS3-100')
  const pvEntry = getCardPoolEntry('BS3-088')
  const p030Entry = getCardPoolEntry('P-030')
  if (!sj115Entry || !dcEntry || !pvEntry || !p030Entry) {
    throw new Error('無法從卡池找到 BS3-115／BS3-100／BS3-088／P-030。')
  }
  const soulJam115 = createCard(sj115Entry, 'player-one', 1)
  const darkCacao = createCard(dcEntry, 'player-one', 2) as CookieCard
  const pureVanilla = createCard(pvEntry, 'player-one', 3) as CookieCard
  const p030 = createCard(p030Entry, 'player-two', 1) as CookieCard

  const dcPayColor: EnergyColor =
    darkCacao.energyColor && darkCacao.energyColor !== 'wild'
      ? darkCacao.energyColor
      : 'purple'

  const dcHpCards = Array.from({ length: darkCacao.hp }, (_, i) =>
    testSupportCard(`dc-hp-${i}`, dcPayColor),
  )
  const pvHpCards = Array.from({ length: pureVanilla.hp - 1 }, (_, i) =>
    testSupportCard(`pv-hp-${i}`, 'blue'),
  )
  const p030HpCards = Array.from({ length: p030.hp }, (_, i) =>
    testSupportCard(`p030-hp-${i}`, 'blue'),
  )
  const energySupports = Array.from({ length: 5 }, (_, i) =>
    testSupportCard(`support-${i}`, dcPayColor),
  )
  const oppSupports = Array.from({ length: 4 }, (_, i) =>
    testSupportCard(`opp-support-${i}`, 'blue'),
  )
  const deckFiller = Array.from({ length: 10 }, (_, i) =>
    testSupportCard(`deck-${i}`, dcPayColor),
  )

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: darkCacao,
            hpCards: dcHpCards,
            rested: false,
            battleEntryId: `${darkCacao.instanceId}:battle:1`,
            equippedCards: [soulJam115],
          },
          {
            card: pureVanilla,
            hpCards: pvHpCards,
            rested: false,
            battleEntryId: `${pureVanilla.instanceId}:battle:2`,
          },
        ],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: p030,
            hpCards: p030HpCards,
            rested: false,
            battleEntryId: `${p030.instanceId}:battle:1`,
          },
        ],
        supportArea: oppSupports.map((c) => ({ card: c, rested: false })),
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 4,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}
