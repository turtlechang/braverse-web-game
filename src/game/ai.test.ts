import { describe, expect, it } from 'vitest'
import { takeAiStep, simulateAiMatch } from './ai'
import { handleAiPendingDecision } from './ai/pending-handler'
import { handleAiPendingBattle } from './ai/battle-handler'
import { beginAttack, getAttackResponseSkillCandidates, getBlockerCandidates, getTrapCandidates } from './battle'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { advancePhase } from './turn'
import { deployCookie } from './actions'
import { createBattleState } from './test-helpers/battle-helpers'
import { createCard, getCardPoolEntry } from '.'
import type {
  CardSkill,
  CookieCard,
  EnergyColor,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
} from './types'

const testCookieCard = (
  instanceId: string,
  options: {
    level?: number
    hp?: number
    attack?: number
    skill?: CardSkill
  } = {},
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: options.level ?? 1,
  hp: options.hp ?? 1,
  attack: options.attack ?? 1,
  attackCost: 0,
  attackEnergyCost: {},
  skill: options.skill,
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

const buildTestState = (
  activePlayerId: PlayerId,
  overrides: Partial<PlayerState> & { id: PlayerId } = { id: 'player-two' },
): GameState => {
  const emptyPlayer = (id: PlayerId): PlayerState => ({
    id,
    name: id === 'player-one' ? '玩家' : 'AI 對手',
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

  return {
    players: {
      'player-one': activePlayerId === 'player-one'
        ? { ...emptyPlayer('player-one'), ...overrides, id: 'player-one' }
        : emptyPlayer('player-one'),
      'player-two': activePlayerId === 'player-two'
        ? { ...emptyPlayer('player-two'), ...overrides, id: 'player-two' }
        : emptyPlayer('player-two'),
    },
    firstPlayerId: activePlayerId,
    activePlayerId,
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
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
    pendingFaintEffects: undefined,
    pendingOpponentHandDiscard: null,
    pendingInspectDeck: null,
    pendingOptionalCostAttack: undefined,
  }
}

describe('AI optional attack source energy', () => {
  it('pays no support cards when the attacker covers the entire optional cost', () => {
    let state = createBattleState()
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId

    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          supportArea: [],
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Source Energy Attacker',
        cost: { energy: { red: 1 } },
        sourceEnergy: { red: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText: 'Use this Cookie as {R}.',
      },
    }

    const decision = handleAiPendingDecision(state, 'player-two')

    expect(decision?.action).toBe('resolve-optional-cost-attack')
    expect(decision?.state.pendingOptionalCostAttack).toBeNull()
    expect(decision?.state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })
})

describe('BS3-010 attacks BS4-024', () => {
  it('continues past the defender response window instead of leaving the AI battle pending', () => {
    const defenderFixture = createCardCheckDemoState('BS4-024')
    const attackerFixture = createCardCheckDemoState('BS3-010')
    const kumiho = defenderFixture.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-024',
    )!
    const yellowLv3 = defenderFixture.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )!
    const pitaya = attackerFixture.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS3-010',
    )!

    const state: GameState = {
      ...defenderFixture,
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      players: {
        ...defenderFixture.players,
        'player-one': {
          ...defenderFixture.players['player-one'],
          hand: [],
          battleArea: [
            kumiho,
            {
              ...yellowLv3,
              card: { ...yellowLv3.card, level: 3 },
            },
          ],
          supportArea: [],
        },
        'player-two': {
          ...defenderFixture.players['player-two'],
          battleArea: [{ ...pitaya, rested: false }],
          supportArea: attackerFixture.players['player-one'].supportArea,
        },
      },
    }

    const attack = takeAiStep(state, 'player-two', { level: 4, seed: 7 })

    expect(attack.action).toBe('attack')
    expect(attack.state.pendingBattle?.stage).toBe('trap')
    expect(attack.state.pendingBattle?.targetInstanceId).toBe(kumiho.card.instanceId)
    expect(attack.state.commandLog?.at(-1)?.steps?.at(-1)?.text).toBe(
      '戰鬥進行中：等待防守方回應',
    )
    expect(getTrapCandidates(attack.state, 'player-one')).toEqual([])
    expect(getBlockerCandidates(attack.state, 'player-one')).toEqual([])
    expect(getAttackResponseSkillCandidates(attack.state, 'player-one')).toEqual([])

    let current = applyGameCommand(attack.state, {
      kind: 'skip-trap',
      playerId: 'player-one',
    })
    const actions: string[] = []

    for (let step = 0; step < 3; step += 1) {
      const decision = takeAiStep(current, 'player-two', { level: 4, seed: 7 })
      expect(decision.action).not.toBe('error')
      expect(decision.state).not.toBe(current)
      actions.push(decision.action)
      current = decision.state
    }

    expect(actions).toEqual([
      'resolve-damage',
      'resolve-attack-effect',
      'resolve-optional-cost-attack',
    ])
    expect(current.pendingBattle).toBeNull()
    expect(current.pendingOptionalCostAttack).toBeNull()
  })
})

