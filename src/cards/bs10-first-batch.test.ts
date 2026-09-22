import { describe, expect, it } from 'vitest'
import bs10CandidateDocument from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  type OfficialCardRecord,
} from '.'
import {
  advancePhase,
  applyGameCommand,
  beginAttack,
  canActivateCookieSkill,
  getCookieSkillUnavailableReason,
  getEffectiveAttack,
  createDemoGame,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
  type CookieCard,
  type GameCard,
  type GameState,
} from '../game'

const records = bs10CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS10 candidate fixture: ${cardNumber}`)
  return card
}

const filler = (instanceId: string, energyColor: GameCard['energyColor'] = 'red'): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor,
})

const convertedCookie = (cardNumber: string, instanceId: string): CookieCard => {
  const result = convertOfficialCardToGameCard(findCard(cardNumber), instanceId)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} should convert to a Cookie`)
  }
  return result.gameCard
}

const skillState = (
  cardNumber: 'BS10-001' | 'BS10-004',
  options: {
    handCount?: number
    opponentFainted?: number
    selfFainted?: number
  } = {},
): GameState => {
  const base = createDemoGame(10010)
  const source = convertedCookie(cardNumber, 'source')
  const sourceEntry = {
    card: source,
    hpCards: [filler(`${cardNumber}:hp`)],
    rested: false,
    battleEntryId: `${cardNumber}:battle:1`,
  }
  const opponent = base.players['player-two'].battleArea[0]
  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    turnNumber: 1,
    status: 'playing',
    skillUsesThisTurn: [],
    cookiesFaintedThisTurn: {
      'player-one': options.selfFainted ?? 0,
      'player-two': options.opponentFainted ?? 0,
    },
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: Array.from({ length: options.handCount ?? (cardNumber === 'BS10-001' ? 2 : 0) }, (_, index) =>
          filler(`${cardNumber}:hand:${index + 1}`),
        ),
        battleArea: [sourceEntry],
        supportArea: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [opponent],
      },
    },
  }
}

const attackState = (
  cardNumber: 'BS10-002' | 'BS10-005' | 'BS10-005@1',
  supportColors: GameCard['energyColor'][],
): GameState => {
  const base = createDemoGame(10011)
  const source = convertedCookie(cardNumber, 'source')
  const target = base.players['player-two'].battleArea[0]
  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    turnNumber: 2,
    status: 'playing',
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{
          card: source,
          hpCards: [filler(`${cardNumber}:hp`), filler(`${cardNumber}:hp:2`), filler(`${cardNumber}:hp:3`)],
          rested: false,
          battleEntryId: `${cardNumber}:battle:1`,
        }],
        supportArea: supportColors.map((color, index) => ({
          card: filler(`${cardNumber}:support:${index + 1}`, color),
          rested: false,
        })),
      },
      'player-two': { ...base.players['player-two'], battleArea: [target] },
    },
  }
}

