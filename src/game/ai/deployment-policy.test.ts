import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  takeAiStep,
  type CookieCard,
  type GameCard,
  type GameState,
} from '..'
import {
  assessLv5Deployment,
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

const energyItem = (id: string): GameCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'item',
  energyColor: 'red',
})

const aiMainState = (
  hand: GameCard[],
  opponentHp = 3,
  opponentActiveSupport = false,
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
        supportArea: opponentActiveSupport
          ? [{ card: energyItem('opponent-active-support'), rested: false }]
          : base.players['player-one'].supportArea,
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
  it('Lv.5 prefers one battle Cookie unless a public exception is confirmed', () => {
    const first = cookie('first', { level: 2, hp: 3, attack: 2 })
    const second = cookie('second', { level: 2, hp: 3, attack: 2 })
    const state = aiMainState([first, second])

    expect(assessLv5Deployment(state, 'player-two', second)).toMatchObject({
      penalty: -140,
      reason: 'single-cookie-discipline',
    })
    expect(assessLv5Deployment(state, 'player-two', second, {
      confirmedCombo: true,
    })).toMatchObject({
      penalty: 0,
      reason: 'confirmed-combo',
    })
  })

  it('Lv.5 permits a second Cookie for a public lethal', () => {
    const finisher = cookie('finisher', { level: 2, hp: 3, attack: 3 })
    const state = aiMainState([finisher], 1)

    expect(assessLv5Deployment(state, 'player-two', finisher)).toMatchObject({
      penalty: 0,
      reason: 'public-lethal',
    })
  })

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

  it('Lv.5 holds a generic second Cookie while the opponent can pay a response', () => {
    const first = cookie('first', { level: 2, hp: 3, attack: 2 })
    const second = cookie('second', { level: 2, hp: 3, attack: 2 })
    const base = aiMainState([first, second], 3, true)
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          stage: null,
        },
      },
    }
    const decision = takeAiStep(state, 'player-two', { level: 5, seed: 19 })

    expect(decision.action).not.toBe('deploy-cookie')
  })

  it('Lv.5 deploys a generic second Cookie when the opponent has no active support to answer', () => {
    const first = cookie('first', { level: 2, hp: 3, attack: 2 })
    const second = cookie('second', { level: 2, hp: 3, attack: 2 })
    const base = aiMainState([first, second], 3, false)
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          stage: null,
        },
      },
    }
    const decision = takeAiStep(state, 'player-two', { level: 5, seed: 19 })

    expect(decision.action).toBe('deploy-cookie')
  })
})
