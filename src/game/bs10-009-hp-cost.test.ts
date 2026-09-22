import { describe, expect, it } from 'vitest'
import bs10 from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getCardPoolEntry } from './card-pool'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'
import { materializeExtraDeckCookie } from './extra-deck'

const candidate = (id: string, suffix: string): GameCard => {
  const record = (bs10.cards as unknown as OfficialCardRecord[]).find((card) => card.cardNumber === id)
  if (!record) throw new Error(`Missing candidate ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-009-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const official = (id: string, suffix: string): GameCard => {
  const record = getCardPoolEntry(id)
  if (!record) throw new Error(`Missing formal ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-009-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string) => {
  const card = id.startsWith('BS10-') ? candidate(id, suffix) : official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const physicalIds = (state: GameState) => Object.values(state.players).flatMap((player) => [
  ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
  ...player.supportArea.map(({ card }) => card),
  ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? []), ...(entry.awakenedUnderlay ?? [])]),
]).map((card) => card.instanceId).sort()

const entry = (card: GameCard, hpCards: GameCard[], id: string): CookieInBattle => ({
  card: card as CookieInBattle['card'], hpCards, rested: false, battleEntryId: id,
})

const setup = (sourceHpCount: number, allyHpCount = 2, options: { hand?: GameCard[]; deck?: GameCard[]; allyId?: string; allyHpCard?: GameCard; sourceEquippedCards?: GameCard[]; allyEquippedCards?: GameCard[] } = {}) => {
  const base = createBattleState()
  const source = cookie('BS10-009', `source-${sourceHpCount}`)
  const ally = cookie(options.allyId ?? 'BS6-047', `ally-${sourceHpCount}`)
  const hpSource = Array.from({ length: sourceHpCount }, (_, index) => official('BS6-047', `source-hp-${sourceHpCount}-${index}`))
  const allyTop = candidate('BS10-008', `ally-flip-${sourceHpCount}`)
  const allyBottom = official('BS6-047', `ally-bottom-${sourceHpCount}`)
  const opponent = cookie('BS6-079', `opponent-${sourceHpCount}`)
  const supports = [{ card: official('BS6-002', `support-a-${sourceHpCount}`), rested: false }, { card: official('BS6-002', `support-b-${sourceHpCount}`), rested: false }]
  const state: GameState = {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          { ...entry(source, hpSource, `${source.instanceId}:battle`), ...(options.sourceEquippedCards ? { equippedCards: options.sourceEquippedCards } : {}) },
          { ...entry(ally, allyHpCount === 1 ? [options.allyHpCard ?? allyTop] : [allyBottom, options.allyHpCard ?? allyTop], `${ally.instanceId}:battle`), ...(options.allyEquippedCards ? { equippedCards: options.allyEquippedCards } : {}) },
        ],
        hand: options.hand ?? [],
        deck: options.deck ?? [official('BS6-047', `deck-${sourceHpCount}`)],
        supportArea: supports,
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [entry(opponent, [official('BS6-079', `opponent-hp-${sourceHpCount}`)], `${opponent.instanceId}:battle`)],
      },
    },
  }
  return { state, source, ally, allyTop, opponent }
}

const activate = (state: GameState, source: GameCard, target: GameCard) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId,
  trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [target.instanceId],
})