describe('G5 pending faint cost selection', () => {
  it('uses distinct legal cards for energy and trash costs, preserving higher-value public cards', () => {
    const base = createBattleState()
    const targetCookie: CookieCard = {
      ...testCookieCard('faint-target', { level: 1, hp: 1, attack: 1 }),
      energyColor: 'yellow',
    }
    const valuableHandCookie: CookieCard = {
      ...testCookieCard('valuable-hand', { level: 4, hp: 5, attack: 4 }),
      energyColor: 'yellow',
    }
    const valuableSupport: CookieCard = {
      ...testCookieCard('valuable-support', { level: 4, hp: 5, attack: 4 }),
      energyColor: 'yellow',
    }
    const energyPayment = testSupportCard('payment-a', 'yellow')
    const trashSupport = testSupportCard('trash-b', 'yellow')
    const junkHand = testSupportCard('discard-junk', 'yellow')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [testSupportCard('faint-target-hp')],
          hand: [valuableHandCookie, targetCookie, junkHand],
          supportArea: [
            { card: energyPayment, rested: false },
            { card: trashSupport, rested: false },
            { card: valuableSupport, rested: false },
          ],
        },
      },
      pendingFaintEffects: [{
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'defender',
        sourceCardName: 'Faint source',
        effect: {
          kind: 'hand-to-battle',
          amount: 1,
          energyColor: 'yellow',
          energyCost: { yellow: 1 },
          optional: false,
        },
        context: {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'defender',
        },
        cost: { discardHand: 1, supportToTrash: 1 },
      }],
    }

    const decision = handleAiPendingDecision(state, 'player-one', { level: 3 })

    expect(decision?.action).toBe('resolve-faint')
    expect(decision?.error).toBeUndefined()
    expect(decision?.reason?.pendingStrategy).toMatchObject({
      kind: 'effect-target',
      usedUniversalSelection: true,
      publicViewOnly: true,
    })
    // 登場是收益而非代價，應選擇公開價值較高的餅乾；真正的棄牌／送支援
    // 成本仍會保留高價值卡。
    expect(decision?.state.players['player-one'].battleArea.map(
      (entry) => entry.card.instanceId,
    )).toContain('valuable-hand')
    expect(decision?.state.players['player-one'].supportArea).toEqual([
      { card: energyPayment, rested: true },
      { card: valuableSupport, rested: false },
    ])
    expect(decision?.state.players['player-one'].discardPile.map(
      (card) => card.instanceId,
    )).toEqual(expect.arrayContaining(['discard-junk', 'trash-b']))
    expect(decision?.state.players['player-one'].hand.map(
      (card) => card.instanceId,
    )).toEqual(['faint-target'])
  })
})