describe('BS10-001 to BS10-005 candidate adapter', () => {
  it.each([
    ['BS10-001', 'Princess Cookie', 'cookie', 1, 1, 2, 2, { red: 2 }, '<{R}{R}> To the Party! {da} 2'],
    ['BS10-002', 'Grandberry Merchant', 'cookie', 1, 3, 1, 2, { neutral: 2 }, '<{N}{N}> Customer Service {da} 1'],
    ['BS10-003', 'Raspberry Mousse Cookie', 'flip', 1, 1, 2, 2, { red: 2 }, '<{R}{R}> Raspberry Reprise {da} 2'],
    ['BS10-004', 'Bumbleberry Cookie', 'cookie', 1, 3, 1, 2, { red: 2 }, '<{R}{R}> Blueberry Strikes {da} 1'],
    ['BS10-005', 'Cherry Blossom Cookie', 'cookie', 2, 5, 2, 3, { neutral: 3 }, '<{N}{N}{N}> Cherry Blossom Picnic {da} 2'],
    ['BS10-005@1', 'Cherry Blossom Cookie', 'cookie', 2, 5, 2, 3, { neutral: 3 }, '<{N}{N}{N}> Cherry Blossom Picnic {da} 2'],
  ] as const)('%s preserves the printed card body and attack fields', (cardNumber, name, officialType, level, hp, attack, attackCost, attackEnergyCost, attackText) => {
    const result = convertOfficialCardToGameCard(findCard(cardNumber))
    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        id: cardNumber.startsWith('BS10-005@') ? 'BS10-005' : cardNumber,
        name,
        cardColor: 'red',
        energyColor: 'red',
        officialType,
        type: 'cookie',
        level,
        hp,
        attack,
        attackCost,
        attackEnergyCost,
        attackText,
      },
      source: { cardNumber, baseCardNumber: cardNumber.startsWith('BS10-005@') ? 'BS10-005' : cardNumber },
    })
  })

  it('maps Princess Pride as an Activate, once-per-turn two-card discard and this-turn self bonus', () => {
    expect(convertOfficialCookieSkill(findCard('BS10-001'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      cost: { energy: {}, discardHand: 2 },
      effects: [{
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      }],
    })
    expect(convertOfficialAttackEffects(findCard('BS10-001'))).toBeUndefined()
  })

  it('maps Strength Training only to an opponent Cookie fainted this turn', () => {
    expect(convertOfficialCookieSkill(findCard('BS10-004'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [{
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'opponent', count: 1 },
      }],
    })
  })

  it('maps Raspberry Mousse FLIP to an optional zero-or-one draw with no payment', () => {
    expect(convertOfficialFlipAbility(findCard('BS10-003'))).toEqual({
      text: 'Draw up to 1 card from your deck.',
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
  })

  it.each(['BS10-002', 'BS10-005', 'BS10-005@1'] as const)(
    '%s keeps neutral attack payment available to mixed-color support cards',
    (cardNumber) => {
      const required: GameCard['energyColor'][] = cardNumber === 'BS10-002'
        ? ['red', 'blue']
        : ['red', 'green', 'purple']
      const state = attackState(cardNumber, required)
      const sourceId = `${cardNumber}:source`
      const supportIds = state.players['player-one'].supportArea.map((support) => support.card.instanceId)
      const pending = beginAttack(state, sourceId, state.players['player-two'].battleArea[0].card.instanceId, supportIds)
      expect(pending.pendingBattle).toBeDefined()
      expect(pending.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
    },
  )
})

describe('BS10 neutral attack payment rules', () => {
  it.each([
    ['BS10-002', 2],
    ['BS10-005', 3],
  ] as const)('rejects insufficient or rested support for %s without mutating the state', (cardNumber, cost) => {
    const insufficient = attackState(cardNumber, Array.from({ length: cost - 1 }, (): GameCard['energyColor'] => 'red'))
    const sourceId = `${cardNumber}:source`
    const targetId = insufficient.players['player-two'].battleArea[0].card.instanceId
    const paymentIds = insufficient.players['player-one'].supportArea.map((support) => support.card.instanceId)
    expect(() => beginAttack(insufficient, sourceId, targetId, paymentIds)).toThrow()
    expect(insufficient.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)

    const rested = attackState(
      cardNumber,
      Array.from({ length: cost }, (_, index): GameCard['energyColor'] =>
        (['red', 'blue', 'green'] as GameCard['energyColor'][])[index],
      ),
    )
    rested.players['player-one'].supportArea[0].rested = true
    const restedPaymentIds = rested.players['player-one'].supportArea.map((support) => support.card.instanceId)
    expect(() => beginAttack(rested, sourceId, targetId, restedPaymentIds)).toThrow()
    expect(rested.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(1)
  })
})

const flipBattleState = (): GameState => {
  const base = createDemoGame(10012)
  const flipHp = convertedCookie('BS10-003', 'flip-hp')
  const attacker = {
    ...base.players['player-two'].battleArea[0].card,
    instanceId: 'attacker',
    attack: 1,
    attackCost: 1,
    attackEnergyCost: { red: 1 },
  }
  const defender = {
    ...base.players['player-one'].battleArea[0].card,
    instanceId: 'defender',
  }
  return {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [],
        deck: [filler('flip-draw-card')],
        battleArea: [{
          card: defender,
          hpCards: [filler('defender-hp'), flipHp],
          rested: false,
          battleEntryId: 'defender:battle:1',
        }],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{
          card: attacker,
          hpCards: [filler('attacker-hp')],
          rested: false,
          battleEntryId: 'attacker:battle:2',
        }],
        supportArea: [{ card: filler('attack-support', 'red'), rested: false }],
      },
    },
  }
}

describe('BS10-003 Raspberry Mousse Cookie FLIP rules', () => {
  const reachFlipDecision = () => {
    const initial = flipBattleState()
    let state = beginAttack(initial, 'attacker', 'defender', ['attack-support'])
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }
    expect(state.pendingBattle?.stage).toBe('flip')
    return { initial, state }
  }

  it.each([0, 1] as const)('continues the real FLIP into an explicit draw-up-to choice of %s', (drawCount) => {
    const { state } = reachFlipDecision()
    const flipped = resolveFlip(state, 'player-one', { activate: true })
    expect(flipped.pendingDrawUpTo).toMatchObject({ max: 1 })
    const resolved = applyGameCommand(flipped, {
      kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount,
    })
    expect(resolved.pendingDrawUpTo).toBeNull()
    expect(resolved.players['player-one'].hand).toHaveLength(drawCount)
    expect(resolved.players['player-one'].deck).toHaveLength(1 - drawCount)
    expect(resolved.pendingBattle).toBeNull()
  })

  it('rejects a draw choice above the printed maximum', () => {
    const { state } = reachFlipDecision()
    const flipped = resolveFlip(state, 'player-one', { activate: true })
    expect(() => applyGameCommand(flipped, {
      kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2,
    })).toThrow()
  })
})

