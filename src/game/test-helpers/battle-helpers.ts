import {
  beginAttack,
  type CookieCard,
  type GameCard,
  type GameState,
} from '..'

export const item = (
  instanceId: string,
  energyColor: GameCard['energyColor'] = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor,
})

export const cookie = (
  instanceId: string,
  attack = 1,
  hp = 2,
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  officialType: 'cookie',
  level: 1,
  hp,
  attack,
  attackCost: 1,
  attackEnergyCost: { red: 1 },
  energyColor: 'red',
})

export const createBattleState = (): GameState => {
  const defender = cookie('defender', 1, 3)
  const attacker = cookie('attacker', 3, 1)

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '防守玩家',
        deck: [item('p1-deck-a'), item('p1-deck-b')],
        hand: [item('p1-hand-a'), cookie('p1-replacement')],
        battleArea: [
          {
            card: defender,
            hpCards: [
              item('defender-hp-a'),
              item('defender-hp-b'),
              item('defender-hp-c'),
            ],
            rested: false,
            battleEntryId: 'defender:battle:1',
          },
        ],
        supportArea: [
          { card: item('p1-support-a'), rested: false },
          { card: item('p1-support-b'), rested: false },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
      'player-two': {
        id: 'player-two',
        name: '攻擊玩家',
        deck: [item('p2-deck-a')],
        hand: [cookie('p2-replacement')],
        battleArea: [
          {
            card: attacker,
            hpCards: [item('attacker-hp')],
            rested: false,
            battleEntryId: 'attacker:battle:2',
          },
        ],
        supportArea: [
          { card: item('p2-support'), rested: false },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    skipAttackUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const declareAttack = (state: GameState) =>
  beginAttack(state, 'attacker', 'defender', ['p2-support'])