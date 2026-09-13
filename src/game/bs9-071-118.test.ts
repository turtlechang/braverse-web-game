import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import { analyzeOfficialCardBehavior } from '../cards/contracts/ledger'
import type { OfficialCardRecord } from '../cards/types'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
} from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { getEffectiveAttack } from './effects'
import { refreshDeck } from './refresh'
import type { ExtraDeckCard, GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]
const bs9Range = records.filter((card) => {
  const number = Number(card.baseCardNumber.split('-')[1])
  return number >= 71 && number <= 118
})

const record = (cardNumber: string): OfficialCardRecord => {
  const found = records.find((card) => card.cardNumber === cardNumber)
  if (!found) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return found
}

const candidate = (cardNumber: string): GameCard => {
  const conversion = convertOfficialCardToGameCard(record(cardNumber), 'bs9-071-118-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const cookieCandidate = (cardNumber: string) => {
  const card = candidate(cardNumber)
  if (card.type !== 'cookie') throw new Error(`${cardNumber} is not a Cookie`)
  return card
}

const extraCandidate = (cardNumber: string): ExtraDeckCard => {
  const conversion = convertOfficialCardToExtraDeckCard(record(cardNumber), 'bs9-071-118-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.extraDeckCard
}

const sourceInBattle = (state: GameState, cardNumber: string) => {
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === cardNumber,
  )
  if (!source) throw new Error(`${cardNumber} source is not in battle area`)
  return source
}

const sourceInHand = (state: GameState, cardNumber: string) => {
  const source = state.players['player-one'].hand.find((card) => card.id === cardNumber)
  if (!source) throw new Error(`${cardNumber} source is not in hand`)
  return source
}

const allFixtureCards = (state: GameState): Array<GameCard | ExtraDeckCard> => {
  const cards: Array<GameCard | ExtraDeckCard> = []
  for (const player of Object.values(state.players)) {
    cards.push(
      ...player.deck,
      ...(player.extraDeck ?? []),
      ...player.hand,
      ...player.breakArea,
      ...player.discardPile,
      ...player.supportArea.map((entry) => entry.card),
      ...(player.stage ? [player.stage.card] : []),
      ...player.battleArea.flatMap((entry) => [
        entry.card,
        ...entry.hpCards,
        ...(entry.equippedCards ?? []),
        ...(entry.awakenedUnderlay ?? []),
      ]),
    )
  }
  if (state.pendingBattle?.revealedHpCard) cards.push(state.pendingBattle.revealedHpCard)
  if (state.pendingRevealTopDeck?.revealedCard) cards.push(state.pendingRevealTopDeck.revealedCard)
  return cards
}

describe('BS9-071～118 candidate-isolated conversion and rules', { timeout: 30_000 }, () => {
  it('converts and strictly audits every physical candidate, with exact positive/negative fixtures', () => {
    expect(bs9Range).toHaveLength(76)
    for (const source of bs9Range) {
      const conversion = source.type === 'extra'
        ? convertOfficialCardToExtraDeckCard(source, 'fixture')
        : convertOfficialCardToGameCard(source, 'fixture')
      expect(conversion.status, source.cardNumber).toBe('converted')

      const audit = analyzeOfficialCardBehavior(source)
      expect(audit.contract.status, `${source.cardNumber}: ${audit.errors.join(' | ')}`).toBe('verified')
      expect(audit.errors, source.cardNumber).toEqual([])

      const positive = allFixtureCards(createCardCheckDemoState(source.cardNumber))
      const physical = positive.find((card) => card.id === source.baseCardNumber)
      expect(physical, `${source.cardNumber} positive fixture`).toMatchObject({
        id: source.baseCardNumber,
        name: source.name,
        imageUrl: source.imageUrl,
      })

      const negative = allFixtureCards(createCardNegativeDemoState(source.cardNumber))
      // Every negative route retains the physical source.  Unconditional
      // On Play cards 077/100 cross the timing boundary instead of removing
      // the card, so their Browser lane can still prove the exact image.
      expect(negative.some((card) => card.id === source.baseCardNumber), `${source.cardNumber} negative fixture`).toBe(true)
      for (const card of [...positive, ...negative]) {
        expect(card.id, `${source.cardNumber} fixture card`).toMatch(
          /^(?:BS\d+-\d{3}|ST\d+-\d{3}|P-\d{3})(?:@\d+)?$/,
        )
      }
    }
  })

  it('preserves exact costs, timing markers, target boundaries, and Then clauses', () => {
    for (const cardNumber of ['BS9-071', 'BS9-071@1', 'BS9-104', 'BS9-104@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        flip: { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] },
      })
    }
    expect(cookieCandidate('BS9-075').attackEffects?.[0]).toMatchObject({
      kind: 'choose-one',
      modes: [
        { effects: [{ kind: 'battle-to-deck-top', target: { maxLevel: 2 } }] },
        { effects: [{ kind: 'field-to-deck-bottom', target: { maxLevel: 2 }, battleSide: 'self' }] },
      ],
    })
    expect(cookieCandidate('BS9-076').attackEffects?.[0]).toMatchObject({
      kind: 'field-to-deck-bottom',
      target: { sourceOnly: true, side: 'self', max: 1 },
      condition: { kind: 'hand-count-at-most', count: 2 },
    })
    expect(candidate('BS9-077').skill).toMatchObject({
      trigger: 'on-play',
      effects: [{ kind: 'draw-up-to-then-discard', max: 1, discardCount: 1, handDestination: 'deck-top' }],
    })
    expect(candidate('BS9-078').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'field-to-deck-bottom', target: { side: 'opponent', maxLevel: 1 }, condition: { kind: 'battle-area-has-keyword', keyword: 'ancient', excludeSource: true } }],
    })
    expect(cookieCandidate('BS9-079').attackEffects).toEqual([{ kind: 'activate-extra-deck-attack', cardName: 'Shadow Milk Cookie', optional: true }])
    expect(candidate('BS9-080').skill).toMatchObject({
      trigger: 'activate',
      cost: { selfToDeckBottom: true },
      effects: [{ kind: 'choose-one', condition: { kind: 'support-color-count-at-least', color: 'blue', count: 3 } }],
    })
    expect(candidate('BS9-081').skill?.effects).toEqual([{ kind: 'battle-to-deck-top', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }])
    expect(candidate('BS9-082').skill?.effects).toEqual([{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true }, condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Shadow Milk Cookie' } }])
    expect(candidate('BS9-083').skill).toMatchObject({ oncePerTurn: true, effects: [{ kind: 'draw-up-to', max: 1, condition: { kind: 'cookie-placed-from-battle-to-deck-this-turn', side: 'self' } }] })
    for (const cardNumber of ['BS9-084', 'BS9-084@1', 'BS9-084@2', 'BS9-110', 'BS9-110@1']) {
      expect(candidate(cardNumber)).toMatchObject({ flip: { cost: { discardHand: 1 }, effects: [], attachedHpBonus: 1 } })
    }
    expect(candidate('BS9-085').flip?.effects).toEqual([{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 2, handDestination: 'deck-top-or-bottom' }])
    expect(candidate('BS9-086').skill).toMatchObject({ oncePerTurn: true, effects: [{ kind: 'draw-up-to-then-discard', max: 1, discardCount: 1, handDestination: 'deck-top' }] })
    expect(candidate('BS9-087').skill).toMatchObject({ cost: { energy: { blue: 1 }, selfToDeckBottom: true }, effects: [{ kind: 'gain-hp', amount: 1, target: { energyColor: 'blue', maxRemainingHp: 2 } }] })
    for (const cardNumber of ['BS9-088', 'BS9-088@1', 'BS9-088@2']) {
      expect(extraCandidate(cardNumber)).toMatchObject({
        extraDeckPlayMode: 'awaken',
        playRequirement: { kind: 'cookie-placed-from-battle-to-deck-this-turn', side: 'self' },
        awakenRequirement: { targetName: 'Pure Vanilla Cookie', playedFrom: 'break' },
        skill: { trigger: 'on-play', effects: [{ kind: 'reveal-top-deck', match: { energyColor: 'blue', level: 2 }, effects: [{ kind: 'gain-hp', amount: 2, thenEffects: [{ kind: 'draw-up-to', max: 2 }] }] }] },
        attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: { blue: 1 } }, effects: [{ kind: 'gain-hp', amount: 1 }] }],
      })
    }
    expect(candidate('BS9-089').skill).toMatchObject({ oncePerTurn: true, effects: [{ kind: 'reveal-top-deck', match: { energyColor: 'blue', level: 2 }, effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }] }] })
    expect(candidate('BS9-090').item?.effects).toEqual([{ kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' }])
    expect(candidate('BS9-091').item).toMatchObject({
      cost: { energy: { blue: 2 }, discardHand: 0 },
      effects: [
        { kind: 'reveal-hand', cardName: 'Shadow Milk Cookie', asCost: true, amount: 1, selectCard: true, cookieOnly: true },
        { kind: 'return-to-hand', target: { side: 'self', max: 1, maxLevel: 2, energyColor: 'blue' } },
        { kind: 'hand-to-battle', cardName: 'Shadow Milk Cookie', amount: 1 },
      ],
    })
    expect(candidate('BS9-092').item).toMatchObject({
      cost: { energy: { blue: 1, neutral: 1 }, discardHand: 2 },
      effects: [
        { kind: 'damage', amount: 2, target: { side: 'opponent', max: 1 } },
        { kind: 'equip-source', target: { side: 'self', max: 1, cardName: 'Shadow Milk Cookie' }, damageReceivedReduction: 3, bonusCondition: { kind: 'all-of' } },
      ],
    })
    expect(candidate('BS9-093').trap).toMatchObject({
      effects: [{
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        thenEffects: [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1, handDestination: 'deck-top', condition: { kind: 'hand-count-at-most', count: 5 } }],
      }],
    })
    expect(candidate('BS9-094').trap?.effects).toEqual([{
      kind: 'reveal-top-deck',
      match: { type: 'cookie' },
      effects: [{ kind: 'modify-all-attack', amount: -1, duration: 'this-turn', side: 'opponent' }],
      otherwiseEffects: [{ kind: 'draw-up-to', max: 1 }],
    }])
    expect(candidate('BS9-095').stageAbility).toMatchObject({
      placementCost: { blue: 1 },
      triggered: true,
      triggerOnAttackCardName: 'Shadow Milk Cookie',
      triggerOnAttackHandCountAtMost: 5,
    })
    expect(candidate('BS9-096').skill?.effects).toEqual([{ kind: 'prevent-refresh-cookie-break' }])
    expect(candidate('BS9-097').skill).toMatchObject({ oncePerTurn: true, cost: { energy: { neutral: 1 }, discardHand: 1 }, effects: [{ kind: 'hp-to-trash', amount: 1, target: { side: 'opponent' } }] })
    expect(candidate('BS9-098').skill).toMatchObject({ cost: { selfToTrash: true }, effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }] })
    expect(candidate('BS9-099').skill).toMatchObject({ oncePerTurn: true, effects: [{ kind: 'deck-to-trash', amount: 5, side: 'self' }, { kind: 'modify-attack', amount: 1, duration: 'this-turn' }] })
    expect(candidate('BS9-100').skill).toMatchObject({ trigger: 'on-play', effects: [{ kind: 'deck-to-trash', amount: 5, side: 'self' }, { kind: 'deck-to-trash', amount: 5, side: 'opponent' }] })
    expect(candidate('BS9-101').skill).toMatchObject({ effects: [{ kind: 'inspect-deck', lookCount: 3, pickCount: 1, restDestination: 'trash' }] })
    expect(extraCandidate('BS9-102')).toMatchObject({ playRequirement: { kind: 'all-of' }, skill: { oncePerTurn: true }, attackEffects: [{ kind: 'damage', amount: 1, condition: { kind: 'opponent-trash-count-at-least', count: 20 } }] })
    expect(candidate('BS9-112').skill?.effects).toEqual([{ kind: 'modify-attack', amount: 1, duration: 'persistent', target: { side: 'self', min: 1, max: 1, sourceOnly: true }, condition: { kind: 'trash-count-at-least', count: 15 } }])
    expect(candidate('BS9-113').flip).toMatchObject({ cost: { discardHand: 1 }, effects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, condition: { kind: 'trash-count-at-least', count: 15 } }] })
    expect(candidate('BS9-114').item?.effects[0]).toMatchObject({ kind: 'choose-one', modes: [{ effects: [{ kind: 'deck-to-trash', amount: 5, side: 'self' }] }, { effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }] }] })
    expect(candidate('BS9-115').item).toMatchObject({ effects: [{ kind: 'draw-up-to', max: 1 }, { kind: 'deck-to-trash', amount: 3, side: 'opponent' }] })
    expect(candidate('BS9-116').trap).toMatchObject({ effects: [{ kind: 'hp-to-trash', target: { side: 'opponent', max: 1 } }] })
    expect(candidate('BS9-117').trap).toMatchObject({
      effects: [{
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        thenEffects: [{ kind: 'modify-attack', amount: -1, duration: 'this-turn', condition: { kind: 'opponent-trash-count-at-least', count: 20 }, target: { side: 'opponent', previousEffectTargetOnly: true } }],
      }],
    })
    expect(candidate('BS9-118').stageAbility).toMatchObject({ ownerIndependent: true, oncePerTurn: true, cost: { energy: {}, discardHand: 1 }, effects: [{ kind: 'hp-to-trash', amount: 1, target: { side: 'opponent' } }] })
  })

  it('resolves FLIP, discard placement, and attached HP branches through GameCommand', () => {
    for (const cardNumber of ['BS9-071', 'BS9-104']) {
      let state = applyGameCommand(createCardCheckDemoState(cardNumber), { kind: 'resolve-flip', playerId: 'player-one', activate: true })
      expect(state.pendingDrawUpTo?.max, cardNumber).toBe(1)
      state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
      expect(state.pendingBattle).toBeNull()
    }

    for (const cardNumber of ['BS9-084', 'BS9-110']) {
      const initial = createCardCheckDemoState(cardNumber)
      const defender = initial.players['player-one'].battleArea[0]!
      const handCard = initial.players['player-one'].hand[0]!
      const hpBefore = defender.hpCards.length
      const state = applyGameCommand(initial, {
        kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [handCard.instanceId],
      })
      expect(state.players['player-one'].battleArea[0]!.hpCards).toHaveLength(hpBefore + 1)
      expect(state.players['player-one'].discardPile).toContainEqual(expect.objectContaining({ instanceId: handCard.instanceId }))
    }

    let state = createCardCheckDemoState('BS9-085')
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
    expect(state.pendingDrawUpTo?.max).toBe(2)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
    expect(state.pendingOpponentHandDiscard?.count).toBe(2)
    const pendingCards = state.players['player-one'].hand.slice(0, 2).map((card) => card.instanceId)
    expect(() => applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: pendingCards, placementByCardId: { [pendingCards[0]!]: 'top' } })).toThrow()
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: pendingCards,
      placementByCardId: Object.fromEntries(pendingCards.map((id, index) => [id, index === 0 ? 'top' : 'bottom'])),
    })
    expect(state.pendingOpponentHandDiscard).toBeNull()
    expect(state.players['player-one'].deck.some((card) => card.instanceId === pendingCards[0])).toBe(true)
  })

  it('enforces skill/target/once-per-turn boundaries and high-risk continuations', () => {
    let state = createCardCheckDemoState('BS9-078')
    const source = sourceInBattle(state, 'BS9-078')
    const target = state.players['player-two'].battleArea[0]!.card.instanceId
    const neutralPayment = state.players['player-one'].supportArea.find((entry) => !entry.rested)!.card.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [neutralPayment] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target] })
    expect(state.players['player-two'].deck.at(-1)?.instanceId).toBe(target)
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(state, 'player-one', source.card.instanceId, 'activate')).toMatch(/每回合一次/)

    state = createCardCheckDemoState('BS9-097')
    const source097 = sourceInBattle(state, 'BS9-097')
    const discardCard = state.players['player-one'].hand.find((card) => card.id === 'BS8-121')!
    const hpTarget = state.players['player-two'].battleArea[0]!
    const neutralPayment097 = state.players['player-one'].supportArea.find((entry) => !entry.rested)!.card.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source097.card.instanceId, trigger: 'activate', paymentIds: [neutralPayment097], discardHandIds: [discardCard.instanceId] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [hpTarget.card.instanceId] })
    expect(state.players['player-two'].discardPile.some((card) => card.id === 'BS8-021')).toBe(true)

    state = createCardCheckDemoState('BS9-079', { normalAttack: 'payable' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    expect(state.pendingExtraDeckAttack?.candidateIds).toHaveLength(1)
    const selectedExtraId = state.pendingExtraDeckAttack!.candidateIds[0]!
    state = applyGameCommand(state, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-one',
      extraDeckInstanceId: selectedExtraId,
    })
    expect(state.pendingAbilityEffect?.effects[0]).toMatchObject({ kind: 'damage', amount: 1 })
    const extraTargetCookie = state.players['player-two'].battleArea[0]!
    const extraTarget = extraTargetCookie.card.instanceId
    const extraTargetHpBefore = extraTargetCookie.hpCards.length
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [extraTarget] })
    expect(state.players['player-two'].battleArea[0]!.hpCards.length).toBe(extraTargetHpBefore - 1)

    state = createCardCheckDemoState('BS9-095', { normalAttack: 'payable' })
    const stage = sourceInHand(state, 'BS9-095')
    const placement = state.players['player-one'].supportArea[0]!.card.instanceId
    state = applyGameCommand(state, { kind: 'play-stage', playerId: 'player-one', instanceId: stage.instanceId, paymentIds: [placement] })
    const attacker = state.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-079')!
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: attacker.card.instanceId, targetInstanceId: state.players['player-two'].battleArea[0]!.card.instanceId, supportPaymentIds: state.players['player-one'].supportArea.filter((entry) => !entry.rested).slice(0, 3).map((entry) => entry.card.instanceId) })
    expect(state.pendingStageTrigger?.sourceInstanceId).toBe(stage.instanceId)
    state = applyGameCommand(state, { kind: 'resolve-stage-trigger', playerId: 'player-one', action: 'activate' })
    expect(state.pendingDrawUpTo?.max).toBe(1)

    state = createCardCheckDemoState('BS9-118')
    const stage118 = sourceInHand(state, 'BS9-118')
    const place118 = state.players['player-one'].supportArea[0]!.card.instanceId
    state = applyGameCommand(state, { kind: 'play-stage', playerId: 'player-one', instanceId: stage118.instanceId, paymentIds: [place118] })
    state = { ...state, activePlayerId: 'player-two' }
    const oppHand = state.players['player-two'].hand[0]!.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-stage', playerId: 'player-two', paymentIds: [], discardHandIds: [oppHand], targetIds: [] })
    expect(state.players['player-two'].discardPile.some((card) => card.instanceId === oppHand)).toBe(true)
    expect(state.players['player-one'].stage?.card.id).toBe('BS9-118')
  })

  it('requires an explicit BS9-079 EXTRA choice, including skip, duplicates, and no match', () => {
    const withExtraDeck = (extraDeck: ExtraDeckCard[]): GameState => {
      const base = createCardCheckDemoState('BS9-079', { normalAttack: 'payable' })
      return {
        ...base,
        players: {
          ...base.players,
          'player-one': { ...base.players['player-one'], extraDeck },
        },
      }
    }

    const first = extraCandidate('BS9-102')
    const second = { ...first, instanceId: 'bs9-079-shadow-milk-extra-2' }
    let multiple = withExtraDeck([
      { ...first, instanceId: 'bs9-079-shadow-milk-extra-1' },
      second,
    ])
    multiple = applyGameCommand(multiple, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(multiple.pendingExtraDeckAttack?.candidateIds).toEqual([
      'bs9-079-shadow-milk-extra-1',
      'bs9-079-shadow-milk-extra-2',
    ])
    expect(multiple.pendingAbilityEffect).toBeUndefined()
    expect(() => applyGameCommand(multiple, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-one',
      extraDeckInstanceId: 'not-a-candidate',
    })).toThrow()
    multiple = applyGameCommand(multiple, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-one',
      extraDeckInstanceId: 'bs9-079-shadow-milk-extra-2',
    })
    expect(multiple.pendingExtraDeckAttack).toBeNull()
    expect(multiple.pendingAbilityEffect?.sourceInstanceId).toBe(
      'bs9-079-shadow-milk-extra-2',
    )

    let skipped = withExtraDeck([first])
    skipped = applyGameCommand(skipped, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    skipped = applyGameCommand(skipped, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-one',
    })
    expect(skipped.pendingExtraDeckAttack).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()

    let noMatch = withExtraDeck([])
    noMatch = applyGameCommand(noMatch, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(noMatch.pendingExtraDeckAttack).toBeUndefined()
    expect(noMatch.pendingAbilityEffect).toBeUndefined()
  })

  it('keeps passive refresh and trash-threshold branches honest in both directions', () => {
    const makeRefreshState = (cardNumber: string, discardCount: number) => {
      const base = cardNumber === 'BS9-096'
        ? createCardCheckDemoState(cardNumber)
        : createCardCheckDemoState(cardNumber)
      const player = base.players['player-one']
      const cookies = player.battleArea.map((entry) => entry.card)
      const discardPile = Array.from({ length: discardCount }, (_, index) => ({
        ...(cookies[index % cookies.length]!),
        instanceId: `${cookies[index % cookies.length]!.instanceId}-refresh-${index}`,
      }))
      return {
        ...base,
        players: {
          ...base.players,
          'player-one': {
            ...player,
            deck: [],
            discardPile,
          },
        },
      }
    }
    const noBreak = makeRefreshState('BS9-096', 2)
    const noBreakCookie = noBreak.players['player-one'].discardPile[0]!
    const noBreakResult = refreshDeck(noBreak, 'player-one', noBreakCookie.instanceId, (cards) => cards)
    expect(noBreakResult.players['player-one'].breakArea).toHaveLength(noBreak.players['player-one'].breakArea.length)
    expect(noBreakResult.players['player-one'].deck).toHaveLength(2)
    const blocked096 = createCardNegativeDemoState('BS9-096', { preferSkillSurface: true })
    expect(sourceInBattle(blocked096, 'BS9-096').card.imageUrl).toBe(record('BS9-096').imageUrl)
    expect(blocked096.pendingRefresh?.playerId).toBe('player-two')
    const blocked096Cookie = blocked096.players['player-two'].discardPile[0]!
    const blocked096Result = refreshDeck(blocked096, 'player-two', blocked096Cookie.instanceId, (cards) => cards)
    expect(blocked096Result.players['player-two'].breakArea).toHaveLength(blocked096.players['player-two'].breakArea.length + 1)
    expect(blocked096Result.players['player-two'].deck).toHaveLength(1)

    const blocked111 = createCardNegativeDemoState('BS9-111', { preferSkillSurface: true })
    expect(sourceInBattle(blocked111, 'BS9-111').card.imageUrl).toBe(record('BS9-111').imageUrl)
    expect(blocked111.pendingRefresh?.playerId).toBe('player-one')
    const blocked111Cookie = blocked111.players['player-one'].discardPile[0]!
    const blocked111Result = refreshDeck(blocked111, 'player-one', blocked111Cookie.instanceId, (cards) => cards)
    // BS9-111 only changes the opponent's Refresh; when its controller
    // refreshes, the ordinary one-Cookie break is the truthful negative path.
    expect(blocked111Result.players['player-one'].breakArea).toHaveLength(blocked111.players['player-one'].breakArea.length + 1)
    expect(blocked111Result.players['player-one'].deck).toHaveLength(1)

    const blocked081 = createCardNegativeDemoState('BS9-081', { preferSkillSurface: true })
    expect(sourceInBattle(blocked081, 'BS9-081').card.imageUrl).toBe(record('BS9-081').imageUrl)
    expect(blocked081.activePlayerId).toBe('player-two')
    expect(canActivateCookieSkill(blocked081, 'player-one', sourceInBattle(blocked081, 'BS9-081').card.instanceId, 'activate')).toBe(false)
    const countTwoBase = createCardCheckDemoState('BS9-111')
    const countTwo = {
      ...countTwoBase,
      players: {
        ...countTwoBase.players,
        'player-one': {
          ...countTwoBase.players['player-one'],
          deck: [],
          discardPile: Array.from({ length: 3 }, (_, index) => ({
            ...countTwoBase.players['player-one'].battleArea[index % countTwoBase.players['player-one'].battleArea.length]!.card,
            instanceId: `bs9-111-owner-refresh-${index + 1}`,
          })),
        },
        'player-two': {
          ...countTwoBase.players['player-two'],
          deck: [],
          discardPile: Array.from({ length: 3 }, (_, index) => ({
            ...countTwoBase.players['player-one'].battleArea[index % countTwoBase.players['player-one'].battleArea.length]!.card,
            instanceId: `bs9-111-opponent-refresh-${index + 1}`,
          })),
        },
      },
    }
    const ownerRefreshCookie = countTwo.players['player-one'].discardPile[0]!
    const ownerRefresh = refreshDeck(countTwo, 'player-one', ownerRefreshCookie.instanceId, (cards) => cards)
    // BS9-111 changes the opponent's Refresh, not the controller's own.
    expect(ownerRefresh.players['player-one'].breakArea).toHaveLength(countTwo.players['player-one'].breakArea.length + 1)
    expect(ownerRefresh.players['player-one'].deck).toHaveLength(2)
    const opponentRefreshCookie = countTwo.players['player-two'].discardPile[0]!
    const opponentRefresh = refreshDeck(countTwo, 'player-two', opponentRefreshCookie.instanceId, (cards) => cards)
    expect(opponentRefresh.players['player-two'].breakArea).toHaveLength(countTwo.players['player-two'].breakArea.length + 2)
    expect(opponentRefresh.players['player-two'].deck).toHaveLength(1)

    let state = createCardCheckDemoState('BS9-112', { normalAttack: 'payable' })
    const source = sourceInBattle(state, 'BS9-112')
    expect(getEffectiveAttack(state, source.card.instanceId)).toBe(2)
    state = createCardNegativeDemoState('BS9-112', { normalAttack: 'payable' })
    expect(getEffectiveAttack(state, sourceInBattle(state, 'BS9-112').card.instanceId)).toBe(1)

    state = createCardCheckDemoState('BS9-113')
    const hand = state.players['player-one'].hand[0]!.instanceId
    const cookie = state.players['player-one'].discardPile.find((card) => card.id === 'BS8-014')!.instanceId
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [hand], targetIds: [cookie] })
    expect(state.players['player-one'].hand.some((card) => card.instanceId === cookie)).toBe(true)
    state = createCardNegativeDemoState('BS9-113')
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [state.players['player-one'].hand[0]!.instanceId] })
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS8-014')).toBe(false)
  })

  it('preserves BS9-086 draw Then after the draw empties the deck and Refreshes', () => {
    let state = createCardCheckDemoState('BS9-086')
    const player = state.players['player-one']
    const source = sourceInBattle(state, 'BS9-086')
    const drawnCard = player.deck[0]!
    const handCard = player.hand[0]!
    const refreshCookie = {
      ...source.card,
      instanceId: 'bs9-086-refresh-cookie',
    }
    const remainingDeckCard = {
      ...player.deck[1]!,
      instanceId: 'bs9-086-refresh-deck-card',
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: [drawnCard],
          hand: [handCard],
          discardPile: [refreshCookie, remainingDeckCard],
        },
      },
    }
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(state.pendingRefresh?.afterDrawContinuation?.effects).toEqual([
      expect.objectContaining({ kind: 'discard-hand', destination: 'deck-top' }),
    ])

    state = applyGameCommand(state, {
      kind: 'refresh-deck',
      playerId: 'player-one',
      cookieInstanceId: refreshCookie.instanceId,
    })
    expect(state.pendingRefresh).toBeNull()
    expect(state.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
      destination: 'deck-top',
      chainedFromDrawUpTo: true,
    })
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: [handCard.instanceId],
    })
    expect(state.pendingOpponentHandDiscard).toBeNull()
    expect(state.players['player-one'].deck[0]?.instanceId).toBe(handCard.instanceId)
  })

  it('fires BS9-106～108 only for an own Shadow Milk hand-cost discard', () => {
    for (const cardNumber of ['BS9-106', 'BS9-107', 'BS9-108']) {
      const witness = { ...cookieCandidate(cardNumber), instanceId: `bs9-${cardNumber}-witness` }
      let state = createCardCheckDemoState('BS9-102')
      const extra = state.players['player-one'].extraDeck![0]!
      state = applyGameCommand(state, {
        kind: 'play-extra-deck-cookie',
        playerId: 'player-one',
        instanceId: extra.instanceId,
      })
      state = {
        ...state,
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: [witness],
          },
        },
      }
      state = applyGameCommand(state, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: extra.instanceId,
        trigger: 'activate',
        paymentIds: [],
        discardHandIds: [witness.instanceId],
      })
      state = applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
      const opponentHandCard = state.players['player-two'].hand[0]!
      state = applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-two',
        cardIds: [opponentHandCard.instanceId],
      })
      expect(state.pendingAbilityEffect?.sourceInstanceId, cardNumber).toBe(witness.instanceId)

      if (cardNumber === 'BS9-106') {
        state = applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [],
        })
        expect(state.pendingDrawUpTo?.max, cardNumber).toBe(2)
        state = applyGameCommand(state, {
          kind: 'resolve-draw-up-to',
          playerId: 'player-one',
          drawCount: 1,
        })
        expect(state.pendingAbilityEffect).toBeUndefined()
      } else if (cardNumber === 'BS9-107') {
        const shadowMilk = state.players['player-one'].battleArea.find(
          (entry) => entry.card.instanceId === extra.instanceId,
        )!
        const hpBefore = shadowMilk.hpCards.length
        state = applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [shadowMilk.card.instanceId],
        })
        expect(state.players['player-one'].battleArea.find((entry) => entry.card.instanceId === extra.instanceId)?.hpCards).toHaveLength(hpBefore + 1)
      } else {
        const target = state.players['player-two'].battleArea[0]!
        const trashBefore = state.players['player-two'].discardPile.length
        state = applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [target.card.instanceId],
        })
        expect(state.players['player-two'].discardPile.length).toBe(trashBefore + 1)
      }
    }

    // The same Shadow Milk effect forcing an opponent to discard one of their
    // Chess Pieces must not fire that opponent's trigger: "your Shadow Milk"
    // is controller-scoped, not merely an effect-source label.
    const negativeWitness = { ...cookieCandidate('BS9-106'), instanceId: 'bs9-106-opponent-witness' }
    let negative = createCardCheckDemoState('BS9-102')
    const negativeExtra = negative.players['player-one'].extraDeck![0]!
    negative = applyGameCommand(negative, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: negativeExtra.instanceId,
    })
    negative = {
      ...negative,
      players: {
        ...negative.players,
        'player-two': {
          ...negative.players['player-two'],
          hand: [negativeWitness, ...negative.players['player-two'].hand.slice(1)],
        },
      },
    }
    negative = applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeExtra.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [negative.players['player-one'].hand[0]!.instanceId],
    })
    negative = applyGameCommand(negative, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    negative = applyGameCommand(negative, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [negativeWitness.instanceId],
    })
    expect(negative.players['player-two'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: negativeWitness.instanceId }),
    )
    expect(negative.pendingAbilityEffect).toBeUndefined()
    expect(negative.pendingShadowMilkDiscardTriggers).toBeUndefined()
  })

  it('resolves BS9-116 HP trash and BS9-117 previous-target Then branches', () => {
    let state = createCardCheckDemoState('BS9-116')
    const trap116 = sourceInHand(state, 'BS9-116')
    const target116 = state.players['player-two'].battleArea[0]!
    const targetHpBefore = target116.hpCards.length
    const targetTrashBefore = state.players['player-two'].discardPile.length
    const payment116 = state.players['player-one'].supportArea
      .filter((entry) => !entry.rested)
      .slice(0, 1)
      .map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap116.instanceId,
      paymentIds: payment116,
      targetIds: [target116.card.instanceId],
    })
    expect(state.players['player-two'].battleArea[0]?.hpCards).toHaveLength(targetHpBefore - 1)
    expect(state.players['player-two'].discardPile).toHaveLength(targetTrashBefore + 1)

    const make117 = (trashCount: number): GameState => {
      const initial = createCardCheckDemoState('BS9-117')
      const trashWitness = initial.players['player-two'].battleArea[0]!.card
      return {
        ...initial,
        players: {
          ...initial.players,
          'player-two': {
            ...initial.players['player-two'],
            discardPile: Array.from({ length: trashCount }, (_, index) => ({
              ...trashWitness,
              instanceId: `bs9-117-trash-${trashCount}-${index + 1}`,
            })),
          },
        },
      }
    }
    const resolve117 = (trashCount: number) => {
      let current = make117(trashCount)
      const trap = sourceInHand(current, 'BS9-117')
      const target = current.players['player-two'].battleArea[0]!
      const payment = current.players['player-one'].supportArea
        .filter((entry) => !entry.rested)
        .slice(0, 2)
        .map((entry) => entry.card.instanceId)
      current = applyGameCommand(current, {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: trap.instanceId,
        paymentIds: payment,
        targetIds: [target.card.instanceId],
      })
      return { state: current, targetId: target.card.instanceId }
    }

    const aboveThreshold = resolve117(20)
    expect(aboveThreshold.state.attackModifiers.filter((modifier) => modifier.targetInstanceId === aboveThreshold.targetId).map((modifier) => modifier.amount)).toEqual([-2, -1])
    const belowThreshold = resolve117(19)
    expect(belowThreshold.state.attackModifiers.filter((modifier) => modifier.targetInstanceId === belowThreshold.targetId).map((modifier) => modifier.amount)).toEqual([-2])
  })

  it('resolves BS9-101 purple pick and no-match inspect branches', () => {
    const resolveSkill = (initial: GameState) => {
      let state = initial
      const source = sourceInBattle(state, 'BS9-101')
      const payment = state.players['player-one'].supportArea
        .find((entry) => !entry.rested)?.card.instanceId
      if (!payment) throw new Error('BS9-101 fixture has no payment card')
      state = applyGameCommand(state, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
        trigger: 'activate',
        paymentIds: [payment],
      })
      state = applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
      if (!state.pendingInspectDeck) throw new Error('BS9-101 did not open inspect')
      return state
    }

    let positive = resolveSkill(createCardCheckDemoState('BS9-101'))
    const positiveReveal = positive.pendingInspectDeck!.revealedCards
    const purple = positiveReveal.find((card) => card.energyColor === 'purple')
    expect(purple).toBeDefined()
    const positiveRest = positiveReveal
      .filter((card) => card.instanceId !== purple!.instanceId)
      .map((card) => card.instanceId)
    const handBefore = positive.players['player-one'].hand.length
    const trashBefore = positive.players['player-one'].discardPile.length
    positive = applyGameCommand(positive, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [purple!.instanceId],
      restOrder: positiveRest,
    })
    expect(positive.players['player-one'].hand).toContainEqual(purple)
    expect(positive.players['player-one'].hand).toHaveLength(handBefore + 1)
    expect(positive.players['player-one'].discardPile).toHaveLength(trashBefore + positiveRest.length)
    expect(positive.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(positiveRest),
    )

    let negative = resolveSkill(createCardNegativeDemoState('BS9-101'))
    const negativeReveal = negative.pendingInspectDeck!.revealedCards
    expect(negativeReveal.every((card) => card.energyColor !== 'purple')).toBe(true)
    const negativeHandBefore = negative.players['player-one'].hand.length
    const negativeTrashBefore = negative.players['player-one'].discardPile.length
    negative = applyGameCommand(negative, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: negativeReveal.map((card) => card.instanceId),
    })
    expect(negative.players['player-one'].hand).toHaveLength(negativeHandBefore)
    expect(negative.players['player-one'].discardPile).toHaveLength(negativeTrashBefore + negativeReveal.length)
  })

  it('resolves movement, condition, and target boundaries for 075, 076, 077, 081, 083, and 087', () => {
    for (const mode of [0, 1]) {
      let state = createCardCheckDemoState('BS9-075', { normalAttack: 'payable' })
      const companion = state.players['player-one'].battleArea.find(
        (entry) => entry.card.id !== 'BS9-075',
      )!
      const companionId = companion.card.instanceId
      state = applyGameCommand(state, {
        kind: 'resolve-choose-one',
        playerId: 'player-one',
        modeIndex: mode,
      })
      state = applyGameCommand(state, {
        kind: 'resolve-attack-effect',
        playerId: 'player-one',
        targetIds: [companionId],
      })
      expect(state.players['player-one'].battleArea.some((entry) => entry.card.instanceId === companionId)).toBe(false)
      if (mode === 0) {
        expect(state.players['player-one'].deck[0]?.instanceId).toBe(companionId)
      } else {
        expect(state.players['player-one'].deck.at(-1)?.instanceId).toBe(companionId)
      }
    }

    let optional = createCardCheckDemoState('BS9-077', { normalAttack: 'payable' })
    const optionalSource = sourceInBattle(optional, 'BS9-077')
    optional = applyGameCommand(optional, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 0,
    })
    optional = applyGameCommand(optional, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [optionalSource.card.instanceId],
    })
    expect(optional.players['player-one'].battleArea).toHaveLength(0)
    expect(optional.players['player-one'].deck[0]?.id).toBe('BS9-077')

    const blockedOptional = createCardCheckDemoState('BS9-077', { normalAttack: 'payable' })
    const blockedOptionalChosen = applyGameCommand(blockedOptional, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 0,
    })
    expect(() => applyGameCommand(blockedOptionalChosen, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })).toThrow()

    let topSkill = createCardCheckDemoState('BS9-081')
    const topSource = sourceInBattle(topSkill, 'BS9-081')
    topSkill = applyGameCommand(topSkill, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: topSource.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    topSkill = applyGameCommand(topSkill, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [topSource.card.instanceId],
    })
    expect(topSkill.players['player-one'].deck[0]?.id).toBe('BS9-081')
    expect(topSkill.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS9-081')).toBe(false)

    let drawSkill = createCardCheckDemoState('BS9-083')
    const drawSource = sourceInBattle(drawSkill, 'BS9-083')
    drawSkill = applyGameCommand(drawSkill, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: drawSource.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    drawSkill = applyGameCommand(drawSkill, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(drawSkill.pendingDrawUpTo?.max).toBe(1)
    const drawHandBefore = drawSkill.players['player-one'].hand.length
    drawSkill = applyGameCommand(drawSkill, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(drawSkill.players['player-one'].hand).toHaveLength(drawHandBefore + 1)
    expect(() => applyGameCommand(
      createCardNegativeDemoState('BS9-083'),
      {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: sourceInBattle(createCardNegativeDemoState('BS9-083'), 'BS9-083').card.instanceId,
        trigger: 'activate',
        paymentIds: [],
      },
    )).toThrow()

    let gain = createCardCheckDemoState('BS9-087')
    const gainSource = sourceInBattle(gain, 'BS9-087')
    const gainTarget = gain.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId !== gainSource.card.instanceId,
    )!
    const bluePayment = gain.players['player-one'].supportArea.find(
      (entry) => !entry.rested && entry.card.energyColor === 'blue',
    )!
    const gainHpBefore = gainTarget.hpCards.length
    gain = applyGameCommand(gain, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: gainSource.card.instanceId,
      trigger: 'activate',
      paymentIds: [bluePayment.card.instanceId],
    })
    gain = applyGameCommand(gain, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [gainTarget.card.instanceId],
    })
    expect(gain.players['player-one'].battleArea.find((entry) => entry.card.instanceId === gainTarget.card.instanceId)?.hpCards).toHaveLength(gainHpBefore + 1)
    expect(() => applyGameCommand(
      createCardNegativeDemoState('BS9-087'),
      {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: sourceInBattle(createCardNegativeDemoState('BS9-087'), 'BS9-087').card.instanceId,
        trigger: 'activate',
        paymentIds: [],
      },
    )).toThrow()
  })
})