describe('G5 pending inspect-deck selection', () => {
  it('only selects from its legally revealed cards and resolves through GameCommand', () => {
    const revealedLow = testSupportCard('revealed-low')
    const revealedHigh = testCookieCard('revealed-high', {
      level: 3,
      hp: 5,
      attack: 4,
    })
    const state: GameState = {
      ...buildTestState('player-one', {
        id: 'player-one',
        deck: [],
        hand: [],
      }),
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'inspect-source',
        sourceCardName: 'Inspect source',
        revealedCards: [revealedLow, revealedHigh],
        lookCount: 2,
        pickCount: 1,
        restDestination: 'bottom',
      },
    }

    const decision = handleAiPendingDecision(state, 'player-one', { level: 3 })

    expect(decision?.action).toBe('resolve-inspect-deck')
    expect(decision?.reason?.pendingStrategy).toMatchObject({
      kind: 'multi-stage',
      usedUniversalSelection: true,
      publicViewOnly: true,
    })
    expect(decision?.state.pendingInspectDeck).toBeNull()
    expect(decision?.state.players['player-one'].hand.map(
      (card) => card.instanceId,
    )).toEqual(['revealed-high'])
    expect(decision?.state.players['player-one'].deck.map(
      (card) => card.instanceId,
    )).toEqual(['revealed-low'])
  })
})

describe('G5 direct Lv.3 strategy selection', () => {
  it('routes direct skill targets through TacticalPlan-aware universal scoring', () => {
    const source = testCookieCard('direct-source', {
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Deal damage to an opposing Cookie.',
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        }],
      },
    })
    const survivor = testCookieCard('direct-survivor', { level: 3, hp: 5 })
    const lethal = testCookieCard('direct-lethal', { level: 1, hp: 1 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      battleArea: [{
        card: source,
        hpCards: [testSupportCard('source-hp')],
        rested: false,
        battleEntryId: 'direct-source:battle:1',
      }],
    })
    state.pendingOnPlay = {
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      origin: 'hand',
    }
    state.players['player-one'].battleArea = [
      {
        card: survivor,
        hpCards: [
          testSupportCard('survivor-hp-1'),
          testSupportCard('survivor-hp-2'),
          testSupportCard('survivor-hp-3'),
        ],
        rested: false,
        battleEntryId: 'direct-survivor:battle:1',
      },
      {
        card: lethal,
        hpCards: [testSupportCard('lethal-hp')],
        rested: false,
        battleEntryId: 'direct-lethal:battle:2',
      },
    ]

    const decision = takeAiStep(state, 'player-two', { level: 3, seed: 7 })

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections?.[0]?.targetIds).toEqual(['direct-lethal'])
  })

  it('uses universal retention ordering for direct skill costs at Lv.3', () => {
    const source = testCookieCard('direct-cost-source', {
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'Discard one card, then modify this Cookie.',
        effects: [{
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        }],
      },
    })
    const valuable = testCookieCard('direct-cost-valuable', { level: 4, hp: 5, attack: 4 })
    const junk = testSupportCard('direct-cost-junk')
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [valuable, junk],
      battleArea: [{
        card: source,
        hpCards: [testSupportCard('direct-cost-source-hp')],
        rested: false,
        battleEntryId: 'direct-cost-source:battle:1',
      }],
    })
    state.firstPlayerId = 'player-one'
    state.turnNumber = 2
    state.pendingOnPlay = {
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      origin: 'hand',
    }
    state.players['player-one'].battleArea = [{
      card: testCookieCard('direct-cost-opponent', { hp: 2 }),
      hpCards: [
        testSupportCard('direct-cost-opponent-hp-1'),
        testSupportCard('direct-cost-opponent-hp-2'),
      ],
      rested: false,
      battleEntryId: 'direct-cost-opponent:battle:1',
    }]

    const decision = takeAiStep(state, 'player-two', { level: 3, seed: 11 })

    expect(decision.action).toBe('activate-skill')
    expect(decision.state.players['player-two'].hand.map((card) => card.instanceId))
      .toEqual(['direct-cost-valuable'])
  })

  it('routes direct stage costs through the same universal retention ordering', () => {
    const stage: GameCard = {
      id: 'direct-stage',
      instanceId: 'direct-stage',
      name: 'direct-stage',
      type: 'stage',
      stageAbility: {
        placementCost: {},
        restSource: false,
        cost: { energy: {}, supportToTrash: 1 },
        text: 'Trash one support, then deal damage.',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
        }],
      },
    }
    const valuableSupport: GameCard = {
      ...testSupportCard('stage-valuable'),
      effects: [{ kind: 'draw', amount: 2 }],
    }
    const junkSupport = testSupportCard('stage-junk')
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      deck: [testSupportCard('stage-draw-card')],
      battleArea: [],
      supportArea: [
        { card: valuableSupport, rested: false },
        { card: junkSupport, rested: false },
      ],
      stage: { card: stage, rested: false },
    })
    state.players['player-one'].battleArea = [{
      card: testCookieCard('stage-opponent', { hp: 1 }),
      hpCards: [testSupportCard('stage-opponent-hp')],
      rested: false,
      battleEntryId: 'stage-opponent:battle:1',
    }]

    const decision = takeAiStep(state, 'player-two', { level: 3, seed: 23 })

    expect(decision.action).toBe('activate-stage')
    expect(decision.state.players['player-two'].supportArea.map(
      (support) => support.card.instanceId,
    )).toEqual(['stage-valuable'])
    expect(decision.state.players['player-two'].discardPile.map(
      (card) => card.instanceId,
    )).toContain('stage-junk')
  })

  it('keeps a one-HP Cookie alive when an HP-paid stage skill has another legal payer', () => {
    const stage: GameCard = {
      id: 'stage-hp-cost',
      instanceId: 'stage-hp-cost',
      name: 'stage-hp-cost',
      type: 'stage',
      stageAbility: {
        placementCost: {},
        restSource: false,
        cost: { energy: {}, hpToTrash: { amount: 1 } },
        text: 'Trash one HP, then deal 2 damage.',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
        }],
      },
    }
    const fragile = testCookieCard('stage-hp-fragile', { level: 1, hp: 1, attack: 1 })
    const survivor = testCookieCard('stage-hp-survivor', { level: 3, hp: 4, attack: 3 })
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      deck: [],
      battleArea: [
        {
          card: fragile,
          hpCards: [testSupportCard('stage-hp-fragile-hp')],
          rested: false,
          battleEntryId: 'stage-hp-fragile:battle:1',
        },
        {
          card: survivor,
          hpCards: [
            testSupportCard('stage-hp-survivor-hp-1'),
            testSupportCard('stage-hp-survivor-hp-2'),
            testSupportCard('stage-hp-survivor-hp-3'),
            testSupportCard('stage-hp-survivor-hp-4'),
          ],
          rested: false,
          battleEntryId: 'stage-hp-survivor:battle:1',
        },
      ],
      stage: { card: stage, rested: false },
    })
    state.players['player-one'].battleArea = [{
      card: testCookieCard('stage-hp-opponent', { level: 1, hp: 3, attack: 1 }),
      hpCards: [
        testSupportCard('stage-hp-opponent-hp-1'),
        testSupportCard('stage-hp-opponent-hp-2'),
        testSupportCard('stage-hp-opponent-hp-3'),
      ],
      rested: false,
      battleEntryId: 'stage-hp-opponent:battle:1',
    }]

    const decision = takeAiStep(state, 'player-two', { level: 3, seed: 202711331 })

    expect(decision.action).toBe('activate-stage')
    expect(decision.state.commandLog?.at(-1)?.payload).toMatchObject({
      hpToTrashTargetIds: ['stage-hp-survivor'],
    })
    expect(decision.state.players['player-two'].battleArea.map(
      (cookie) => [cookie.card.instanceId, cookie.hpCards.length],
    )).toEqual([['stage-hp-fragile', 1], ['stage-hp-survivor', 3]])
    expect(state.players['player-two'].battleArea.map((cookie) => cookie.hpCards.length))
      .toEqual([1, 4])
  })
})

