import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  canActivateStage,
  createDemoGame,
  isSpecialVictoryConditionMet,
  resolveBasicVictory,
  type CookieCard,
  type EnergyColor,
  type GameCard,
  type GameState,
} from '.'

const ENERGY_COLORS: EnergyColor[] = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
]

const createAncientCookie = (
  instanceId: string,
  name: string,
  energyColor: EnergyColor,
): CookieCard => ({
  id: instanceId,
  instanceId,
  name,
  type: 'cookie',
  level: 3,
  hp: 5,
  attack: 1,
  attackCost: 1,
  energyColor,
  keywords: ['ancient'],
})

const createSoulJam = (instanceId: string, name: string): GameCard => ({
  id: instanceId,
  instanceId,
  name,
  type: 'item',
  keywords: ['soul-jam'],
})

const createAgeOfHeroesAndKingdoms = (): GameCard => ({
  id: 'BS3-121',
  instanceId: 'BS3-121:1',
  name: 'Age of Heroes and Kingdoms',
  type: 'stage',
  cardColor: 'pure',
  stageAbility: {
    placementCost: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    cost: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    text: 'Activate: Win with five different Ancient Cookies and Soul Jam cards.',
    restSource: true,
    effects: [],
    specialVictory: {
      kind: 'distinct-named-keywords',
      requirements: [
        { keyword: 'ancient', cardType: 'cookie', count: 5 },
        { keyword: 'soul-jam', count: 5 },
      ],
    },
  },
})

const createState = ({
  duplicateAncientName = false,
}: {
  duplicateAncientName?: boolean
} = {}): GameState => {
  const state = createDemoGame(20260725)
  const ancientSupports = ENERGY_COLORS.map((energyColor, index) => ({
    card: createAncientCookie(
      `ancient-${index + 1}`,
      duplicateAncientName ? 'Hollyberry Cookie' : `Ancient Cookie ${index + 1}`,
      energyColor,
    ),
    rested: false,
  }))
  const soulJamSupports = Array.from({ length: 5 }, (_, index) => ({
    card: createSoulJam(
      `soul-jam-${index + 1}`,
      `Soul Jam: ${index + 1}`,
    ),
    rested: false,
  }))
  const player = state.players['player-one']

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...state.players,
      'player-one': {
        ...player,
        stage: { card: createAgeOfHeroesAndKingdoms(), rested: false },
        supportArea: [...ancientSupports, ...soulJamSupports],
      },
    },
  }
}

describe('BS3-121 Age of Heroes and Kingdoms', () => {
  it('does not end the game before its Activate ability is used', () => {
    const state = createState()
    const condition = state.players['player-one'].stage?.card.stageAbility
      ?.specialVictory

    expect(condition).toBeDefined()
    expect(
      isSpecialVictoryConditionMet(state, 'player-one', condition!),
    ).toBe(true)
    expect(resolveBasicVictory(state)).toMatchObject({
      status: 'playing',
      result: null,
    })
  })

  it('requires five distinct names for both runtime keyword groups', () => {
    const state = createState({ duplicateAncientName: true })
    const condition = state.players['player-one'].stage?.card.stageAbility
      ?.specialVictory

    expect(
      isSpecialVictoryConditionMet(state, 'player-one', condition!),
    ).toBe(false)
    expect(canActivateStage(state, 'player-one')).toBe(false)
  })

  it('wins through the normal stage activation command after paying all five colors', () => {
    const state = createState()

    expect(canActivateStage(state, 'player-one')).toBe(true)

    const next = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ENERGY_COLORS.map((_, index) => `ancient-${index + 1}`),
    })

    expect(next.players['player-one'].stage?.rested).toBe(true)
    expect(
      next.players['player-one'].supportArea
        .slice(0, ENERGY_COLORS.length)
        .every((support) => support.rested),
    ).toBe(true)
    expect(next).toMatchObject({
      status: 'finished',
      result: {
        winnerId: 'player-one',
        loserId: 'player-two',
        reason: 'special-victory',
      },
    })
  })
})
