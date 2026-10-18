import { describe, expect, it } from 'vitest'
import bs9Cards from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  getLegalTurnCommands,
  type ExtraDeckCard,
  type GameState,
} from '.'
import { takeAiStep } from './ai'
import { handleAiRandomTurnState } from './ai/random-turn-handler'
import { handleAiTurnState, type AiTurnStrategy } from './ai/turn-handler'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { createBattleState, item } from './test-helpers/battle-helpers'

const bs9Records = bs9Cards.cards as unknown as OfficialCardRecord[]

const minimalStrategy: AiTurnStrategy = {
  chooseEffectTargets: () => [],
  resolveCardAbility: () => null,
  resolveSkill: () => null,
  chooseReplacement: () => undefined,
  chooseAttackTarget: () => undefined,
}

const avatar = (requirement?: ExtraDeckCard['playRequirement']): ExtraDeckCard => ({
  id: 'BS8-005',
  instanceId: 'bs8-avatar-extra',
  name: 'Avatar of Ruin Cookie',
  type: 'extra',
  level: 3,
  hp: 5,
  attack: 3,
  attackCost: 3,
  ...(requirement ? { playRequirement: requirement } : {}),
})

const createAiExtraState = (
  requirement?: ExtraDeckCard['playRequirement'],
): GameState => {
  const state = createBattleState()
  return {
    ...state,
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        hand: [],
        deck: Array.from({ length: 5 }, (_, index) => item(`extra-hp-${index}`)),
        extraDeck: [avatar(requirement)],
      },
    },
  }
}