describe('G5 optional attack target safety', () => {
  it('skips a multi-target optional effect when one shared target list cannot satisfy both effects', () => {
    const state: GameState = {
      ...buildTestState('player-two', { id: 'player-two' }),
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'optional-source',
        targetInstanceId: 'optional-target',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'optional-source',
        sourceCardName: 'Optional source',
        cost: { energy: {} },
        sourceEnergy: {},
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
        effectText: 'Use this Cookie as energy.',
      },
    }
    state.players['player-one'].battleArea = [{
      card: testCookieCard('optional-target'),
      hpCards: [testSupportCard('optional-target-hp')],
      rested: false,
      battleEntryId: 'optional-target:battle:1',
    }]
    state.players['player-two'].battleArea = [{
      card: testCookieCard('optional-source'),
      hpCards: [testSupportCard('optional-source-hp')],
      rested: false,
      battleEntryId: 'optional-source:battle:1',
    }]

    const decision = handleAiPendingDecision(state, 'player-two', { level: 4 })

    expect(decision?.action).toBe('resolve-optional-cost-attack')
    expect(decision?.description).toContain('略過')
    expect(decision?.reason?.pendingStrategy).toMatchObject({
      kind: 'payment',
      usedUniversalSelection: true,
      publicViewOnly: true,
    })
  })
})

