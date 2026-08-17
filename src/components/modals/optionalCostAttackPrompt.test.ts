import { describe, expect, it } from 'vitest'
import {
  createBattleState,
  cookie,
  item,
} from '../../game/test-helpers/battle-helpers'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'

describe('getOptionalCostAttackPrompt', () => {
  it('names the energy colour so the player knows which support cards to rest', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: { blue: 1 } },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: '<can be used as {B}.> Deals 2 damage.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.energyCostTotal).toBe(1)
    expect(prompt?.costText).toBe('支付支援區 1 點藍色能量')
  })

  it('describes multi-colour energy and hand discard together', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: { red: 2, neutral: 1 }, discardHand: 1 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'Pay energy.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.energyCostTotal).toBe(3)
    expect(prompt?.costText).toBe(
      '支付支援區 2 點紅色能量、1 點無色能量、棄置 1 張手牌',
    )
  })

  it('exposes BS4-075 Black Pearl Cookie as a skippable discard-2 attack choice', () => {
    const state = createBattleState()
    state.players['player-two'].hand = [
      item('black-pearl-cost-1', 'blue'),
      item('black-pearl-cost-2', 'blue'),
    ]
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Black Pearl Cookie',
      cost: { energy: {}, discardHand: 2 },
      effects: [
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
      effectText:
        'Discard 2 cards from your hand to deal 2 damage to up to 1 opponent Cookie.',
    }

    expect(getOptionalCostAttackPrompt(state, 'player-two')).toMatchObject({
      sourceCardName: 'Black Pearl Cookie',
      costText: '棄置 2 張手牌',
      discardHandCost: 2,
      needsTarget: true,
      targetMin: 0,
      targetMax: 1,
      targetLabel: '對手餅乾',
    })
  })

  it('falls back to 無 when the effect genuinely has no cost', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: {} },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'No cost.',
    }

    expect(getOptionalCostAttackPrompt(state, 'player-two')?.costText).toBe('無')
  })

  it('returns self battle candidates and an optional target minimum', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
      effectText: 'Discard 1 card.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt).toMatchObject({
      needsTarget: true,
      targetMin: 0,
      targetLabel: '己方餅乾',
      targetCandidates: [
        { instanceId: state.players['player-two'].battleArea[0].card.instanceId },
      ],
    })
  })

  it('exposes up-to-3 opponent support targets with the support label (BS6-079)', () => {
    const state = createBattleState()
    const opponentSupport = [
      { card: item('opp-support-1'), rested: false },
      { card: item('opp-support-2'), rested: false },
      { card: item('opp-support-3'), rested: false },
    ]
    state.players['player-one'].supportArea = opponentSupport
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Croissant Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'rest-support',
          side: 'opponent',
          amount: 3,
          activeOnly: true,
          optional: true,
        },
      ],
      effectText:
        "Discard 1 card. Select up to 3 cards in your opponent's support area. Rest those cards.",
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt).toMatchObject({
      needsTarget: true,
      targetMin: 0,
      targetMax: 3,
      targetLabel: '對手支援區的卡',
      targetCandidates: [
        { instanceId: 'opp-support-1' },
        { instanceId: 'opp-support-2' },
        { instanceId: 'opp-support-3' },
      ],
    })
  })

  it('limits BS6-051 targets to green cards in the source player hand', () => {
    const state = createBattleState()
    state.players['player-two'].hand = [
      item('green-hand-a', 'green'),
      item('red-hand', 'red'),
      item('green-hand-b', 'green'),
    ]
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Timekeeper Cookie',
      cost: { energy: { green: 1 } },
      effects: [
        {
          kind: 'hand-to-support',
          amount: 2,
          rested: false,
          optional: true,
          energyColor: 'green',
        },
      ],
      effectText:
        'If your opponent has 3 or more support cards, place up to 2 {G} cards from your hand into your support area as active.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt).toMatchObject({
      targetMin: 0,
      targetMax: 2,
      targetLabel: '自己的手牌中的綠色卡牌',
      targetInstruction: '從自己的手牌選擇最多 2 張綠色卡牌作為目標',
      targetCandidates: [
        { instanceId: 'green-hand-a' },
        { instanceId: 'green-hand-b' },
      ],
    })
  })

  it('keeps a self-to-trash attack effect payable when the battle area is full (BS6-096)', () => {
    const state = createBattleState()
    const sourceEntry = state.players['player-two'].battleArea[0]
    const sourceCard = {
      ...sourceEntry.card,
      id: 'BS6-096',
      instanceId: 'BS6-096-source',
      name: 'Cherry Cookie',
      level: 2,
      energyColor: 'purple' as const,
    }
    const levelThree = {
      ...sourceEntry,
      card: {
        ...sourceEntry.card,
        id: 'lv3-cookie',
        instanceId: 'lv3-cookie',
        name: 'LV.3 Cookie',
        level: 3,
      },
      battleEntryId: 'lv3-cookie:battle:3',
    }
    const purpleLevelOne = {
      ...cookie('purple-lv1'),
      energyColor: 'purple' as const,
    }
    state.players['player-two'].battleArea = [
      { ...sourceEntry, card: sourceCard },
      levelThree,
    ]
    state.players['player-two'].discardPile = [purpleLevelOne]
    state.players['player-two'].supportArea = [
      { card: item('purple-support', 'purple'), rested: false },
    ]
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: sourceCard.instanceId,
      sourceCardName: sourceCard.name,
      cost: { energy: { purple: 1 }, selfToTrash: true },
      effects: [
        {
          kind: 'trash-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'purple',
          condition: {
            kind: 'battle-area-has-cookie-with-level',
            side: 'self',
            level: 3,
          },
        },
      ],
      effectText:
        'If there is a LV.3 Cookie in your battle area, pay {P}, place this Cookie in the trash, then play 1 {P} LV.1 Cookie from your trash.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.energyCostTotal).toBe(1)
    expect(prompt?.costText).toBe('支付支援區 1 點紫色能量')
    expect(prompt?.targetCandidates).toEqual([
      { card: purpleLevelOne, instanceId: 'purple-lv1' },
    ])
  })

  // 使用者問「其他類型的卡有嗎」——BS3-086 這類攻擊文字裡「Then, <discard
  // 1 card.> if there is a LV.3 Cookie in your battle area, deal 1 damage」
  // 是同樣的結構：optional-cost-attack 內嵌的子效果自己掛 condition，
  // resolveOptionalCostAttack 本來就會用 isEffectConditionMet 過濾（不會
  // 拋錯），但玩家付款前完全看不到任何說明。這裡驗證條件不成立時會產生
  // 跟陷阱一致的提醒文字。
  it('warns when the nested effect condition is not met (BS3-086-like battle-area-has-cookie-with-level)', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Kouign-Amann Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: {
            kind: 'battle-area-has-cookie-with-level',
            side: 'self',
            level: 3,
          },
        },
      ],
      effectText: 'If you have a LV.3 Cookie in your battle area, discard 1 card to deal 1 damage.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.unmetConditionWarning).toBe(
      '目前條件不成立，確認後會略過此效果。',
    )
  })

  it('does not warn when the nested effect condition is met', () => {
    const state = createBattleState()
    state.players['player-two'].battleArea.push({
      card: { ...cookie('p2-lv3'), level: 3 },
      hpCards: [],
      rested: false,
      battleEntryId: 'p2-lv3:battle:9',
    })
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Kouign-Amann Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: {
            kind: 'battle-area-has-cookie-with-level',
            side: 'self',
            level: 3,
          },
        },
      ],
      effectText: 'If you have a LV.3 Cookie in your battle area, discard 1 card to deal 1 damage.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.unmetConditionWarning).toBeNull()
  })

  it('warns with the break-count-specific message when applicable', () => {
    const state = createBattleState()
    state.players['player-two'].breakArea = []
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: {} },
      effects: [
        {
          kind: 'damage-by-break-count',
          perCount: 1,
          exactBreakLevel: 3,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'Deal 1 damage for each LV.3 Cookie in your break area.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.unmetConditionWarning).toBe(
      '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。',
    )
  })
})
