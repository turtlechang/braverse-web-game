import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import {
  advancePhase,
  applyGameCommand,
  beginAttack,
  createDemoGame,
  executeCardEffect,
  getAttackEnergyCostForState,
  refreshDeck,
  resolveAttackEffect,
  resolveInspectDeck,
  resolveOptionalCostAttack,
  type CookieCard,
  type GameCard,
} from '../game'
import { createCardCheckDemoState } from '../game/demo'

const formalPath = resolve(
  process.cwd(),
  'data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json',
)

const records = (
  JSON.parse(readFileSync(formalPath, 'utf8')) as { cards: OfficialCardRecord[] }
).cards

const record = (cardNumber: string): OfficialCardRecord => {
  const found = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!found) throw new Error(`Missing BS8 formal card ${cardNumber}`)
  return found
}

const converted = (cardNumber: string) => {
  const result = convertOfficialCardToGameCard(record(cardNumber))
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber} conversion failed: ${result.reason}`)
  }
  return result.gameCard
}

const convertedCookie = (cardNumber: string): CookieCard => {
  const card = converted(cardNumber)
  if (card.type !== 'cookie') throw new Error(`${cardNumber} is not a Cookie`)
  return card
}

describe('BS8 strict contracts: deterministic first batch', () => {
  it('audits EXTRA cards through their isolated adapter, never through the main-deck adapter', () => {
    for (const cardNumber of [
      'BS8-005',
      'BS8-027',
      'BS8-069',
      'BS8-090',
      'BS8-104',
    ]) {
      const audit = analyzeOfficialCardBehavior(record(cardNumber))
      expect(audit.contract.status, `${cardNumber}: ${audit.errors.join(' | ')}`).toBe(
        'verified',
      )
      expect(audit.errors).toEqual([])
    }
  })

  it('BS8-005 remains an EXTRA-only LV.3 direct-play card with its exact On Play and Then damage', () => {
    const mainDeckResult = convertOfficialCardToGameCard(record('BS8-005'))
    expect(mainDeckResult).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-card-type',
    })

    const result = convertOfficialCardToExtraDeckCard(record('BS8-005'))
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') throw new Error('BS8-005 EXTRA conversion failed')

    expect(result.extraDeckCard).toMatchObject({
      id: 'BS8-005',
      name: 'Avatar of Ruin',
      type: 'extra',
      officialType: 'extra',
      level: 3,
      hp: 5,
      attack: 3,
      attackEnergyCost: { red: 3 },
      extraDeckPlayMode: 'enter-battle',
      playRequirement: {
        kind: 'cookies-fainted-this-turn-at-least',
        side: 'self',
        count: 2,
      },
      skill: {
        trigger: 'on-play',
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      },
      attackEffects: [
        { kind: 'damage-all', amount: 1, side: 'opponent' },
        { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
      ],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-005')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-006 binds the Then damage to exactly one Cookie for each player', () => {
    const card = convertedCookie('BS8-006')
    expect(card.attackEffects).toEqual([
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } },
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
    ])
    expect(analyzeOfficialCardBehavior(record('BS8-006')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-003 discards first, then gives every eligible friendly Cookie +1 HP', () => {
    const card = convertedCookie('BS8-003')
    expect(card.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { discardHand: 1 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 1,
          max: 2,
          maxRemainingHp: 4,
          allMatching: true,
        },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      }],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-003')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-002 keeps the conditional HP gain separate from the optional skill Then payment', () => {
    const card = convertedCookie('BS8-002')
    expect(card.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 2 },
        },
        {
          kind: 'optional-cost-attack',
          resolution: 'ability',
          cost: { energy: { red: 1 }, discardHand: 0 },
          effects: [
            { kind: 'draw-up-to', max: 1 },
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      ],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-002')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-003 resolves to every eligible friendly Cookie and rejects a partial selection', () => {
    const base = createDemoGame()
    const hpCard = (instanceId: string): GameCard => ({
      id: instanceId,
      instanceId,
      name: instanceId,
      type: 'item',
    })
    const sourceHp = hpCard('bs8-003-source-hp')
    const allyHpOne = hpCard('bs8-003-ally-hp-1')
    const allyHpTwo = hpCard('bs8-003-ally-hp-2')
    const allyHpThree = hpCard('bs8-003-ally-hp-3')
    const allyHpFour = hpCard('bs8-003-ally-hp-4')
    const deck = base.players['player-one'].deck
    const source = { ...convertedCookie('BS8-003'), instanceId: 'bs8-003-source' }
    const ally = { ...convertedCookie('BS8-006'), instanceId: 'bs8-003-ally' }
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck,
          battleArea: [
            {
              card: source,
              hpCards: [sourceHp],
              rested: false,
              battleEntryId: 'bs8-003-source:battle:1',
            },
            {
              card: ally,
              hpCards: [allyHpOne, allyHpTwo, allyHpThree, allyHpFour],
              rested: false,
              battleEntryId: 'bs8-003-ally:battle:1',
            },
          ],
        },
      },
    }
    const effect = source.skill!.effects[0]
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: source.instanceId }

    expect(() => executeCardEffect(state, context, effect, [source.instanceId])).toThrow(
      '必須選擇所有符合條件的餅乾。',
    )

    const resolved = executeCardEffect(
      state,
      context,
      effect,
      [source.instanceId, ally.instanceId],
    )
    expect(resolved.players['player-one'].battleArea.map((cookie) => cookie.hpCards)).toEqual([
      [sourceHp, deck[0]],
      [allyHpOne, allyHpTwo, allyHpThree, allyHpFour, deck[1]],
    ])

    const sourceAtTwoHp = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [{
            ...state.players['player-one'].battleArea[0],
            hpCards: [sourceHp, allyHpOne],
          }, state.players['player-one'].battleArea[1]],
        },
      },
    }
    expect(() => executeCardEffect(
      sourceAtTwoHp,
      context,
      effect,
      [source.instanceId, ally.instanceId],
    )).toThrow('尚未滿足卡牌效果的發動條件。')
  })

  it('BS8-003 resumes every queued HP gain after a Refresh', () => {
    const base = createDemoGame()
    const hpCard = (instanceId: string): GameCard => ({
      id: instanceId,
      instanceId,
      name: instanceId,
      type: 'item',
    })
    const sourceHp = hpCard('bs8-003-refresh-source-hp')
    const allyHpOne = hpCard('bs8-003-refresh-ally-hp-1')
    const allyHpTwo = hpCard('bs8-003-refresh-ally-hp-2')
    const allyHpThree = hpCard('bs8-003-refresh-ally-hp-3')
    const allyHpFour = hpCard('bs8-003-refresh-ally-hp-4')
    const sourceGain = hpCard('bs8-003-refresh-source-gain')
    const allyGain = hpCard('bs8-003-refresh-ally-gain')
    const refreshCandidates = base.players['player-one'].hand.filter(
      (card): card is CookieCard => card.type === 'cookie' && card.level >= 1,
    )
    const [refreshCookie, reserveCookie] = refreshCandidates
    if (!refreshCookie || !reserveCookie) {
      throw new Error('BS8-003 refresh test requires two LV1+ Cookies in hand')
    }
    const source = {
      ...convertedCookie('BS8-003'),
      instanceId: 'bs8-003-refresh-source',
    }
    const ally = {
      ...convertedCookie('BS8-006'),
      instanceId: 'bs8-003-refresh-ally',
    }
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: base.players['player-one'].hand.filter(
            (card) =>
              card.instanceId !== refreshCookie.instanceId &&
              card.instanceId !== reserveCookie.instanceId,
          ),
          deck: [],
          discardPile: [
            refreshCookie,
            sourceGain,
            allyGain,
            reserveCookie,
          ],
          battleArea: [
            {
              card: source,
              hpCards: [sourceHp],
              rested: false,
              battleEntryId: 'bs8-003-refresh-source:battle:1',
            },
            {
              card: ally,
              hpCards: [allyHpOne, allyHpTwo, allyHpThree, allyHpFour],
              rested: false,
              battleEntryId: 'bs8-003-refresh-ally:battle:1',
            },
          ],
        },
      },
    }
    const effect = source.skill!.effects[0]
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
    }

    const pending = executeCardEffect(
      state,
      context,
      effect,
      [source.instanceId, ally.instanceId],
    )
    expect(pending.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
      remainingHpGains: [
        { targetInstanceId: source.instanceId, amount: 1 },
        { targetInstanceId: ally.instanceId, amount: 1 },
      ],
    })

    const refreshed = refreshDeck(
      pending,
      'player-one',
      refreshCookie.instanceId,
      (cards) => cards,
    )
    expect(refreshed.players['player-one'].battleArea.map((cookie) => cookie.hpCards)).toEqual([
      [sourceHp, sourceGain],
      [allyHpOne, allyHpTwo, allyHpThree, allyHpFour, allyGain],
    ])
    expect(refreshed.pendingRefresh).toBeNull()
  })

  it('BS8-018 preserves both the break-source cost and the source-energy clause', () => {
    const card = converted('BS8-018')
    expect(card.skill).toMatchObject({
      sourceEnergy: { red: 1 },
      effects: [
        { kind: 'break-source-to-trash' },
        { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
      ],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-018')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-061 keeps its two-support-gap passive attack condition', () => {
    expect(convertedCookie('BS8-061').skill).toMatchObject({
      trigger: 'passive',
      effects: [{
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { sourceOnly: true },
        condition: { kind: 'support-count-less-than-opponent', difference: 2 },
      }],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-061')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-023 only damages Cookies with at least two remaining HP', () => {
    const card = converted('BS8-023')
    expect(card.trap?.effects).toEqual([
      { kind: 'damage-all', amount: 1, side: 'self', minRemainingHp: 2 },
      { kind: 'damage-all', amount: 1, side: 'opponent', minRemainingHp: 2 },
    ])
    expect(analyzeOfficialCardBehavior(record('BS8-023')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-021 damages every non-Burning Spice Cookie, then equips its exact trap lock', () => {
    const source = converted('BS8-021')
    const burningSpice = convertedCookie('BS8-009')
    const ally = convertedCookie('BS8-006')
    const opponent = convertedCookie('BS8-006')
    const hpCards = (prefix: string): GameCard[] => [
      {
        id: `${prefix}-hp-1`,
        instanceId: `${prefix}-hp-1`,
        name: `${prefix}-hp-1`,
        type: 'item',
      },
      {
        id: `${prefix}-hp-2`,
        instanceId: `${prefix}-hp-2`,
        name: `${prefix}-hp-2`,
        type: 'item',
      },
    ]
    expect(source.item).toMatchObject({
      cost: { energy: { red: 2 }, discardHand: 0 },
      sourceEnergy: { red: 1 },
      effects: [
        {
          kind: 'damage-all',
          amount: 1,
          side: 'self',
          excludeCardName: 'Burning Spice Cookie',
        },
        {
          kind: 'damage-all',
          amount: 1,
          side: 'opponent',
          excludeCardName: 'Burning Spice Cookie',
        },
        {
          kind: 'equip-source',
          target: { side: 'self', min: 0, max: 1 },
          requiredCookieId: 'BS8-009',
        },
      ],
      equippedAttackEffects: [
        {
          kind: 'disable-traps',
          duration: 'current-battle',
          condition: { kind: 'break-level-at-least', level: 8 },
        },
      ],
    })

    const initial = createDemoGame(7)
    const state = {
      ...initial,
      status: 'playing' as const,
      activePlayerId: 'player-one' as const,
      phase: 'main' as const,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          discardPile: [source],
          battleArea: [
            {
              card: {
                ...burningSpice,
                instanceId: 'burning-spice',
                attackCost: 0,
                attackEnergyCost: {},
              },
              hpCards: hpCards('burning-spice'),
              rested: false,
              battleEntryId: 'burning-spice:1',
            },
            {
              card: { ...ally, instanceId: 'ally' },
              hpCards: hpCards('ally'),
              rested: false,
              battleEntryId: 'ally:1',
            },
          ],
        },
        'player-two': {
          ...initial.players['player-two'],
          battleArea: [{
            card: { ...opponent, instanceId: 'opponent' },
            hpCards: hpCards('opponent'),
            rested: false,
            battleEntryId: 'opponent:1',
          }],
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
      sourceCardName: source.name,
    }
    const afterSelfDamage = executeCardEffect(state, context, source.item!.effects[0], [])
    expect(
      afterSelfDamage.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === 'burning-spice',
      ),
    ).toBe(true)
    expect(
      afterSelfDamage.players['player-one'].battleArea.find(
        (cookie) => cookie.card.instanceId === 'ally',
      )?.hpCards,
    ).toHaveLength(1)

    const afterOpponentDamage = executeCardEffect(
      afterSelfDamage,
      context,
      source.item!.effects[1],
      [],
    )
    expect(afterOpponentDamage.players['player-two'].battleArea[0]?.hpCards).toHaveLength(1)

    const equipped = executeCardEffect(
      afterOpponentDamage,
      context,
      source.item!.effects[2],
      ['burning-spice'],
    )
    expect(equipped.players['player-one'].battleArea[0].equippedCards).toEqual([source])

    const attackReady = {
      ...equipped,
      turnNumber: 2,
      players: {
        ...equipped.players,
        'player-two': {
          ...equipped.players['player-two'],
          battleArea: [{
            card: { ...opponent, instanceId: 'attack-target' },
            hpCards: hpCards('attack-target'),
            rested: false,
            battleEntryId: 'attack-target:1',
          }],
        },
        'player-one': {
          ...equipped.players['player-one'],
          breakArea: Array.from({ length: 8 }, (_, index) => ({
            ...ally,
            instanceId: `break-${index}`,
          })),
        },
      },
    }
    const attacking = beginAttack(attackReady, 'burning-spice', 'attack-target', [])
    expect(attacking.pendingBattle).toMatchObject({ trapsDisabled: true })
    expect(analyzeOfficialCardBehavior(record('BS8-021')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-076 must bottom-deck itself, draw, then let the selected Cookie pay exactly two cards to become active', () => {
    const icicleYeti = convertedCookie('BS8-076')
    const opponent = convertedCookie('BS8-006')
    const energyCard = (instanceId: string): GameCard => ({
      id: instanceId,
      instanceId,
      name: instanceId,
      type: 'item',
      energyColor: 'blue',
    })

    expect(icicleYeti.attackEffects).toEqual([
      {
        kind: 'optional-cost-attack',
        mandatory: true,
        cost: { energy: {}, discardHand: 0, selfToDeckBottom: true },
        effects: [
          { kind: 'draw', amount: 1 },
          {
            kind: 'prevent-cookie-active-next-phase',
            target: { side: 'opponent', min: 0, max: 1 },
            discardHandToSetActive: 2,
          },
        ],
        effectText:
          'Place this Cookie on the bottom of your deck. Draw 1 card from your deck and select up to 1 of your opponent\'s Cookies. During your opponent\'s next Active Phase, that Cookie is not set as active unless your opponent discards 2 cards from their hand.',
      },
    ])

    const initial = createDemoGame(7)
    const source = { ...icicleYeti, instanceId: 'icicle-yeti' }
    const ally = { ...opponent, instanceId: 'icicle-yeti-ally' }
    const target = { ...opponent, instanceId: 'frozen-target' }
    const drawCard = energyCard('draw-after-bottom-deck')
    const opponentHand = [energyCard('opponent-hand-1'), energyCard('opponent-hand-2')]
    const state = {
      ...initial,
      turnNumber: 2,
      activePlayerId: 'player-one' as const,
      phase: 'main' as const,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          battleArea: [
            { card: source, hpCards: [], rested: false, battleEntryId: 'icicle-yeti:1' },
            { card: ally, hpCards: [], rested: false, battleEntryId: 'icicle-yeti-ally:1' },
          ],
          supportArea: [
            { card: energyCard('blue-payment-1'), rested: false },
            { card: energyCard('blue-payment-2'), rested: false },
          ],
          deck: [drawCard],
          hand: [],
        },
        'player-two': {
          ...initial.players['player-two'],
          battleArea: [{
            card: target,
            hpCards: [energyCard('frozen-target-hp')],
            rested: true,
            battleEntryId: 'frozen-target:1',
          }],
          hand: opponentHand,
        },
      },
    }

    const declared = beginAttack(
      state,
      source.instanceId,
      target.instanceId,
      ['blue-payment-1', 'blue-payment-2'],
    )
    const attackEffectState = {
      ...declared,
      pendingBattle: {
        ...declared.pendingBattle!,
        stage: 'attack-effect' as const,
        attackEffects: icicleYeti.attackEffects!,
        attackEffectIndex: 0,
      },
    }
    const awaitingMandatoryCost = resolveAttackEffect(
      attackEffectState,
      'player-one',
      [],
    )

    expect(awaitingMandatoryCost.pendingOptionalCostAttack).toMatchObject({
      mandatory: true,
      cost: { selfToDeckBottom: true },
    })
    expect(() =>
      resolveOptionalCostAttack(awaitingMandatoryCost, 'player-one', 'skip'),
    ).toThrow('必須支付')

    const resolvedAttack = resolveOptionalCostAttack(
      awaitingMandatoryCost,
      'player-one',
      'pay',
      [],
      [target.instanceId],
    )
    expect(
      resolvedAttack.players['player-one'].battleArea.map(
        (cookie) => cookie.card.instanceId,
      ),
    ).not.toContain(source.instanceId)
    expect(resolvedAttack.players['player-one'].deck.map((card) => card.instanceId)).toEqual([
      source.instanceId,
    ])
    expect(resolvedAttack.players['player-one'].hand.map((card) => card.instanceId)).toEqual([
      drawCard.instanceId,
    ])
    expect(resolvedAttack.conditionalCookieActivePreventions).toEqual({
      'player-two': [
        expect.objectContaining({
          cookieInstanceId: target.instanceId,
          discardHandToSetActive: 2,
        }),
      ],
    })
    expect(resolvedAttack.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    const afterReplacement = applyGameCommand(resolvedAttack, {
      kind: 'skip-replacement',
      playerId: 'player-one',
    })

    const opponentActive = advancePhase(advancePhase(afterReplacement))
    const discardDecision = advancePhase(opponentActive)
    expect(discardDecision.phase).toBe('active')
    expect(discardDecision.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 2,
      optional: true,
      activePhaseCookieInstanceId: target.instanceId,
    })
    expect(() =>
      applyGameCommand(discardDecision, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-two',
        cardIds: [opponentHand[0].instanceId],
      }),
    ).toThrow('棄置 0 張或恰好 2 張')

    const declined = applyGameCommand(discardDecision, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [],
    })
    expect(declined.phase).toBe('draw')
    expect(declined.players['player-two'].battleArea[0].rested).toBe(true)

    const paid = applyGameCommand(discardDecision, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: opponentHand.map((card) => card.instanceId),
    })
    expect(paid.phase).toBe('draw')
    expect(paid.players['player-two'].battleArea[0].rested).toBe(false)
    expect(paid.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual(
      opponentHand.map((card) => card.instanceId),
    )
    expect(analyzeOfficialCardBehavior(record('BS8-076')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-071, BS8-096, and BS8-097 retain their conditional limits', () => {
    expect(converted('BS8-071').item).toMatchObject({
      cost: { green: 1 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxRemainingHp: 3 },
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      }],
    })
    expect(converted('BS8-096').item).toMatchObject({
      cost: { blue: 2 },
      effects: [{
        kind: 'draw-up-to',
        max: 4,
        condition: { kind: 'hand-count-at-most', count: 2 },
      }],
    })
    expect(converted('BS8-097').item).toMatchObject({
      cost: { blue: 1 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'hand-count-at-most', count: 2 },
      }],
    })
    for (const cardNumber of ['BS8-071', 'BS8-096', 'BS8-097']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-106 and BS8-112 retain discard-before-Then order', () => {
    expect(convertedCookie('BS8-106').attackEffects).toEqual([
      { kind: 'discard-hand', count: 1 },
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ])
    expect(convertedCookie('BS8-112').attackEffects).toEqual([
      { kind: 'discard-hand', count: 1 },
      { kind: 'trash-to-battle', amount: 1, optional: true, minLevel: 2 },
    ])
    for (const cardNumber of ['BS8-106', 'BS8-112']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-123 and BS8-124 recover only the printed cards from trash', () => {
    expect(converted('BS8-123').trap?.effects).toEqual([
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'trash-to-hand',
        max: 1,
        cardName: 'Soul Jam: Light of Resolution',
      },
    ])
    expect(converted('BS8-124').trap).toMatchObject({
      condition: { kind: 'trash-count-at-least', count: 15 },
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        energyColor: 'purple',
        cookieOnly: true,
      }],
    })
    for (const cardNumber of ['BS8-123', 'BS8-124']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-048 may recover only either printed Soul Jam after its break-level check', () => {
    expect(converted('BS8-048').trap).toMatchObject({
      cost: { energy: { yellow: 1 } },
      condition: { kind: 'break-level-at-least', level: 3 },
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        cardNames: [
          'Soul Jam: Light of Destruction',
          'Soul Jam: Light of Abundance',
        ],
      }],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-048')).contract.status).toBe(
      'verified',
    )
  })

  it('keeps BS8 stage activation costs, target boundaries, and current-turn break entries', () => {
    expect(converted('BS8-024').stageAbility).toMatchObject({
      placementCost: { red: 1 },
      cost: { energy: { red: 2 }, discardHand: 0 },
      restSource: true,
      effects: [
        { kind: 'damage-all', amount: 1, side: 'self' },
        { kind: 'damage-all', amount: 1, side: 'opponent' },
      ],
    })
    expect(converted('BS8-049').stageAbility).toMatchObject({
      placementCost: { yellow: 2 },
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      restSource: true,
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, remainingHp: 1 },
      }],
    })
    expect(converted('BS8-050').stageAbility).toMatchObject({
      placementCost: { yellow: 1 },
      cost: { energy: {}, discardHand: 0 },
      restSource: true,
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          enteredFrom: 'break',
          enteredThisTurn: true,
        },
        thenEffects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 0, max: 1, previousEffectTargetOnly: true },
          condition: { kind: 'previous-effect-target-remaining-hp', remainingHp: 2 },
        }],
      }],
    })
    expect(converted('BS8-099').stageAbility).toMatchObject({
      placementCost: { blue: 1 },
      cost: { energy: { blue: 2 }, discardHand: 0 },
      restSource: true,
      effects: [{
        kind: 'draw-up-to',
        max: 3,
        condition: { kind: 'battle-area-rested-cookie-count-at-least', count: 3 },
      }],
    })
    for (const cardNumber of ['BS8-024', 'BS8-049', 'BS8-050', 'BS8-050@1', 'BS8-099']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('repairs the two merged Cheesebird records without treating their skills as FLIP text', () => {
    expect(converted('BS8-028@1')).toMatchObject({
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'cookie-played-from-break-this-turn' },
        }],
      },
      attack: 3,
      attackCost: 3,
      attackEnergyCost: { yellow: 3 },
    })
    expect(converted('BS8-029@1')).toMatchObject({
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        effects: [{
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'cookie-played-from-break-this-turn' },
        }],
      },
      attack: 2,
      attackCost: 2,
      attackEnergyCost: { yellow: 2 },
    })
    for (const cardNumber of ['BS8-028@1', 'BS8-029@1']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('keeps the red self-faint costs before their exact recovery or damage effects', () => {
    expect(converted('BS8-022').item).toMatchObject({
      cost: {
        energy: { red: 1 },
        trashBattleCookie: { count: 1 },
      },
      effects: [{
        kind: 'trash-to-hand',
        max: 2,
        energyColor: 'red',
        cookieOnly: true,
        maxLevel: 1,
      }],
    })

    for (const cardNumber of ['BS8-024@1', 'BS8-025']) {
      expect(converted(cardNumber).stageAbility).toMatchObject({
        placementCost: { red: 2 },
        cost: {
          energy: { red: 1 },
          trashBattleCookie: { count: 1 },
        },
        restSource: true,
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
      })
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
    expect(analyzeOfficialCardBehavior(record('BS8-022')).contract.status).toBe(
      'verified',
    )
  })

  it('keeps BS8-060 choice modes behind an exactly one green support return cost', () => {
    expect(convertedCookie('BS8-060').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: {
        energy: {},
        discardHand: 0,
        supportToHand: 1,
        supportToHandColor: 'green',
      },
      effects: [{
        kind: 'choose-one',
        modes: [
          {
            effects: [{
              kind: 'gain-hp',
              amount: 1,
              target: { side: 'self', min: 0, max: 1 },
            }],
          },
          {
            effects: [{
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            }],
          },
        ],
      }],
    })
    for (const cardNumber of ['BS8-060', 'BS8-060@1']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-122 requires one purple non-Cookie hand card before drawing up to two', () => {
    expect(converted('BS8-122').item).toMatchObject({
      cost: {
        energy: { purple: 1 },
        discardHand: 1,
        discardHandColor: 'purple',
        discardHandNonCookie: true,
      },
      effects: [{ kind: 'draw-up-to', max: 2 }],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-122')).contract.status).toBe(
      'verified',
    )
  })

  it('applies BS8-075 and BS8-125 static stage attack-cost modifiers by their printed owners', () => {
    expect(converted('BS8-075').stageAbility).toMatchObject({
      placementCost: { green: 1 },
      staticAttackCostModifiers: [{
        operation: 'increase',
        energyCost: { neutral: 1 },
        appliesTo: 'all-players',
        condition: { kind: 'support-count-at-least', count: 6, player: 'affected-player' },
      }],
    })
    expect(converted('BS8-125').stageAbility).toMatchObject({
      placementCost: { purple: 2 },
      staticAttackCostModifiers: [{
        operation: 'reduce',
        energyCost: { purple: 1 },
        appliesTo: 'stage-owner',
        targetCardName: 'Dark Cacao Cookie',
        condition: { kind: 'trash-count-at-least', count: 15, player: 'stage-owner' },
      }],
    })

    const supportCards = (prefix: string, count: number) => Array.from(
      { length: count },
      (_, index) => ({
        card: {
          id: `${prefix}-${index}`,
          instanceId: `${prefix}-${index}`,
          name: `${prefix}-${index}`,
          type: 'item' as const,
          energyColor: 'green' as const,
        },
        rested: false,
      }),
    )
    let state = createDemoGame(7)
    const one = state.players['player-one']
    const two = state.players['player-two']
    const oneAttacker = {
      ...one.battleArea[0],
      card: { ...one.battleArea[0].card, attackCost: 1, attackEnergyCost: { red: 1 } },
    }
    const twoAttacker = {
      ...two.battleArea[0],
      card: { ...two.battleArea[0].card, attackCost: 1, attackEnergyCost: { red: 1 } },
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...one,
          stage: { card: converted('BS8-075'), rested: false },
          supportArea: supportCards('one-support', 6),
          battleArea: [oneAttacker],
        },
        'player-two': {
          ...two,
          supportArea: supportCards('two-support', 5),
          battleArea: [twoAttacker],
        },
      },
    }
    expect(getAttackEnergyCostForState(state, oneAttacker.card.instanceId)).toEqual({
      red: 1,
      neutral: 1,
    })
    expect(getAttackEnergyCostForState(state, twoAttacker.card.instanceId)).toEqual({ red: 1 })

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          stage: { card: converted('BS8-125'), rested: false },
          discardPile: Array.from({ length: 15 }, (_, index) => ({
            id: `trash-${index}`,
            instanceId: `trash-${index}`,
            name: `trash-${index}`,
            type: 'item' as const,
          })),
          battleArea: [{
            ...oneAttacker,
            card: {
              ...oneAttacker.card,
              name: 'Dark Cacao Cookie',
              attackCost: 3,
              attackEnergyCost: { purple: 2, red: 1 },
            },
          }],
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [{
            ...twoAttacker,
            card: {
              ...twoAttacker.card,
              name: 'Dark Cacao Cookie',
              attackCost: 3,
              attackEnergyCost: { purple: 2, red: 1 },
            },
          }],
        },
      },
    }
    expect(getAttackEnergyCostForState(state, oneAttacker.card.instanceId)).toEqual({
      purple: 1,
      red: 1,
    })
    expect(getAttackEnergyCostForState(state, twoAttacker.card.instanceId)).toEqual({
      purple: 2,
      red: 1,
    })
    for (const cardNumber of ['BS8-075', 'BS8-075@1', 'BS8-125', 'BS8-125@1']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-072 puts the selected reveal active in support, rests the remainder, then equips Mystic Flour with +1 HP', () => {
    const source = converted('BS8-072')
    const mysticFlour = convertedCookie('BS8-059')
    const supportCard = (instanceId: string): GameCard => ({
      id: instanceId,
      instanceId,
      name: instanceId,
      type: 'item',
      energyColor: 'green',
    })
    expect(source.item).toMatchObject({
      cost: { energy: { green: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'inspect-deck',
          lookCount: 2,
          pickCount: 1,
          restDestination: 'support-rested',
          pickDestination: 'support',
          pickSupportRested: false,
          optionalPick: true,
          condition: { kind: 'support-count-less-than-opponent', difference: 1 },
        },
        {
          kind: 'equip-source',
          target: { side: 'self', min: 0, max: 1 },
          requiredCookieId: 'BS8-059',
          gainHp: 1,
        },
      ],
    })

    const initial = createDemoGame(7)
    const firstReveal = supportCard('first-reveal')
    const secondReveal = supportCard('second-reveal')
    const hpBonus = supportCard('mystic-hp-bonus')
    const state = {
      ...initial,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          deck: [firstReveal, secondReveal, hpBonus],
          discardPile: [source],
          supportArea: [],
          battleArea: [{
            card: mysticFlour,
            hpCards: [supportCard('mystic-existing-hp')],
            rested: false,
            battleEntryId: 'mystic:1',
          }],
        },
        'player-two': {
          ...initial.players['player-two'],
          supportArea: [{ card: supportCard('opponent-support'), rested: false }],
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
      sourceCardName: source.name,
    }
    const inspect = executeCardEffect(
      state,
      context,
      source.item!.effects[0],
      [],
    )
    const afterReveal = resolveInspectDeck(
      inspect,
      'player-one',
      [firstReveal.instanceId],
      [secondReveal.instanceId],
    )
    expect(afterReveal.players['player-one'].supportArea).toEqual([
      { card: firstReveal, rested: false },
      { card: secondReveal, rested: true },
    ])

    const equipped = executeCardEffect(
      afterReveal,
      context,
      source.item!.effects[1],
      [mysticFlour.instanceId],
    )
    expect(equipped.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(equipped.players['player-one'].battleArea[0].equippedCards).toEqual([source])
    expect(equipped.players['player-one'].discardPile).not.toContainEqual(source)
    for (const cardNumber of ['BS8-072', 'BS8-072@1']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-100 pays its source-to-trash cost, accepts only blue discards, then draws exactly that many', () => {
    const blueCard = (instanceId: string): GameCard => ({
      id: instanceId,
      instanceId,
      name: instanceId,
      type: 'item',
      energyColor: 'blue',
    })
    const redCard: GameCard = {
      id: 'red-hand',
      instanceId: 'red-hand',
      name: 'red-hand',
      type: 'item',
      energyColor: 'red',
    }
    const stage = converted('BS8-100')
    expect(stage.stageAbility).toMatchObject({
      placementCost: { blue: 1 },
      cost: {
        energy: { blue: 1 },
        discardHand: 0,
        stageSourceToTrash: true,
      },
      effects: [{ kind: 'discard-hand-then-draw-same', energyColor: 'blue' }],
    })

    const initial = createDemoGame(7)
    const state = {
      ...initial,
      activePlayerId: 'player-one' as const,
      phase: 'main' as const,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          stage: { card: stage, rested: false },
          supportArea: [{ card: blueCard('blue-payment'), rested: false }],
          hand: [blueCard('blue-hand'), redCard],
          deck: [blueCard('draw-one'), blueCard('draw-two')],
        },
      },
    }

    const pending = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['blue-payment'],
    })
    expect(pending.players['player-one'].stage).toBeNull()
    expect(pending.players['player-one'].discardPile).toContainEqual(stage)
    expect(pending.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 0,
      atLeast: true,
      energyColor: 'blue',
      drawEqualDiscarded: true,
    })
    expect(() =>
      applyGameCommand(pending, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-one',
        cardIds: [redCard.instanceId],
      }),
    ).toThrow('只能選擇 blue 能量顏色的手牌')

    const resolved = applyGameCommand(pending, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: ['blue-hand'],
    })
    expect(resolved.pendingOpponentHandDiscard).toBeNull()
    expect(resolved.players['player-one'].hand.map((card) => card.instanceId)).toEqual([
      redCard.instanceId,
      'draw-one',
    ])
    expect(resolved.players['player-one'].deck.map((card) => card.instanceId)).toEqual([
      'draw-two',
    ])
    expect(resolved.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([stage, expect.objectContaining({ instanceId: 'blue-hand' })]),
    )
    for (const cardNumber of ['BS8-100', 'BS8-100@1']) {
      expect(analyzeOfficialCardBehavior(record(cardNumber)).contract.status).toBe(
        'verified',
      )
    }
  })

  it('BS8-047 locks the displayed LV.3 hand Cookie as the exact Then-to-Break card', () => {
    const source = converted('BS8-047')
    const revealed = convertedCookie('BS8-026')
    const breakCookie = convertedCookie('BS8-039')
    const initial = createDemoGame(7)
    const state = {
      ...initial,
      phase: 'main' as const,
      activePlayerId: 'player-one' as const,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          hand: [source, revealed],
          breakArea: [breakCookie],
          supportArea: [{
            card: {
              id: 'yellow-payment',
              instanceId: 'yellow-payment',
              name: 'yellow-payment',
              type: 'item' as const,
              energyColor: 'yellow' as const,
            },
            rested: false,
          }],
        },
      },
    }

    expect(source.item).toMatchObject({
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: [
        { kind: 'reveal-hand', amount: 1, selectCard: true, minLevel: 3, maxLevel: 3 },
        { kind: 'break-to-battle', amount: 1, optional: true, exactLevel: 3, energyColor: 'yellow' },
        { kind: 'hand-to-break', amount: 1, revealedCardOnly: true },
      ],
    })

    const queued = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: source.instanceId,
      paymentIds: ['yellow-payment'],
    })
    expect(queued.pendingAbilityEffect?.effects[0].kind).toBe('reveal-hand')

    const afterReveal = applyGameCommand(queued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [revealed.instanceId],
    })
    expect(afterReveal.costRecord).toMatchObject({
      revealedHandCardInstanceIds: [revealed.instanceId],
      revealedHandSourceInstanceId: source.instanceId,
    })
    expect(afterReveal.players['player-one'].hand).toContainEqual(revealed)

    const afterPlay = applyGameCommand(afterReveal, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [breakCookie.instanceId],
    })
    expect(afterPlay.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([expect.objectContaining({ card: breakCookie })]),
    )

    const resolved = applyGameCommand(afterPlay, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.players['player-one'].breakArea).toContainEqual(revealed)
    expect(resolved.players['player-one'].hand).not.toContainEqual(revealed)
    expect(analyzeOfficialCardBehavior(record('BS8-047')).contract.status).toBe(
      'verified',
    )
  })

  it('BS8-043 binds +1 HP to the sole remaining LV.3 battle slot that entered from break this turn', () => {
    expect(convertedCookie('BS8-043').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 1,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          enteredFrom: 'break',
          enteredThisTurn: true,
        },
      }],
    })
    expect(analyzeOfficialCardBehavior(record('BS8-043')).contract.status).toBe(
      'verified',
    )

    const state = createCardCheckDemoState('BS8-043')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS8-043',
    )
    const target = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    if (!source || !target) throw new Error('BS8-043 fixture requires source and sole target')

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: ['support-pay-0'],
    })
    expect(activated.pendingAbilityEffect?.effects).toHaveLength(1)

    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
    })
    expect(
      resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === target.card.instanceId,
      )?.hpCards,
    ).toHaveLength(5)
  })
})