describe('AI field movement target safety', () => {
  it('skips a field-to-trash target blocked by the opponent instead of issuing an illegal command', () => {
    const source = testCookieCard('movement-source', {
      level: 3,
      hp: 6,
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Place up to one Purple Cookie of LV.2 or lower into trash.',
        effects: [{
          kind: 'field-to-trash',
          target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'purple' },
        }],
      },
    })
    const target = {
      ...testCookieCard('movement-target', { level: 1, hp: 3 }),
      energyColor: 'purple' as const,
    }
    const movementBlocker = testCookieCard('movement-blocker', {
      level: 2,
      hp: 4,
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Your opponent cannot move Cookies from the battle area.',
        effects: [{ kind: 'prevent-opponent-battle-movement' }],
      },
    })
    const state = buildTestState('player-one', {
      id: 'player-one',
      hand: [],
      battleArea: [
        { card: source, hpCards: [], rested: false, battleEntryId: 'movement-source:battle:1' },
        {
          card: target,
          hpCards: [
            testSupportCard('movement-target-hp-1'),
            testSupportCard('movement-target-hp-2'),
            testSupportCard('movement-target-hp-3'),
          ],
          rested: false,
          battleEntryId: 'movement-target:battle:2',
        },
      ],
    })
    state.pendingOnPlay = {
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      origin: 'hand',
    }
    state.players['player-two'].battleArea = [{
      card: movementBlocker,
      hpCards: [
        testSupportCard('movement-blocker-hp-1'),
        testSupportCard('movement-blocker-hp-2'),
        testSupportCard('movement-blocker-hp-3'),
        testSupportCard('movement-blocker-hp-4'),
      ],
      rested: false,
      battleEntryId: 'movement-blocker:battle:1',
    }]
    const before = structuredClone(state)

    const decision = takeAiStep(state, 'player-one', { level: 5, seed: 202711430 })

    expect(decision.action).not.toBe('error')
    expect(decision.state).not.toBe(state)
    expect(decision.state.pendingOnPlay).toBeNull()
    expect(decision.state.players['player-one'].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )).toContain(target.instanceId)
    expect(state).toEqual(before)
  })

  it('does not fall back to a protected Cookie for a required opponent movement effect', () => {
    const printed = (number: string, owner: PlayerId, copy: number): GameCard => {
      const entry = getCardPoolEntry(number)
      expect(entry, `missing formal card ${number}`).toBeDefined()
      return createCard(entry!, owner, copy)
    }
    const inBattle = (
      card: CookieCard,
      hpCardNumbers: string[],
      owner: PlayerId,
      battleEntryId: string,
    ) => ({
      card,
      hpCards: hpCardNumbers.map((number, index) => printed(number, owner, index + 1)),
      rested: false,
      battleEntryId,
    })
    const source = testCookieCard('required-opponent-movement-source', {
      level: 3,
      hp: 3,
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Place one opponent Cookie of LV.2 or lower into trash.',
        effects: [{ kind: 'opponent-battle-to-trash', maxLevel: 2 }],
      },
    })
    const timekeeper = printed('BS6-010', 'player-one', 1) as CookieCard
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      deck: [],
      battleArea: [{
        card: source,
        hpCards: [testSupportCard('required-opponent-movement-source-hp')],
        rested: false,
        battleEntryId: 'required-opponent-movement-source:battle:1',
      }],
    })
    state.players['player-one'].battleArea = [
      inBattle(
        timekeeper,
        ['BS6-011', 'BS6-012'],
        'player-one',
        'timekeeper:battle:1',
      ),
    ]
    state.pendingOnPlay = {
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      origin: 'hand',
    }
    const before = structuredClone(state)

    const decision = takeAiStep(state, 'player-two', { level: 5, seed: 202671351 })

    expect(decision.action).not.toBe('error')
    expect(decision.effectSelections?.flatMap((selection) => selection.targetIds))
      .not.toContain(timekeeper.instanceId)
    expect(decision.state.players['player-one'].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )).toContain(timekeeper.instanceId)
    expect(state).toEqual(before)
  })

  it('resolves BS2-062 on-play without selecting a Cookie protected by BS6-010', () => {
    const printed = (number: string, owner: PlayerId, copy: number): GameCard => {
      const entry = getCardPoolEntry(number)
      expect(entry, `missing formal card ${number}`).toBeDefined()
      return createCard(entry!, owner, copy)
    }
    const inBattle = (
      card: CookieCard,
      hpCardNumbers: string[],
      owner: PlayerId,
      battleEntryId: string,
    ) => ({
      card,
      hpCards: hpCardNumbers.map((number, index) => printed(number, owner, index + 1)),
      rested: false,
      battleEntryId,
    })
    const starfruit = printed('BS2-062', 'player-two', 1) as CookieCard
    const timekeeper = printed('BS6-010', 'player-one', 1) as CookieCard
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      deck: [],
      supportArea: [{
        card: printed('BS2-077', 'player-two', 1),
        rested: false,
      }],
      battleArea: [
        inBattle(
          starfruit,
          ['BS2-059', 'BS2-060', 'BS2-061'],
          'player-two',
          'starfruit:battle:1',
        ),
      ],
    })
    state.players['player-one'].battleArea = [
      inBattle(
        timekeeper,
        ['BS6-011', 'BS6-012', 'BS6-013', 'BS6-014'],
        'player-one',
        'timekeeper:battle:1',
      ),
    ]
    state.pendingOnPlay = {
      playerId: 'player-two',
      sourceInstanceId: starfruit.instanceId,
      origin: 'hand',
    }
    const before = structuredClone(state)

    const decision = takeAiStep(state, 'player-two', { level: 5, seed: 202671351 })

    expect(decision.action).toBe('activate-skill')
    expect(decision.state.pendingOnPlay).toBeNull()
    expect(decision.effectSelections?.flatMap((selection) => selection.targetIds) ?? [])
      .not.toContain(starfruit.instanceId)
    expect(decision.effectSelections?.flatMap((selection) => selection.targetIds) ?? [])
      .not.toContain(timekeeper.instanceId)
    expect(decision.state.players['player-two'].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )).toEqual([starfruit.instanceId])
    expect(decision.state.players['player-one'].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )).toEqual([timekeeper.instanceId])
    expect(state).toEqual(before)
  })

  it('uses protected-target rules for opponent movement effects after an attack', () => {
    const base = createBattleState()
    const timekeeperEntry = getCardPoolEntry('BS6-010')
    expect(timekeeperEntry).toBeDefined()
    const timekeeper = createCard(timekeeperEntry!, 'player-one', 1) as CookieCard
    const hpCardNumbers = ['BS6-011', 'BS6-012', 'BS6-013', 'BS6-014']
    const timekeeperHp = hpCardNumbers.map((number, index) => {
      const entry = getCardPoolEntry(number)
      expect(entry, `missing formal card ${number}`).toBeDefined()
      return createCard(entry!, 'player-one', index + 1)
    })
    const withTimekeeper: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{
            card: timekeeper,
            hpCards: timekeeperHp,
            rested: false,
            battleEntryId: 'timekeeper:battle:1',
          }],
        },
      },
    }
    const declared = beginAttack(
      withTimekeeper,
      base.players['player-two'].battleArea[0]!.card.instanceId,
      timekeeper.instanceId,
      ['p2-support'],
    )
    const state: GameState = {
      ...declared,
      pendingBattle: {
        ...declared.pendingBattle!,
        stage: 'attack-effect',
        attackEffects: [{ kind: 'opponent-battle-to-trash', maxLevel: 2, min: 0 }],
        attackEffectIndex: 0,
      },
    }

    const decision = handleAiPendingBattle(state, 'player-two', 5)

    expect(decision?.action).toBe('resolve-attack-effect')
    expect(decision?.state.commandLog?.at(-1)).toMatchObject({
      commandKind: 'resolve-attack-effect',
      payload: { targetIds: [] },
    })
    expect(decision?.state.players['player-one'].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )).toContain(timekeeper.instanceId)
  })
})

