import { describe, expect, it } from 'vitest'
import { createPublicAttackAllocationForecast } from '../attack-allocation'
import { takeAiStep } from '../../ai'
import { getActingPlayerId } from '../../controller'
import { createBattleState, cookie, item } from '../../test-helpers/battle-helpers'
import type { AttackCommand } from '../../commands'
import type { CardEffect, CardSkill, CookieInBattle, DamageEffect, GameState, PlayerId } from '../../types'

// Synthetic public tactical counterexample, not physical-card acceptance.
const battle = (id: string, attack: number, hp: number): CookieInBattle => ({
  card: cookie(id, attack, hp), rested: false, battleEntryId: `${id}:entry`,
  hpCards: Array.from({ length: hp }, (_, i) => item(`${id}-hp-${i}`)),
})
const fixture = (): GameState => {
  const state = createBattleState()
  state.activePlayerId = 'player-one'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.hand = []; player.supportArea = []
    player.deck = Array.from({ length: 12 }, (_, i) => item(`${player.id}-deck-${i}`))
  }
  state.players['player-one'].battleArea = [battle('a-strong', 2, 3), battle('z-weak', 1, 3)]
  state.players['player-two'].battleArea = [battle('a-low', 1, 1), battle('z-high', 1, 2)]
  state.players['player-one'].supportArea = [0, 1].map(i => ({ card: item(`support-${i}`), rested: false }))
  return state
}
const command = (source = 'a-strong', target = 'a-low'): AttackCommand => ({
  kind: 'attack', playerId: 'player-one', attackerInstanceId: source,
  targetInstanceId: target, supportPaymentIds: ['support-0'],
})

describe('Lv5 public normal-attack allocation', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])(
    'knocks out both enemies without wasting the strong attack (reverse self=%s foe=%s)',
    (reverseSelf, reverseFoe) => {
      let state = fixture()
      if (reverseSelf) state.players['player-one'].battleArea.reverse()
      if (reverseFoe) state.players['player-two'].battleArea.reverse()
      const before = structuredClone(state)
      const first = takeAiStep(state, 'player-one', { level: 5, seed: 2026110101, searchNow: () => 0 })
      expect(first.action).toBe('attack')
      expect(first.state.pendingBattle).not.toMatchObject({ attackerInstanceId: 'a-strong', targetInstanceId: 'a-low' })
      expect(state).toEqual(before)
      state = first.state
      const memories: Partial<Record<PlayerId, NonNullable<typeof first.reason>['strategyMemory']>> = {
        'player-one': first.reason?.strategyMemory,
      }
      for (let i = 0; i < 30 && state.status !== 'finished' && state.activePlayerId === 'player-one' && state.phase === 'main'; i++) {
        const playerId = getActingPlayerId(state)
        const step = takeAiStep(state, playerId, { level: 5, seed: 2026110101, searchNow: () => 0, memory: memories[playerId] })
        expect(step.action).not.toBe('error')
        expect(step.state).not.toBe(state)
        memories[playerId] = step.reason?.strategyMemory
        state = step.state
      }
      expect(state.players['player-two'].battleArea).toEqual([])
      expect(state.players['player-two'].breakArea.map(c => c.instanceId).sort()).toEqual(['a-low', 'z-high'])
      expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    },
  )
  it('only penalizes worse allocation and leaves the input immutable', () => {
    const state = fixture(), before = structuredClone(state)
    const forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-one', command())?.amount).toBeLessThan(0)
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
    expect(forecast(state, 'player-one', command('z-weak', 'a-low'))).toBeNull()
    expect(state).toEqual(before)
  })
  it('leaves existing risk and target priorities intact when both allocations knock out the same level', () => {
    const state = fixture()
    state.players['player-one'].battleArea = [battle('a-strong', 4, 3), battle('z-weak', 3, 3)]
    state.players['player-two'].battleArea = [battle('a-low', 1, 5), battle('z-high', 1, 7)]
    const forecast = createPublicAttackAllocationForecast()
    // Both two-attack sequences remove one LV1. The larger target requires all
    // seven damage; extra partial damage must not override existing response risk.
    expect(forecast(state, 'player-one', command('a-strong', 'a-low'))).toBeNull()
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
  })
  it('cannot reuse one support or a rested second attacker', () => {
    const oneSupport = fixture(); oneSupport.players['player-one'].supportArea.pop()
    expect(createPublicAttackAllocationForecast()(oneSupport, 'player-one', command())).toBeNull()
    const rested = fixture(); rested.players['player-one'].battleArea[1].rested = true
    expect(createPublicAttackAllocationForecast()(rested, 'player-one', command())).toBeNull()
  })
  it('reserves the color needed for the second attack', () => {
    const state = fixture()
    state.players['player-one'].battleArea[1].card.attackEnergyCost = { yellow: 1 }
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    state.players['player-one'].supportArea[1].card = item('yellow-support', 'yellow')
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBeLessThan(0)
  })
  it('declines the entire forecast when its budget is exhausted', () => {
    expect(createPublicAttackAllocationForecast({ nodeBudget: 0 })(fixture(), 'player-one', command())).toBeNull()
    expect(createPublicAttackAllocationForecast({ shouldStop: () => true })(fixture(), 'player-one', command())).toBeNull()
  })
  it('scopes a shared forecast cache to the acting player', () => {
    const state = fixture(), forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-two', { ...command('a-low', 'z-weak'), playerId: 'player-two' })).toBeNull()
    expect(forecast(state, 'player-one', command())?.amount).toBeLessThan(0)
  })
  it('includes public reduction instead of treating base damage as a knockout', () => {
    const state = fixture()
    state.damageReceivedModifiers = [{ sourceInstanceId: 'z-high', targetInstanceId: 'z-high',
      amount: -2, damageType: 'attack', expiresAfterTurn: 3 }]
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
  })
  it('does not inspect unknown deck, HP or opponent hand faces', () => {
    const state = fixture()
    state.players['player-two'].hand = [item('unknown-hand')]
    const hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map((c) => cookie(c.instanceId, 99, 99))
      for (const target of player.battleArea) target.hpCards = target.hpCards.map(c => cookie(c.instanceId, 99, 99))
    }
    hidden.players['player-two'].hand = [cookie('unknown-hand', 99, 99)]
    expect(createPublicAttackAllocationForecast()(hidden, 'player-one', command()))
      .toEqual(createPublicAttackAllocationForecast()(state, 'player-one', command()))
    const chosen = (input: GameState) => takeAiStep(input, 'player-one', { level: 5, seed: 2026110101, searchNow: () => 0 }).state.pendingBattle
    expect(chosen(hidden)).toEqual(chosen(state))
  })
})