describe('BS10-001 Princess Cookie skill rules', () => {
  it('requires two hand cards, discards them, grants +1 for this turn, and consumes once-per-turn', () => {
    const initial = skillState('BS10-001')
    const sourceId = 'BS10-001:source'
    const activated = applyGameCommand(initial, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
      discardHandIds: initial.players['player-one'].hand.map((card) => card.instanceId),
    })
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })

    expect(resolved.players['player-one'].hand).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile).toHaveLength(2)
    expect(resolved.skillUsesThisTurn).toContain('BS10-001:battle:1')
    expect(resolved.attackModifiers).toContainEqual(expect.objectContaining({
      sourceInstanceId: sourceId,
      targetInstanceId: sourceId,
      amount: 1,
      expiresAfterTurn: resolved.turnNumber,
    }))
    expect(getEffectiveAttack(resolved, sourceId)).toBe(3)
    expect(canActivateCookieSkill(resolved, 'player-one', sourceId, 'activate')).toBe(false)
    const secondAttempt = {
      ...resolved,
      players: {
        ...resolved.players,
        'player-one': {
          ...resolved.players['player-one'],
          hand: [filler('BS10-001:second-hand:1'), filler('BS10-001:second-hand:2')],
        },
      },
    }
    expect(() => applyGameCommand(secondAttempt, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow(/每回合一次/)
  })

  it('rejects a non-source target without granting the bonus to another Cookie', () => {
    const sourceId = 'BS10-001:source'
    const companion = convertedCookie('BS10-004', 'BS10-001:companion')
    const initial = skillState('BS10-001')
    const withCompanion = {
      ...initial,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          battleArea: [
            ...initial.players['player-one'].battleArea,
            { card: companion, hpCards: [filler('BS10-001:companion-hp')], rested: false, battleEntryId: 'BS10-001:companion:battle:1' },
          ],
        },
      },
    }
    const activated = applyGameCommand(withCompanion, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
      discardHandIds: withCompanion.players['player-one'].hand.map((card) => card.instanceId),
    })
    expect(() => applyGameCommand(activated, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [companion.instanceId],
    })).toThrow()
    expect(getEffectiveAttack(activated, companion.instanceId)).toBe(1)
  })

  it('rejects activation with fewer than two hand cards without consuming resources', () => {
    const initial = skillState('BS10-001', { handCount: 1 })
    const before = structuredClone(initial)
    expect(() => applyGameCommand(initial, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'BS10-001:source',
      trigger: 'activate', paymentIds: [],
    })).toThrow()
    expect(initial).toEqual(before)
  })

  it('only activates during the source controller turn and expires the bonus at turn end', () => {
    const initial = skillState('BS10-001')
    const sourceId = 'BS10-001:source'
    const offTurn = { ...initial, activePlayerId: 'player-two' as const }
    expect(canActivateCookieSkill(offTurn, 'player-one', sourceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(offTurn, 'player-one', sourceId, 'activate')).toBeTruthy()
    expect(() => applyGameCommand(offTurn, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow()
    const supportPhase = { ...initial, phase: 'support' as const }
    expect(canActivateCookieSkill(supportPhase, 'player-one', sourceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(supportPhase, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], discardHandIds: supportPhase.players['player-one'].hand.map((card) => card.instanceId),
    })).toThrow()

    const activated = applyGameCommand(applyGameCommand(initial, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
      discardHandIds: initial.players['player-one'].hand.map((card) => card.instanceId),
    }), { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId] })
    const nextTurn = advancePhase(advancePhase(activated))
    expect(nextTurn.activePlayerId).toBe('player-two')
    expect(nextTurn.attackModifiers).toEqual([])
    expect(getEffectiveAttack(nextTurn, sourceId)).toBe(2)
  })
})

describe('BS10-004 Bumbleberry Cookie skill rules', () => {
  it('grants the bonus after an opponent Cookie fainted, but not after own Cookie fainted', () => {
    const sourceId = 'BS10-004:source'
    const opponentFainted = skillState('BS10-004', { opponentFainted: 1 })
    const activated = applyGameCommand(opponentFainted, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    expect(getEffectiveAttack(resolved, sourceId)).toBe(2)
    expect(() => applyGameCommand(resolved, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow(/每回合一次/)

    const ownFainted = skillState('BS10-004', { selfFainted: 1 })
    expect(() => applyGameCommand(ownFainted, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })).toThrow(/對手餅乾昏厥數尚未達到/)
    expect(getEffectiveAttack(ownFainted, sourceId)).toBe(1)
  })

  it('expires the opponent-faint bonus at the end of the turn', () => {
    const sourceId = 'BS10-004:source'
    const initial = skillState('BS10-004', { opponentFainted: 1 })
    const activated = applyGameCommand(initial, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [],
    })
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    let nextTurn = advancePhase(advancePhase(resolved))
    for (let index = 0; index < 8; index += 1) nextTurn = advancePhase(nextTurn)
    expect(nextTurn.activePlayerId).toBe('player-one')
    expect(nextTurn.phase).toBe('main')
    expect(nextTurn.attackModifiers).toEqual([])
    expect(getEffectiveAttack(nextTurn, sourceId)).toBe(1)
    expect(canActivateCookieSkill(nextTurn, 'player-one', sourceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(nextTurn, 'player-one', sourceId, 'activate')).toMatch(/對手餅乾昏厥數尚未達到/)
  })
})