describe('resolveAiSkill discardHand', () => {
  it('discards first N hand cards deterministically for discardHand cost', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const handCard2: GameCard = {
      id: 'hc2', instanceId: 'hc2-inst', name: 'HandCard2', type: 'item',
    }
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 2 },
        text: 'Test discardHand 2',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1, handCard2],
      battleArea: [
        { card: cookie, hpCards: [testSupportCard('skill-cookie-hp')], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })
    state.firstPlayerId = 'player-one'
    state.turnNumber = 2

    const opponentCookie = testCookieCard('opp-cookie', { hp: 2 })
    state.players['player-one'].battleArea = [
      {
        card: opponentCookie,
        hpCards: [
          testSupportCard('opp-cookie-hp-1'),
          testSupportCard('opp-cookie-hp-2'),
        ],
        rested: false,
        battleEntryId: 'opp-cookie:battle:1',
      },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')
    expect(result.description).toContain('skill-cookie')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand.map((c) => c.instanceId)).toEqual(['hc2-inst'])
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc1-inst')

    const modifiers = result.state.attackModifiers.filter(
      (m) => m.sourceInstanceId === 'skill-cookie',
    )
    expect(modifiers).toHaveLength(1)
    expect(modifiers[0].amount).toBe(1)
  })

  it('discards first 1 hand card for ST4-012-style discardHand cost', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const cookie = testCookieCard('werewolf', {
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'Werewolf Cookie skill',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1],
      battleArea: [
        { card: cookie, hpCards: [testSupportCard('werewolf-hp')], rested: false, battleEntryId: 'werewolf:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })
    state.firstPlayerId = 'player-one'
    state.turnNumber = 2

    const opponentCookie = testCookieCard('opp-cookie', { hp: 2 })
    state.players['player-one'].battleArea = [
      {
        card: opponentCookie,
        hpCards: [
          testSupportCard('opp-cookie-hp-1'),
          testSupportCard('opp-cookie-hp-2'),
        ],
        rested: false,
        battleEntryId: 'opp-cookie:battle:1',
      },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand).toHaveLength(1)
    expect(updatedPlayer.hand[0].instanceId).toBe('hc1-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
  })

  it('does not attempt discardHand skill when hand is insufficient', () => {
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 3 },
        text: 'Test discardHand 3',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [{ id: 'only', instanceId: 'only-inst', name: 'Only', type: 'item' }],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).not.toBe('activate-skill')
    expect(result.action).not.toBe('error')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand).toHaveLength(1)
  })

  it('does not throw and does not get stuck when discardHand skill hand is insufficient', () => {
    const cookie = testCookieCard('skill-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 5 },
        text: 'Test discardHand 5',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const support = testSupportCard('sup-r', 'red')

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [{ id: 'only', instanceId: 'only-inst', name: 'Only', type: 'item' }],
      battleArea: [
        { card: cookie, hpCards: [], rested: false, battleEntryId: 'skill-cookie:battle:1' },
      ],
      supportArea: [{ card: support, rested: false }],
    })

    const opponentCookie = testCookieCard('opp-cookie')
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).not.toBe('error')
  })
})

