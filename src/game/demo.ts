import officialSample from '../../data/cards/official-sample.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createGame, selectStartingCookie } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const parseAttack = (text: string | null) => {
  const cost = text?.match(/\{[A-Z]\}/g)?.length ?? 0
  const damage =
    Number(text?.match(/Deals?\s+(\d+)\s+damage/i)?.[1] ?? 1)

  return { cost, damage }
}

const createDemoDeck = (playerId: PlayerId): GameCard[] => {
  const sourceCards = officialSample.cards as OfficialCardRecord[]

  return Array.from({ length: 60 }, (_, index) => {
    const source = sourceCards[index % sourceCards.length]
    const instanceId = `${playerId}-${source.cardNumber}-${index + 1}`
    const effectConversion = convertOfficialCardEffects(source)
    const skill = convertOfficialCookieSkill(source)
    const energyColor =
      source.energyType === 'MIX'
        ? 'wild'
        : source.color?.toLowerCase()
    const effectData =
      effectConversion.status === 'supported'
        ? {
            effectText: effectConversion.sourceText,
            effects: effectConversion.effects,
          }
        : {}

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
        energyColor:
          energyColor === 'red' ||
          energyColor === 'yellow' ||
          energyColor === 'green' ||
          energyColor === 'blue' ||
          energyColor === 'purple' ||
          energyColor === 'black' ||
          energyColor === 'wild'
            ? energyColor
            : undefined,
        type: 'cookie',
        level: source.level,
        hp: source.hp,
        attack: attack.damage,
        attackCost: attack.cost,
        ...effectData,
        ...(skill ? { skill } : {}),
      }
    }

    return {
      id: source.baseCardNumber,
      instanceId,
      name: source.name,
      imageUrl: source.imageUrl,
      energyColor:
        energyColor === 'red' ||
        energyColor === 'yellow' ||
        energyColor === 'green' ||
        energyColor === 'blue' ||
        energyColor === 'purple' ||
        energyColor === 'black' ||
        energyColor === 'wild'
          ? energyColor
          : undefined,
      type:
        source.type === 'trap' || source.type === 'stage'
          ? source.type
          : 'item',
      ...effectData,
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