// Synthetic mechanism regressions for the deliberately narrow Then forecast.
// These are not printed-card, physical Browser, or full-match acceptance cases.
const originalTargetDamage = (amount = 1): DamageEffect => ({
  kind: 'damage', amount,
  target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
})
const thenFixture = (normalDamage = 1, extraDamage = 1): GameState => {
  const state = fixture()
  const source = state.players['player-one'].battleArea[0]
  source.card.attack = normalDamage
  source.card.attackEffects = [originalTargetDamage(extraDamage)]
  return state
}
const passiveSkill = (effects: CardEffect[] = []): CardSkill => ({
  trigger: 'passive', oncePerTurn: false, yourTurn: false, restSource: false,
  cost: { energy: {} }, text: 'Synthetic public rule mechanism', effects,
})

describe('public allocation with one original-target damage Then', () => {
  it('can allocate a zero-damage ordinary attack by its damaging Then, including as the second attack', () => {
    const state = thenFixture(0, 2), before = structuredClone(state)
    const forecast = createPublicAttackAllocationForecast()
    // The zero ordinary attack can still remove the 2HP defender. Spending
    // that Then on the 1HP defender loses the second available knockout.
    expect(forecast(state, 'player-one', command())?.amount).toBe(-100)
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
    expect(forecast(state, 'player-one', command('z-weak', 'a-low'))).toBeNull()
    expect(state).toEqual(before)
  })

  it('does not redirect an original-target Then after the ordinary damage already knocked that target out', () => {
    const state = thenFixture(), before = structuredClone(state)
    const forecast = createPublicAttackAllocationForecast()
    // Strong -> low removes low with ordinary damage, so its Then cannot
    // soften high for the weak attack. Strong -> high can remove both targets.
    expect(forecast(state, 'player-one', command())?.amount).toBe(-100)
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
    expect(state).toEqual(before)
  })

  it.each(['public-mark', 'passive-skill'] as const)('respects effect-damage immunity from %s', protection => {
    const state = thenFixture()
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
    if (protection === 'public-mark') {
      state.effectDamagePreventedUntilTurn = { 'z-high': state.turnNumber }
    } else {
      state.players['player-two'].battleArea[1].card.skill = passiveSkill([{
        kind: 'prevent-effect-damage', duration: 'until-source-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      }])
    }
    const before = structuredClone(state)
    // High still takes ordinary damage, but the immune Then cannot create
    // the extra knockout that justified reserving the strong attack for it.
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    expect(state).toEqual(before)
  })

  it('respects defender attack-effect prevention at the attacker effective level', () => {
    const state = thenFixture()
    state.players['player-one'].battleArea[0].levelOverride = 2
    const defender = state.players['player-two'].battleArea[1]
    defender.card.skill = { ...passiveSkill(), battleOpponentAttackEffectPrevention: { level: 1 } }
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
    defender.card.skill.battleOpponentAttackEffectPrevention = { level: 2 }
    const before = structuredClone(state)
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    expect(state).toEqual(before)
  })

  it('does not project a public battle-keyword condition without its witness', () => {
    const state = thenFixture()
    const effect = originalTargetDamage()
    effect.condition = { kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena' }
    state.players['player-one'].battleArea[0].card.attackEffects = [effect]
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    state.players['player-one'].battleArea[1].card.keywords = ['arena']
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
  })

  it('does not count the source as another keyword Cookie', () => {
    const state = thenFixture()
    const source = state.players['player-one'].battleArea[0]
    source.card.keywords = ['arena']
    source.card.attackEffects = [{ ...originalTargetDamage(), condition: {
      kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena', excludeSource: true,
    } }]
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    state.players['player-one'].battleArea[1].card.keywords = ['arena']
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
  })

  it('evaluates a rested keyword witness after the attacker has paid and rested', () => {
    const state = thenFixture()
    const source = state.players['player-one'].battleArea[0]
    source.card.keywords = ['arena']
    source.card.attackEffects = [{ ...originalTargetDamage(), condition: {
      kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena', restedOnly: true,
    } }]
    expect(source.rested).toBe(false)
    const before = structuredClone(state)
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
    expect(state).toEqual(before)
  })

  it('uses post-ordinary public HP for a maximum-HP target selector', () => {
    const state = thenFixture()
    const effect = originalTargetDamage()
    effect.target.remainingHp = 1
    state.players['player-one'].battleArea[0].card.attackEffects = [effect]
    state.players['player-two'].battleArea[1].publicHp = 2
    const before = structuredClone(state)
    // High starts outside the selector, then ordinary 1 makes its public HP1.
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
    expect(state).toEqual(before)
  })

  it('rejects a minimum-HP selector that stops matching after ordinary damage', () => {
    const state = thenFixture()
    const effect = originalTargetDamage()
    effect.target.minRemainingHp = 2
    state.players['player-one'].battleArea[0].card.attackEffects = [effect]
    state.players['player-two'].battleArea[1].publicHp = 2
    const before = structuredClone(state)
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    expect(state).toEqual(before)
  })

  it('uses post-ordinary public HP to activate an effect-damage received modifier', () => {
    const state = thenFixture()
    state.players['player-two'].battleArea[1] = battle('z-high', 1, 3)
    state.players['player-two'].battleArea[1].publicHp = 3
    state.damageReceivedModifiers = [{
      sourceInstanceId: 'z-high', targetInstanceId: 'z-high', amount: 1,
      damageType: 'effect', maxTargetRemainingHp: 2, expiresAfterTurn: state.turnNumber,
    }]
    const before = structuredClone(state)
    // Ordinary 1 lowers HP3 to HP2; only then does Then 1 gain +1 and knock it out.
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBe(-100)
    expect(state).toEqual(before)
  })

  it('keeps public HP in sync after a nonlethal Then for the next attacker', () => {
    const state = thenFixture()
    const high = battle('z-high', 1, 3)
    high.card.level = 3
    high.publicHp = 3
    state.players['player-two'].battleArea[1] = high
    const weak = state.players['player-one'].battleArea[1]
    weak.card.attack = 0
    weak.card.skill = passiveSkill([{
      kind: 'modify-attack', amount: 1, duration: 'this-turn',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'attack-target-remaining-hp-at-most', amount: 1 },
    }])
    const before = structuredClone(state)
    // Strong -> high leaves public HP1 after normal 1 + Then 1, enabling weak.
    // Weak cannot soften HP3 first. Removing LV3 is worth more than the LV1 low.
    const forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-one', command())?.amount).toBe(-40)
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
    expect(state).toEqual(before)
  })

  const unsupported: { name: string; effects: CardEffect[] }[] = [
    { name: 'make-faint', effects: [{ kind: 'make-faint', target: originalTargetDamage().target }] },
    { name: 'all-target damage', effects: [{ kind: 'damage-all', amount: 2, side: 'opponent' }] },
    { name: 'multiple independent effects', effects: [originalTargetDamage(2), originalTargetDamage(2)] },
    { name: 'optional original-target damage', effects: [{ ...originalTargetDamage(2),
      target: { ...originalTargetDamage().target, min: 0 } }] },
    { name: 'a newly selectable target', effects: [{ ...originalTargetDamage(2),
      target: { side: 'opponent', min: 1, max: 1 } }] },
    { name: 'selection as a cost', effects: [{ ...originalTargetDamage(2), selectionAsCost: true }] },
  ]
  it.each(unsupported)('does not claim a Then allocation payoff for $name', ({ effects }) => {
    const state = thenFixture(0, 2)
    state.players['player-one'].battleArea[0].card.attackEffects = effects
    const before = structuredClone(state)
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    expect(state).toEqual(before)
  })

  it('prioritizes the public Break limit over a nonwinning allocation and caps its penalty', () => {
    const state = thenFixture()
    state.players['player-two'].breakArea = Array.from({ length: 8 }, (_, i) => cookie(`broken-${i}`))
    state.players['player-two'].battleArea[1].card.level = 2
    const before = structuredClone(state)
    const forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-one', command())?.amount).toBe(-600)
    expect(forecast(state, 'player-one', command('z-weak', 'a-low'))).toBeNull()
    for (const source of ['a-strong', 'z-weak']) {
      for (const target of ['a-low', 'z-high']) {
        const amount = forecast(state, 'player-one', command(source, target))?.amount ?? 0
        expect(amount).toBeGreaterThanOrEqual(-600)
        expect(amount).toBeLessThanOrEqual(0)
      }
    }
    expect(state).toEqual(before)
  })
})
