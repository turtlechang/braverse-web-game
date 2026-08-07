import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  applyGameCommand,
  beginAttack,
  canAttack,
  resolveAttackEffect,
  resolveNextDamage,
  skipTrap,
} from '.'
import officialBS3 from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  cookie,
  createBattleState,
  declareAttack,
  item,
} from './test-helpers/battle-helpers'

describe('post-attack effects', () => {
  it('resolves Wizard Cookie break-to-trash after damage and before battle completion', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      { kind: 'break-to-trash', max: 1, exactLevel: 1 },
    ]
    state.players['player-two'].breakArea = [cookie('break-level-one')]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', ['break-level-one'])

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].breakArea).toHaveLength(0)
    expect(
      state.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toContain('break-level-one')
  })

  it('skips conditional attack effect when condition is not met', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingBattle).toBeNull()
  })

  it('applies BS2-058-style conditional bonus damage when the attacker has 15+ cards in their own trash', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 4
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ]
    state.players['player-two'].discardPile = Array.from(
      { length: 15 },
      (_, i) => item(`p2-trash-${i}`),
    )
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 6 },
      (_, i) => item(`defender-hp-${i}`),
    )

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })
    // 主傷害 4 點先扣完，後續條件效果尚未結算。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)

    state = resolveAttackEffect(state, 'player-two', ['defender'])

    expect(state.pendingBattle).toBeNull()
    // 條件成立（攻擊方棄牌區 15 張），額外 1 點傷害確實扣到防守方餅乾。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('skips BS2-058-style conditional bonus damage when the attacker has fewer than 15 cards in their own trash', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 4
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ]
    // player-two 的棄牌區維持預設空值（<15 張），條件不成立。
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 6 },
      (_, i) => item(`defender-hp-${i}`),
    )

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingBattle).toBeNull()
    // 條件不成立，防守方餅乾 HP 停在主傷害結算後的數字，沒有再多扣 1 點。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('skips optional attack effect with no valid candidates when attacker is the only cookie', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingBattle).toBeNull()
  })

  it('continues a later attack effect after the attacker pays its last HP card', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      {
        kind: 'field-to-trash',
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
          maxLevel: 1,
          attackTargetOnly: true,
        },
      },
    ]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    state = resolveAttackEffect(state, 'player-two', ['attacker'])

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 1,
    })
    expect(state.players['player-two'].battleArea).toHaveLength(0)

    state = resolveAttackEffect(state, 'player-two', ['defender'])

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].breakArea.map((card) => card.instanceId)).toContain(
      'defender',
    )
  })

  it('BS3-060 resolves its active-support Then after self-faint and releases the main phase', () => {
    const officialCard = (officialBS3.cards as OfficialCardRecord[]).find(
      (card) => card.cardNumber === 'BS3-060',
    )
    if (!officialCard) throw new Error('Missing BS3-060')
    const conversion = convertOfficialCardToGameCard(officialCard)
    if (conversion.status !== 'converted') {
      throw new Error('BS3-060 should convert to a runtime card')
    }

    let state = createBattleState()
    if (conversion.gameCard.type !== 'cookie') {
      throw new Error('BS3-060 should convert to a Cookie')
    }
    const attacker = {
      ...conversion.gameCard,
      instanceId: 'attacker',
    }
    state.players['player-two'].battleArea = [
      {
        card: attacker,
        hpCards: [item('attacker-last-hp')],
        rested: false,
        battleEntryId: 'attacker:battle:2',
      },
      {
        card: cookie('ally', 2, 3),
        hpCards: [item('ally-hp-1'), item('ally-hp-2'), item('ally-hp-3')],
        rested: false,
        battleEntryId: 'ally:battle:3',
      },
    ]
    state.players['player-two'].supportArea = Array.from(
      { length: 5 },
      (_, index) => ({
        card: item(`green-support-${index}`, 'green'),
        rested: false,
      }),
    )
    state.players['player-two'].hand = [cookie('replacement', 2, 2)]
    state.players['player-two'].deck = Array.from(
      { length: 6 },
      (_, index) => item(`replacement-hp-${index}`),
    )
    state.players['player-one'].battleArea = [
      {
        card: cookie('defender', 5, 6),
        hpCards: Array.from({ length: 6 }, (_, index) =>
          item(`defender-hp-${index}`),
        ),
        rested: false,
        battleEntryId: 'defender:battle:1',
      },
    ]

    const paymentIds = state.players['player-two'].supportArea.map(
      (support) => support.card.instanceId,
    )
    state = beginAttack(
      state,
      'attacker',
      'defender',
      paymentIds,
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', ['attacker'])

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 1,
    })
    expect(state.players['player-two'].battleArea).not.toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ id: 'BS3-060' }) }),
    )
    expect(
      state.players['player-two'].breakArea.map((card) => card.id),
    ).toContain('BS3-060')

    state = resolveAttackEffect(state, 'player-two', [
      'green-support-0',
      'green-support-1',
    ])

    expect(state.pendingBattle).toBeNull()
    expect(state.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-two', remaining: 1 }],
    })

    state = applyGameCommand(state, {
      kind: 'replace-cookie',
      playerId: 'player-two',
      instanceId: 'replacement',
    })

    expect(state.pendingReplacement).toBeNull()
    expect(canAttack(state)).toBe(true)
    expect(advancePhase(state).phase).toBe('end')
  })
})
