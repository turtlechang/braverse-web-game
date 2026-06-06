import officialSample from '../../data/cards/official-sample.en.json'
import { createGame, selectStartingCookie } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

interface DemoCardSource {
  baseCardNumber: string
  cardNumber: string
  name: string
  type: string
  level: number | null
  hp: number | null
  attackText: string | null
  imageUrl: string
}

const parseAttack = (text: string | null) => {
  const cost = text?.match(/\{[A-Z]\}/g)?.length ?? 0
  const damage =
    Number(text?.match(/Deals?\s+(\d+)\s+damage/i)?.[1] ?? 1)

  return { cost, damage }
}

const createDemoDeck = (playerId: PlayerId): GameCard[] => {
  const sourceCards = officialSample.cards as DemoCardSource[]

  return Array.from({ length: 60 }, (_, index) => {
    const source = sourceCards[index % sourceCards.length]
    const instanceId = `${playerId}-${source.cardNumber}-${index + 1}`

    if (
      (source.type === 'cookie' || source.type === 'flip') &&
      source.level !== null &&
      source.hp !== null
    ) {
      const attack = parseAttack(source.attackText)

      return {
        id: source.baseCardNumber,
        instanceId,
        name: source.name,
        imageUrl: source.imageUrl,
        type: 'cookie',
        level: source.level,
        hp: source.hp,
        attack: attack.damage,
        attackCost: attack.cost,
      }
    }

    return {
      id: source.baseCardNumber,
      instanceId,
      name: source.name,
      imageUrl: source.imageUrl,
      type:
        source.type === 'trap' || source.type === 'stage'
          ? source.type
          : 'item',
    }
  })
}

const identityShuffle = (cards: GameCard[]) => [...cards]

export const createDemoGame = (): GameState => {
  let state = createGame(
    {
      id: 'player-one',
      name: '玩家',
      deck: createDemoDeck('player-one'),
    },
    {
      id: 'player-two',
      name: 'AI 對手',
      deck: createDemoDeck('player-two'),
    },
    'player-one',
    identityShuffle,
  )

  state = selectStartingCookie(
    state,
    'player-one',
    'player-one-ST1-001-1',
  )
  state = selectStartingCookie(
    state,
    'player-two',
    'player-two-ST1-001-1',
  )

  return state
}