describe('AI EXTRA Deck command handling', () => {
  it('keeps an EXTRA-selected optional attack cost in the ability queue', () => {
    const printed = bs9Records.find((card) => card.cardNumber === 'BS9-055')
    expect(printed).toBeDefined()
    if (!printed) throw new Error('BS9-055 official printing is missing')

    const conversion = convertOfficialCardToExtraDeckCard(printed, 'ai-extra-cost-test')
    expect(conversion.status).toBe('converted')
    if (conversion.status !== 'converted') throw new Error(conversion.reason)

    const extra = { ...conversion.extraDeckCard, instanceId: 'bs9-055-extra-cost-test' }
    let state = createCardCheckDemoState('BS9-079', { normalAttack: 'payable' })
    const vulnerableTargetId = state.players['player-two'].battleArea[0]?.card.instanceId
    expect(vulnerableTargetId).toBeDefined()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          extraDeck: [extra],
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: state.players['player-two'].battleArea.map((cookie, index) =>
            index === 0 ? { ...cookie, hpCards: cookie.hpCards.slice(-1) } : cookie,
          ),
          discardPile: [],
        },
      },
    }
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    const selected = takeAiStep(state, 'player-one', {
      level: 5,
      seed: 17,
      searchNow: () => 0,
    })
    expect(selected.state.pendingAbilityEffect?.sourceInstanceId).toBe(extra.instanceId)

    const resolved = takeAiStep(selected.state, 'player-one', {
      level: 5,
      seed: 17,
      searchNow: () => 0,
    })
    expect(resolved.state.pendingOptionalCostAttack).toMatchObject({
      sourceInstanceId: extra.instanceId,
      resolution: 'ability',
      cost: { supportToHand: 1 },
    })

    const paid = takeAiStep(resolved.state, 'player-one', {
      level: 5,
      seed: 17,
      searchNow: () => 0,
    })
    expect(paid.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'resolve-optional-cost-attack',
      action: 'pay',
      supportToHandIds: [expect.any(String)],
    })

    const damaged = takeAiStep(paid.state, 'player-one', {
      level: 5,
      seed: 17,
      searchNow: () => 0,
    })
    expect(
      damaged.state.players['player-two'].battleArea.some(
        (cookie) => cookie.card.instanceId === vulnerableTargetId,
      ),
    ).toBe(false)
  })

  it('resolves an EXTRA-selected detached FLIP through the battle decision queue', () => {
    const printed = bs9Records.find((card) => card.cardNumber === 'BS9-030')
    expect(printed).toBeDefined()
    if (!printed) throw new Error('BS9-030 official printing is missing')

    const conversion = convertOfficialCardToExtraDeckCard(printed, 'ai-extra-flip-test')
    expect(conversion.status).toBe('converted')
    if (conversion.status !== 'converted') throw new Error(conversion.reason)

    const extra = { ...conversion.extraDeckCard, instanceId: 'bs9-030-extra-flip-test' }
    const flipRecord = bs9Records.find((card) => card.cardNumber === 'BS9-026')
    expect(flipRecord).toBeDefined()
    if (!flipRecord) throw new Error('BS9-026 official printing is missing')
    const flipConversion = convertOfficialCardToGameCard(flipRecord, 'ai-extra-flip-test')
    expect(flipConversion.status).toBe('converted')
    if (flipConversion.status !== 'converted') throw new Error(flipConversion.reason)
    const handFlip = { ...flipConversion.gameCard, instanceId: 'bs9-026-extra-flip-test' }
    expect(handFlip.flip).toBeDefined()

    let state = createCardCheckDemoState('BS9-079', { normalAttack: 'payable' })
    const player = state.players['player-one']

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          extraDeck: [extra],
          discardPile: [],
          hand: [handFlip],
        },
        'player-two': {
          ...state.players['player-two'],
          discardPile: [],
        },
      },
    }
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    const selected = takeAiStep(state, 'player-one', {
      level: 5,
      seed: 23,
      searchNow: () => 0,
    })
    expect(selected.state.pendingAbilityEffect?.sourceInstanceId).toBe(extra.instanceId)

    const openedCost = takeAiStep(selected.state, 'player-one', {
      level: 5,
      seed: 23,
      searchNow: () => 0,
    })
    expect(openedCost.state.pendingOptionalCostAttack).toMatchObject({
      sourceInstanceId: extra.instanceId,
      resolution: 'ability',
      cost: { discardHand: 1, discardHandHasFlip: true },
    })

    const paid = takeAiStep(openedCost.state, 'player-one', {
      level: 5,
      seed: 23,
      searchNow: () => 0,
    })
    expect(paid.state.pendingBattle).toMatchObject({
      stage: 'flip',
      detachedFlip: true,
      revealedHpCard: { instanceId: handFlip.instanceId },
    })

    const activated = takeAiStep(paid.state, 'player-one', {
      level: 5,
      seed: 23,
      searchNow: () => 0,
    })
    expect(activated.state.commandLog?.at(-1)?.payload).toMatchObject({
      kind: 'resolve-flip',
      activate: true,
    })
    expect(activated.state.pendingDrawUpTo).toMatchObject({
      sourceCardId: 'BS9-026',
    })

    const finished = applyGameCommand(activated.state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 0,
    })
    expect(finished.pendingDrawUpTo).toBeNull()
    expect(finished.pendingBattle).toBeNull()
    expect(finished.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: handFlip.instanceId }),
    )
  })

  it('lets Lv.1 choose a legal EXTRA deployment and reports the card name', () => {
    const state = createAiExtraState()
    const commands = getLegalTurnCommands(state, 'player-two')
    const extraIndex = commands.findIndex(
      (command) => command.kind === 'play-extra-deck-cookie',
    )

    expect(extraIndex).toBeGreaterThanOrEqual(0)

    const decision = handleAiRandomTurnState(
      state,
      'player-two',
      () => extraIndex / commands.length,
    )

    expect(decision.action).toBe('deploy-cookie')
    expect(decision.description).toContain('Avatar of Ruin Cookie')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(true)
  })

  it('lets Lv.2 use a legal direct-play EXTRA when it has no hand deployment', () => {
    const decision = handleAiTurnState(createAiExtraState(), 'player-two', minimalStrategy)

    expect(decision.action).toBe('deploy-cookie')
    expect(decision.description).toContain('Avatar of Ruin Cookie')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(true)
  })

  it('does not let Lv.2 bypass an unmet EXTRA play requirement', () => {
    const decision = handleAiTurnState(
      createAiExtraState({
        kind: 'cookies-fainted-this-turn-at-least',
        side: 'self',
        count: 2,
      }),
      'player-two',
      minimalStrategy,
    )

    expect(decision.action).toBe('advance-phase')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(false)
  })
})