describe('BS10-009 Cranberry Cookie HP cost runtime', () => {
  it('pays the source final HP, moves the source to break, and preserves the pending ability chain', () => {
    const { state, source, ally } = setup(1, 2)
    const beforeIds = physicalIds(state)
    const paid = activate(state, source, source)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)).toBeUndefined()
    expect(paid.players['player-one'].breakArea).toContainEqual(source)
    expect(paid.players['player-one'].discardPile[0]).toMatchObject({ instanceId: `BS6-047:source-hp-1-0` })
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(paid.departedCookieCounts?.['player-one']).toBe(1)
    expect(paid.pendingAbilityEffect).toBeTruthy()
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(finished.attackCostModifiers?.some((modifier) => modifier.targetInstanceId === ally.instanceId)).toBe(false)
    expect(finished.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(finished.departedCookieCounts?.['player-one']).toBe(0)
    expect(finished.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(physicalIds(finished)).toEqual(beforeIds)
    expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === ally.instanceId)?.hpCards).toHaveLength(2)
  })

  it('can pay another real LV2+ Cookie final HP while the LV2 source remains', () => {
    const { state, source, ally, allyTop } = setup(2, 1)
    const beforeIds = physicalIds(state)
    const paid = activate(state, source, ally)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.hpCards).toHaveLength(2)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === ally.instanceId)).toBeUndefined()
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(allyTop.instanceId)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(paid.departedCookieCounts?.['player-one']).toBe(1)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(resolved.departedCookieCounts?.['player-one']).toBe(0)
    expect(finished.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(finished.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(physicalIds(finished)).toEqual(beforeIds)
    expect(finished.pendingReplacement).toBeNull()
  })

  it('cleans HP and awakened underlay for a prepared awakened final-HP target', () => {
    const awakened = convertOfficialCardToExtraDeckCard(getCardPoolEntry('BS8-027')!)
    if (awakened.status !== 'converted') throw new Error('Expected formal Awakened card')
    const underlay = cookie('BS8-026', '009-awakened-underlay')
    const { state, source } = setup(2, 1, { allyHpCard: official('BS6-047', '009-awakened-hp') })
    const allyEntry = state.players['player-one'].battleArea[1]
    const awakenedCard = { ...materializeExtraDeckCookie(awakened.extraDeckCard), instanceId: 'BS8-027:009-awakened' }
    allyEntry.card = awakenedCard
    allyEntry.awakenedUnderlay = [underlay]
    const beforeIds = physicalIds(state)
    const paid = activate(state, source, awakenedCard)
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([
      'BS6-047:009-awakened-hp', underlay.instanceId,
    ]))
    expect(paid.players['player-one'].breakArea).toContainEqual(awakenedCard)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.departedCookieCounts?.['player-one']).toBe(1)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(finished.pendingReplacement).toBeNull()
    expect(finished.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(physicalIds(finished)).toEqual(beforeIds)
  })

  it('cleans a legal BS8-021 equipment from a real Burning Spice final-HP faint', () => {
    const equipment = official('BS8-021', '009-burning-spice-equipment')
    const burningSpice = cookie('BS8-009', '009-burning-spice-target')
    expect(burningSpice.level).toBeGreaterThanOrEqual(2)
    const { state, source } = setup(2, 1, { allyHpCard: official('BS6-047', '009-burning-spice-hp') })
    const allyEntry = state.players['player-one'].battleArea[1]
    allyEntry.card = burningSpice as CookieInBattle['card']
    allyEntry.equippedCards = [equipment]
    const beforeIds = physicalIds(state)
    const paid = activate(state, source, burningSpice)
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([
      'BS6-047:009-burning-spice-hp', equipment.instanceId,
    ]))
    expect(paid.players['player-one'].breakArea).toContainEqual(burningSpice)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.departedCookieCounts?.['player-one']).toBe(1)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(finished.pendingReplacement).toBeNull()
    expect(finished.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(physicalIds(finished)).toEqual(beforeIds)
  })

  it.each([0, 2] as const)('counts a real BS6-071 faint once and resolves its draw-up-to choice: %i', (drawCount) => {
    const deck = [official('BS6-047', `soda-draw-a-${drawCount}`), official('BS6-047', `soda-draw-b-${drawCount}`), official('BS6-047', `soda-draw-c-${drawCount}`)]
    const { state, source, ally } = setup(2, 1, {
      allyId: 'BS6-071',
      allyHpCard: official('BS6-047', `soda-hp-${drawCount}`),
      deck,
    })
    const beforeIds = physicalIds(state)
    const paid = activate(state, source, ally)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === ally.instanceId)).toBeUndefined()
    expect(paid.pendingAbilityEffect).toBeTruthy()
    let resolved = applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.pendingDrawUpTo?.max).toBe(2)
    resolved = applyGameCommand(resolved, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
    if (resolved.pendingAbilityEffect) {
      resolved = applyGameCommand(resolved, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    }
    const drawn = resolved
    const completed = drawn.pendingReplacement
      ? applyGameCommand(drawn, { kind: 'skip-replacement', playerId: 'player-one' })
      : drawn
    expect(completed.players['player-one'].hand).toHaveLength(drawCount)
    expect(completed.players['player-one'].hand.map((card) => card.instanceId)).toEqual(deck.slice(0, drawCount).map((card) => card.instanceId))
    expect(completed.players['player-one'].deck.map((card) => card.instanceId)).toEqual(deck.slice(drawCount).map((card) => card.instanceId))
    expect(completed.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(completed.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(completed.pendingDrawUpTo).toBeNull()
    expect(completed.pendingFaintEffects ?? null).toBeNull()
    expect(completed.pendingAbilityEffect).toBeUndefined()
    expect(completed.pendingReplacement).toBeNull()
    expect(completed.attackCostModifiers).toContainEqual(expect.objectContaining({ targetInstanceId: source.instanceId, energyCost: { red: 1 } }))
    expect(physicalIds(completed)).toEqual(beforeIds)
    expect(completed.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.hpCards).toHaveLength(2)
  })

  it('keeps a Cookie with remaining HP in play and applies the reduced red attack cost', () => {
    const { state, source, ally, allyTop, opponent } = setup(2, 2)
    const paid = activate(state, source, ally)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.hpCards).toHaveLength(2)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === ally.instanceId)?.hpCards).toHaveLength(1)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).not.toBe(1)
    expect(paid.departedCookieCounts?.['player-one']).toBe(0)
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(allyTop.instanceId)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const payment = resolved.players['player-one'].supportArea[0]!.card.instanceId
    const attacked = applyGameCommand(resolved, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: source.instanceId, targetInstanceId: opponent.instanceId, supportPaymentIds: [payment] })
    expect(attacked.pendingBattle?.attackerInstanceId).toBe(source.instanceId)
    expect(attacked.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(1)
  })

  it.each([0, 1] as const)('applies the real BS5-010 optional attack HP cost once before its draw choice: %i', (drawCount) => {
    const base = createBattleState()
    const source = cookie('BS5-010', `starch-source-${drawCount}`)
    const survivor = cookie('BS6-079', `starch-survivor-${drawCount}`)
    const opponent = cookie('BS6-079', `starch-opponent-${drawCount}`)
    const supports = Array.from({ length: 4 }, (_, index) => ({ card: official('BS6-002', `starch-support-${drawCount}-${index}`), rested: false }))
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(source, [official('BS6-047', `starch-source-hp-${drawCount}`)], `${source.instanceId}:battle`), entry(survivor, [official('BS6-047', `starch-survivor-hp-${drawCount}`)], `${survivor.instanceId}:battle`)],
          hand: [official('BS6-019', `starch-hand-${drawCount}`)],
          deck: [official('BS6-019', `starch-deck-a-${drawCount}`), official('BS6-019', `starch-deck-b-${drawCount}`), official('BS6-019', `starch-deck-c-${drawCount}`)],
          supportArea: supports,
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(opponent, Array.from({ length: 5 }, (_, index) => official('BS6-047', `starch-opponent-hp-${drawCount}-${index}`)), `${opponent.instanceId}:battle`)],
        },
      },
    }
    const beforeIds = physicalIds(state)
    const handBefore = state.players['player-one'].hand.map((card) => card.instanceId)
    let current = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: source.instanceId,
      targetInstanceId: opponent.instanceId, supportPaymentIds: supports.map(({ card }) => card.instanceId),
    })
    if (current.pendingBattle?.stage === 'trap') current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-two' })
    while (current.pendingBattle?.stage === 'damage') current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(current.pendingBattle?.stage).toBe('attack-effect')
    current = applyGameCommand(current, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    expect(current.pendingOptionalCostAttack).toBeTruthy()
    const paid = applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [], targetIds: [],
      hpToTrashIds: [source.instanceId], discardCardIds: [],
    })
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)).toBeUndefined()
    expect(paid.players['player-one'].breakArea).toContainEqual(source)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.cookiesFaintedThisTurnDetails?.['player-one']).toHaveLength(1)
    expect(paid.pendingDrawUpTo?.max).toBe(1)
    expect(paid.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
    current = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
    if (current.pendingReplacement) current = applyGameCommand(current, { kind: 'skip-replacement', playerId: 'player-one' })
    expect(current.players['player-one'].hand.map((card) => card.instanceId)).toEqual([...handBefore, ...state.players['player-one'].deck.slice(0, drawCount).map((card) => card.instanceId)])
    expect(current.players['player-one'].deck.map((card) => card.instanceId)).toEqual(state.players['player-one'].deck.slice(drawCount).map((card) => card.instanceId))
    expect(current.pendingFaintEffects ?? null).toBeNull()
    expect(current.pendingReplacement ?? null).toBeNull()
    expect(current.pendingBattle).toBeNull()
    expect(current.pendingDrawUpTo).toBeNull()
    expect(current.pendingOptionalCostAttack).toBeNull()
    expect(current.players['player-two'].battleArea.find((entry) => entry.card.instanceId === opponent.instanceId)?.hpCards).toHaveLength(1)
    expect(physicalIds(current)).toEqual(beforeIds)
  })

  it('stops a real BS5-010 optional HP cost at the break-level victory boundary', () => {
    const base = createBattleState()
    const source = cookie('BS5-010', 'starch-victory-source')
    const survivor = cookie('BS6-079', 'starch-victory-survivor')
    const opponent = cookie('BS6-079', 'starch-victory-opponent')
    const supports = Array.from({ length: 4 }, (_, index) => ({ card: official('BS6-002', `starch-victory-support-${index}`), rested: false }))
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(source, [official('BS6-047', 'starch-victory-source-hp')], `${source.instanceId}:battle`), entry(survivor, [official('BS6-047', 'starch-victory-survivor-hp')], `${survivor.instanceId}:battle`)],
          hand: [official('BS6-019', 'starch-victory-hand')],
          deck: [official('BS6-019', 'starch-victory-deck-a'), official('BS6-019', 'starch-victory-deck-b')],
          supportArea: supports,
          breakArea: [cookie('BS6-079', 'starch-victory-break-a'), cookie('BS6-079', 'starch-victory-break-b'), cookie('BS6-002', 'starch-victory-break-c')],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(opponent, Array.from({ length: 5 }, (_, index) => official('BS6-047', `starch-victory-opponent-hp-${index}`)), `${opponent.instanceId}:battle`)],
        },
      },
    }
    let current = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: source.instanceId,
      targetInstanceId: opponent.instanceId, supportPaymentIds: supports.map(({ card }) => card.instanceId),
    })
    if (current.pendingBattle?.stage === 'trap') current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-two' })
    while (current.pendingBattle?.stage === 'damage') current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-two' })
    current = applyGameCommand(current, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    const defeated = applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [], targetIds: [],
      hpToTrashIds: [source.instanceId], discardCardIds: [],
    })
    expect(defeated.status).toBe('finished')
    expect(defeated.pendingOptionalCostAttack ?? null).toBeNull()
    expect(defeated.pendingDrawUpTo ?? null).toBeNull()
    expect(defeated.result).toBeTruthy()
  })

  it('stops a real BS6-003 Then damage when a final-HP BS5-007 faint reaches break level ten', () => {
    const base = createBattleState()
    const source = cookie('BS6-003', 'strawberry-source')
    const faintingTarget = cookie('BS5-007', 'macaron-target')
    const opponent = cookie('BS6-079', 'break-limit-opponent')
    const supports = Array.from({ length: 3 }, (_, index) => ({ card: official('BS6-002', `break-limit-support-${index}`), rested: false }))
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            entry(source, [official('BS6-047', 'break-limit-source-hp')], `${source.instanceId}:battle`),
            entry(faintingTarget, [official('BS6-047', 'break-limit-target-hp')], `${faintingTarget.instanceId}:battle`),
          ],
          hand: [official('BS6-019', 'break-limit-red-item')],
          deck: [official('BS6-019', 'break-limit-deck-a'), official('BS6-019', 'break-limit-deck-b')],
          supportArea: supports,
          breakArea: [cookie('BS6-079', 'break-limit-a'), cookie('BS6-079', 'break-limit-b'), cookie('BS6-079', 'break-limit-c')],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(opponent, Array.from({ length: 5 }, (_, index) => official('BS6-047', `break-limit-opponent-hp-${index}`)), `${opponent.instanceId}:battle`)],
        },
      },
    }
    let current = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: source.instanceId,
      targetInstanceId: opponent.instanceId, supportPaymentIds: supports.map(({ card }) => card.instanceId),
    })
    if (current.pendingBattle?.stage === 'trap') current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-two' })
    while (current.pendingBattle?.stage === 'damage') current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(current.players['player-two'].battleArea.find((entry) => entry.card.instanceId === opponent.instanceId)?.hpCards).toHaveLength(2)
    current = applyGameCommand(current, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    const defeated = applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [], targetIds: [opponent.instanceId],
      hpToTrashIds: [faintingTarget.instanceId], discardCardIds: [],
    })
    expect(defeated.status).toBe('finished')
    expect(defeated.result).toMatchObject({ reason: 'break-level-limit' })
    expect(defeated.players['player-two'].battleArea.find((entry) => entry.card.instanceId === opponent.instanceId)?.hpCards).toHaveLength(2)
    expect(defeated.pendingOptionalCostAttack ?? null).toBeNull()
    expect(defeated.pendingFaintEffects ?? null).toBeNull()
  })

  it('rejects wrong-side HP target and LV1 target immutably', () => {
    const { state, source, opponent } = setup(2)
    const wrong = structuredClone(state)
    expect(() => activate(state, source, opponent)).toThrow()
    expect(state).toEqual(wrong)
    const lv1 = cookie('BS6-017', 'lv1-target')
    const withLv1: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], battleArea: [state.players['player-one'].battleArea[0]!, entry(lv1, [official('BS6-047', 'lv1-hp')], 'lv1-target:battle')] } } }
    const snapshot = structuredClone(withLv1)
    expect(() => activate(withLv1, source, lv1)).toThrow()
    expect(withLv1).toEqual(snapshot)
  })

  it('does not activate the FLIP on a real BS10-008 HP card used as the cost', () => {
    const { state, source, ally, allyTop } = setup(2, 2, {
      hand: [official('BS6-002', '009-flip-payment')],
      deck: [official('BS6-047', '009-flip-deck-a'), official('BS6-047', '009-flip-deck-b')],
    })
    const paid = activate(state, source, ally)
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(allyTop.instanceId)
    expect(paid.pendingBattle).toBeNull()
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === ally.instanceId)?.hpCards).toHaveLength(1)
  })

  it('rejects missing, duplicate, excess and unknown HP target selections without mutation', () => {
    const { state, source, ally } = setup(2)
    const cases = [[], [ally.instanceId, ally.instanceId], [ally.instanceId, source.instanceId], ['unknown-hp-target']]
    for (const hpToTrashTargetIds of cases) {
      const snapshot = structuredClone(state)
      expect(() => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [], hpToTrashTargetIds })).toThrow()
      expect(state).toEqual(snapshot)
    }
  })
})