describe('resolveAiSkill discardHand with supportToTrash combined', () => {
  it('pays both discardHand and supportToTrash costs simultaneously', () => {
    const handCard0: GameCard = {
      id: 'hc0', instanceId: 'hc0-inst', name: 'HandCard0', type: 'item',
    }
    const handCard1: GameCard = {
      id: 'hc1', instanceId: 'hc1-inst', name: 'HandCard1', type: 'item',
    }
    const cookie = testCookieCard('combo-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 1, supportToTrash: 1 },
        text: 'Test combo',
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const paymentSupport = testSupportCard('pay-sup', 'red')
    const trashSupport: GameCard = {
      id: 'trash-sup', instanceId: 'trash-sup-inst', name: 'TrashSup', type: 'item', energyColor: 'yellow',
    }

    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [handCard0, handCard1],
      battleArea: [
        { card: cookie, hpCards: [testSupportCard('combo-cookie-hp')], rested: false, battleEntryId: 'combo-cookie:battle:1' },
      ],
      supportArea: [
        { card: paymentSupport, rested: false },
        { card: trashSupport, rested: false },
      ],
    })
    state.firstPlayerId = 'player-one'
    state.turnNumber = 2

    const opponentCookie = testCookieCard('opp-cookie', { hp: 2 })
    state.players['player-one'].battleArea = [
      {
        card: opponentCookie,
        hpCards: [
          testSupportCard('opp-cookie-hp-1'),
          testSupportCard('opp-cookie-hp-2'),
        ],
        rested: false,
        battleEntryId: 'opp-cookie:battle:1',
      },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand.map((c) => c.instanceId)).toEqual(['hc1-inst'])
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('hc0-inst')
    expect(updatedPlayer.discardPile.map((c) => c.instanceId)).toContain('trash-sup-inst')
    expect(updatedPlayer.supportArea).toHaveLength(1)
    expect(updatedPlayer.supportArea[0].card.instanceId).toBe('pay-sup')
    expect(updatedPlayer.supportArea[0].rested).toBe(true)
  })
})

