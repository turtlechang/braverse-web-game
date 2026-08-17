import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  takeAiStep,
  type CookieCard,
  type GameCard,
  type GameState,
} from '..'
import {
  canDeployCookieForLethal,
  isFlipCookie,
  shouldAvoidFlipDeployment,
} from './deployment-policy'

const cookie = (
  id: string,
  options: {
    flip?: boolean
    level?: number
    hp?: number
    attack?: number
  } = {},
): CookieCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'cookie',
  officialType: options.flip ? 'flip' : 'cookie',
  level: options.level ?? 1,
  hp: options.hp ?? 2,
  attack: options.attack ?? 1,
  attackCost: 0,
  attackEnergyCost: {},
  ...(options.flip
    ? {
        flip: {
          text: 'Draw up to 1 card from your deck.',
          cost: {},
          effects: [{ kind: 'draw-up-to' as const, max: 1 }],
        },
      }
    : {}),
})

const aiMainState = (
  hand: GameCard[],
  opponentHp = 3,
): GameState => {
  const base = createDemoGame(5, { player: 'red', ai: 'red' })
  const playerCookie = base.players['player-two'].battleArea[0]
  const opponentCookie = base.players['player-one'].battleArea[0]
  if (!playerCookie || !opponentCookie) {
    throw new Error('demo state did not create starting Cookies')
  }

  return {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    turnNumber: 2,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{
          ...opponentCookie,
          hpCards: opponentCookie.hpCards.slice(0, opponentHp),
        }],
      },
      'player-two': {
        ...base.players['player-two'],
        hand,
        supportArea: [],
        battleArea: [{
          ...playerCookie,
          rested: true,
        }],
      },
    },
  }
}

describe('AI Cookie deployment policy', () => {
  it('identifies both official FLIP cards and runtime FLIP abilities', () => {
    expect(isFlipCookie(cookie('official-flip', { flip: true }))).toBe(true)
    expect(
      isFlipCookie({
        ...cookie('runtime-flip'),
        officialType: 'cookie',
        flip: {
          text: 'Draw up to 1 card from your deck.',
          cost: {},
          effects: [{ kind: 'draw-up-to' as const, max: 1 }],
        },
      }),
    ).toBe(true)
    expect(isFlipCookie(cookie('normal'))).toBe(false)
  })

  it('avoids a FLIP second Cookie when a non-FLIP Cookie is available', () => {
    const flip = cookie('flip', { flip: true, level: 3, hp: 5, attack: 2 })
    const safe = cookie('safe', { level: 1, hp: 2, attack: 1 })
    const state = aiMainState([flip, safe])

    expect(shouldAvoidFlipDeployment(state, 'player-two', flip)).toBe(true)
    expect(shouldAvoidFlipDeployment(state, 'player-two', safe)).toBe(false)
    expect(canDeployCookieForLethal(state, 'player-two', flip)).toBe(false)
  })

  it('allows a FLIP Cookie when it is the only Cookie or can finish damage', () => {
    const flip = cookie('flip', { flip: true, level: 3, hp: 5, attack: 3 })
    const safe = cookie('safe', { level: 1, hp: 2, attack: 1 })

    const onlyFlip = aiMainState([flip])
    expect(shouldAvoidFlipDeployment(onlyFlip, 'player-two', flip)).toBe(false)

    const finisher = aiMainState([flip, safe], 1)
    expect(canDeployCookieForLethal(finisher, 'player-two', flip)).toBe(true)
    expect(shouldAvoidFlipDeployment(finisher, 'player-two', flip)).toBe(false)
  })

  it.each([2, 3, 4] as const)(
    'Lv.%i deploys the available non-FLIP Cookie instead of the risky one',
    (level) => {
      const flip = cookie('flip', { flip: true, level: 3, hp: 5, attack: 2 })
      const safe = cookie('safe', { level: 1, hp: 2, attack: 1 })
      const decision = takeAiStep(
        aiMainState([flip, safe]),
        'player-two',
        { level },
      )

      expect(decision.action).toBe('deploy-cookie')
      expect(decision.state.players['player-two'].battleArea.at(-1)?.card.id).toBe(
        'safe',
      )
    },
  )
})