describe('resolveAiSkill supportToHand cost', () => {
  it('passes the selected support card back to the rules layer', () => {
    const cookie = testCookieCard('return-support-cookie', {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, supportToHand: 1 },
        text: 'Return one support card.',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const paymentSupport = testSupportCard('return-payment', 'red')
    const returnedSupport = testSupportCard('return-to-hand', 'yellow')
    const state = buildTestState('player-two', {
      id: 'player-two',
      hand: [],
      battleArea: [
        {
          card: cookie,
          hpCards: [testSupportCard('return-support-source-hp')],
          rested: false,
          battleEntryId: 'return-support-cookie:battle:1',
        },
      ],
      supportArea: [
        { card: paymentSupport, rested: false },
        { card: returnedSupport, rested: false },
      ],
    })
    state.firstPlayerId = 'player-one'
    state.turnNumber = 2

    state.players['player-one'].battleArea = [
      {
        card: testCookieCard('opponent-cookie', { hp: 2 }),
        hpCards: [
          testSupportCard('opponent-cookie-hp-1'),
          testSupportCard('opponent-cookie-hp-2'),
        ],
        rested: false,
        battleEntryId: 'opponent-cookie:battle:1',
      },
    ]

    const result = takeAiStep(state, 'player-two')
    expect(result.action).toBe('activate-skill')

    const updatedPlayer = result.state.players['player-two']
    expect(updatedPlayer.hand.map((card) => card.instanceId)).toEqual([
      returnedSupport.instanceId,
    ])
    expect(updatedPlayer.supportArea).toEqual([
      { card: paymentSupport, rested: true },
    ])
  })
})

describe('simulateAiMatch with discardHand skill', () => {
  it('completes a match without getting stuck on discardHand skills', () => {
    const handCards: GameCard[] = Array.from({ length: 5 }, (_, i) => ({
      id: `hc${i}`, instanceId: `hc${i}-inst`, name: `HandCard${i}`, type: 'item',
    }))
    const cookie = testCookieCard('ai-cookie', {
      hp: 2,
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'AI discardHand skill',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    const opponentCookie = testCookieCard('opp-cookie', { hp: 1 })

    const state: GameState = buildTestState('player-two', {
      id: 'player-two',
      hand: [cookie, ...handCards],
      battleArea: [],
      supportArea: [],
      deck: [],
    })
    state.players['player-one'].battleArea = [
      { card: opponentCookie, hpCards: [], rested: false, battleEntryId: 'opp-cookie:battle:1' },
    ]
    state.players['player-one'].hand = [{ id: 'p1h', instanceId: 'p1h-inst', name: 'P1Hand', type: 'item' }]

    let deployed = deployCookie(state, cookie.instanceId)
    while (deployed.phase !== 'main') {
      deployed = advancePhase(deployed)
    }

    const result = simulateAiMatch(deployed, 50)
    expect(result.stuck).toBe(false)
    expect(result.error).toBeNull()
  })
})
