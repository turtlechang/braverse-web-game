import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  beginAttack,
  executeCardEffect,
  finalizePendingReplacements,
  getFaintEffectCardCandidates,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  replaceDefeatedCookie,
  resolveFlip,
  resolveFaintEffect,
  resolveNextDamage,
  skipDefeatedCookieReplacement,
  skipTrap,
  type CookieCard,
  type GameState,
} from '.'
import { cookie, item } from './test-helpers/battle-helpers'

describe('faint effect queue', () => {
  const createFaintState = (): GameState => {
    const faintCookie: CookieCard = {
      id: 'faint-cookie',
      instanceId: 'faint-cookie',
      name: 'Faint Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 2,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }

    const attacker: CookieCard = {
      id: 'attacker',
      instanceId: 'attacker',
      name: 'attacker',
      type: 'cookie',
      officialType: 'cookie',
      level: 1,
      hp: 2,
      attack: 5,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'red',
    }

    return {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('p1-d')],
          hand: [cookie('p1-replacement')],
          battleArea: [
            {
              card: faintCookie,
              hpCards: [item('faint-hp')],
              rested: false,
              battleEntryId: 'faint:battle:1',
            },
          ],
          supportArea: [{ card: item('p1-s'), rested: false }],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: 'P2',
          deck: [item('p2-d')],
          hand: [cookie('p2-replacement')],
          battleArea: [
            {
              card: attacker,
              hpCards: [item('p2-hp')],
              rested: false,
              battleEntryId: 'attacker:battle:2',
            },
          ],
          supportArea: [{ card: item('p2-s'), rested: false }],
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
      pendingReplacement: null,
      departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
      pendingRefresh: null,
      pendingBattle: null,
    }
  }

  it('queues faint effect instead of auto-executing in battle damage', () => {
    const state = createFaintState()
    const battleState = beginAttack(
      state,
      'attacker',
      'faint-cookie',
      ['p2-s'],
    )
    const battle1 = skipTrap(battleState, 'player-one')
    const afterDamage = resolveNextDamage(battle1)

    expect(afterDamage.pendingFaintEffects).toBeDefined()
    expect(afterDamage.pendingFaintEffects!.length).toBe(1)
    expect(afterDamage.pendingFaintEffects![0].sourceInstanceId).toBe('faint-cookie')
    expect(afterDamage.pendingFaintEffects![0].sourcePlayerId).toBe('player-one')
  })

  it('queues BS4-011 after its attack faints an opponent, resolving draw/discard before replacement', () => {
    const base = createFaintState()
    const attacker = base.players['player-two'].battleArea[0]
    const bs4011 = {
      ...attacker.card,
      id: 'BS4-011',
      name: 'Chili Pepper Cookie',
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: "If your opponent's Cookie faints from this Cookie's attack, draw 1 card from your deck and discard 1 card.",
        effects: [
          {
            kind: 'draw' as const,
            amount: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
          {
            kind: 'discard-hand' as const,
            count: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          // 補位會把 p1-replacement（hp 2）放到戰鬥區並抽走 2 張牌庫，
          // deck 要留足餘量避免觸發 Refresh 或判負。
          deck: [item('p1-d'), item('p1-d-2'), item('p1-d-3')],
          battleArea: [
            {
              ...base.players['player-one'].battleArea[0],
              card: {
                ...base.players['player-one'].battleArea[0].card,
                skill: undefined,
              },
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          deck: [item('p2-d'), item('p2-d-2')],
          battleArea: [{ ...attacker, card: bs4011 }],
        },
      },
    }

    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)

    expect(afterDamage.pendingAbilityEffect).toMatchObject({
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Chili Pepper Cookie',
      sourceKind: 'skill',
      trigger: 'attacker-faint',
      effectIndex: 0,
      effects: [{ kind: 'draw' }, { kind: 'discard-hand' }],
    })

    // 擊倒後佇列已建立，但本次戰鬥尚未收尾：技能不得在 pendingBattle 期間
    // 結算（補位要等戰鬥收尾後才能建立，技能不能先跑）。
    expect(() =>
      applyGameCommand(afterDamage, {
        kind: 'resolve-ability-effect',
        playerId: 'player-two',
        targetIds: [],
      }),
    ).toThrowError('必須先處理其他待處理的決策。')

    // 完成本次戰鬥剩餘的傷害結算後，原攻擊者效果仍然優先，補位尚未建立。
    while (afterDamage.pendingBattle?.stage === 'damage') {
      afterDamage = resolveNextDamage(afterDamage)
    }
    expect(afterDamage.pendingBattle).toBeNull()
    expect(afterDamage.pendingReplacement).toBeNull()

    const afterDraw = applyGameCommand(afterDamage, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(afterDraw.players['player-two'].hand).toHaveLength(2)
    expect(afterDraw.pendingAbilityEffect?.effectIndex).toBe(1)

    const discardId = afterDraw.players['player-two'].hand[0].instanceId
    const afterDiscardDecision = applyGameCommand(afterDraw, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [discardId],
    })
    expect(afterDiscardDecision.pendingAbilityEffect).toBeUndefined()
    expect(afterDiscardDecision.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
      sourceCardName: 'Chili Pepper Cookie',
    })

    const afterDiscard = applyGameCommand(afterDiscardDecision, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [discardId],
    })
    expect(afterDiscard.players['player-two'].discardPile.map((card) => card.instanceId)).toContain(discardId)
    expect(afterDiscard.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })

    const afterReplacement = applyGameCommand(afterDiscard, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: 'p1-replacement',
    })
    expect(afterReplacement.pendingReplacement).toBeNull()
  })

  it('forces BS4-011 to discard the only card drawn when the hand was empty', () => {
    const base = createFaintState()
    const attacker = base.players['player-two'].battleArea[0]
    const bs4011 = {
      ...attacker.card,
      id: 'BS4-011',
      name: 'Chili Pepper Cookie',
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: "If your opponent's Cookie faints from this Cookie's attack, draw 1 card from your deck and discard 1 card.",
        effects: [
          {
            kind: 'draw' as const,
            amount: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
          {
            kind: 'discard-hand' as const,
            count: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('p1-d'), item('p1-d-2'), item('p1-d-3')],
          battleArea: [
            {
              ...base.players['player-one'].battleArea[0],
              card: {
                ...base.players['player-one'].battleArea[0].card,
                skill: undefined,
              },
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          // 抽 1 張後 deck 必須還有剩，否則會觸發 refresh-unavailable 判負
          deck: [item('p2-only-card'), item('p2-spare')],
          hand: [],
          battleArea: [{ ...attacker, card: bs4011 }],
        },
      },
    }

    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)
    while (afterDamage.pendingBattle?.stage === 'damage') {
      afterDamage = resolveNextDamage(afterDamage)
    }

    expect(afterDamage.pendingReplacement).toBeNull()
    expect(afterDamage.pendingAbilityEffect).toBeDefined()

    const afterDraw = applyGameCommand(afterDamage, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(afterDraw.players['player-two'].hand.map((card) => card.instanceId)).toEqual([
      'p2-only-card',
    ])

    // 抽牌前手牌為空：棄 1 張的強制代價只能落在剛抽到的唯一一張牌上。
    // discard-hand 效果建立強制棄牌決策，少選／重複選／選不存在的牌都會被
    // 規則層拒絕，沒有任何略過路徑。
    const drawnId = 'p2-only-card'
    const afterDiscardDecision = applyGameCommand(afterDraw, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(afterDiscardDecision.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
    })
    expect(() =>
      applyGameCommand(afterDiscardDecision, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-two',
        cardIds: [],
      }),
    ).toThrowError('必須選擇 1 張手牌棄置。')

    const afterResolution = applyGameCommand(afterDiscardDecision, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [drawnId],
    })
    expect(afterResolution.players['player-two'].hand).toHaveLength(0)
    expect(
      afterResolution.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toContain(drawnId)
    expect(afterResolution.pendingAbilityEffect).toBeUndefined()
    expect(afterResolution.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })

    const afterReplacement = applyGameCommand(afterResolution, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: 'p1-replacement',
    })
    expect(afterReplacement.pendingReplacement).toBeNull()
  })

  it('finishes the game with a defeat when the fainted opponent cannot replace, after BS4-011 resolves', () => {
    const base = createFaintState()
    const attacker = base.players['player-two'].battleArea[0]
    const bs4011 = {
      ...attacker.card,
      id: 'BS4-011',
      name: 'Chili Pepper Cookie',
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: "If your opponent's Cookie faints from this Cookie's attack, draw 1 card from your deck and discard 1 card.",
        effects: [
          {
            kind: 'draw' as const,
            amount: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
          {
            kind: 'discard-hand' as const,
            count: 1,
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' as const },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [item('p1-only-item')],
          battleArea: [
            {
              ...base.players['player-one'].battleArea[0],
              card: {
                ...base.players['player-one'].battleArea[0].card,
                skill: undefined,
              },
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          deck: [item('p2-d'), item('p2-d-2')],
          battleArea: [{ ...attacker, card: bs4011 }],
        },
      },
    }

    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)
    while (afterDamage.pendingBattle?.stage === 'damage') {
      afterDamage = resolveNextDamage(afterDamage)
    }

    // 擊倒後對手戰場空缺且手牌沒有餅乾：先完成 BS4-011 的抽牌／棄牌效果，
    // 之後才建立補位任務並判定空場敗北。
    expect(afterDamage.pendingReplacement).toBeNull()
    expect(afterDamage.pendingAbilityEffect).toBeDefined()

    const afterDraw = applyGameCommand(afterDamage, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    const discardId = afterDraw.players['player-two'].hand[0].instanceId
    const afterDiscardDecision = applyGameCommand(afterDraw, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [discardId],
    })
    const afterDiscard = applyGameCommand(afterDiscardDecision, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [discardId],
    })
    expect(afterDiscard.pendingAbilityEffect).toBeUndefined()
    expect(afterDiscard.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })

    const defeated = applyGameCommand(afterDiscard, {
      kind: 'skip-replacement',
      playerId: 'player-one',
    })
    expect(defeated.status).toBe('finished')
    expect(defeated.result).toMatchObject({
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
    expect(defeated.pendingAbilityEffect).toBeUndefined()
  })

  it('resolves BS4-005 targets in the selected order, including FLIP before the next Cookie', () => {
    const base = createFaintState()
    const first = base.players['player-one'].battleArea[0]
    const second = {
      ...first,
      card: {
        ...first.card,
        id: 'second-target',
        instanceId: 'second-target',
        name: 'Second target',
        skill: undefined,
      },
      hpCards: [item('second-target-hp')],
      battleEntryId: 'second-target:battle:2',
    }
    const healingFlip = {
      ...item('first-target-flip'),
      name: 'Healing FLIP',
      flip: {
        text: 'Gain 1 HP.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'gain-hp' as const, amount: 1 }],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('healed-hp')],
          battleArea: [
            { ...first, hpCards: [healingFlip] },
            second,
          ],
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-two' as const,
      sourceInstanceId: 'attacker',
      sourceCardName: 'Fire Spirit Cookie',
    }
    const effect = {
      kind: 'damage-all' as const,
      amount: 1,
      side: 'opponent' as const,
      sequential: true,
      target: { side: 'opponent' as const, min: 1, max: 2 },
    }

    expect(() => executeCardEffect(state, context, effect, ['faint-cookie'])).toThrow(
      'Select every legal damage target exactly once, in resolution order.',
    )

    let afterFirstSelection = executeCardEffect(
      state,
      context,
      effect,
      ['faint-cookie', 'second-target'],
    )
    expect(afterFirstSelection.pendingBattle).toMatchObject({
      stage: 'damage',
      targetInstanceId: 'faint-cookie',
      effectDamageSequence: {
        remainingTargetInstanceIds: ['second-target'],
      },
    })

    afterFirstSelection = resolveNextDamage(afterFirstSelection)
    expect(afterFirstSelection.pendingBattle?.stage).toBe('flip')
    expect(afterFirstSelection.pendingBattle?.targetInstanceId).toBe('faint-cookie')

    const afterFlip = resolveFlip(afterFirstSelection, 'player-one', {
      activate: true,
    })
    expect(afterFlip.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ instanceId: 'faint-cookie' }),
          hpCards: [expect.objectContaining({ instanceId: 'healed-hp' })],
        }),
      ]),
    )
    expect(afterFlip.pendingBattle).toMatchObject({
      stage: 'damage',
      targetInstanceId: 'second-target',
    })

    const completed = resolveNextDamage(afterFlip)
    expect(completed.players['player-one'].battleArea.map((cookie) => cookie.card.instanceId))
      .toContain('faint-cookie')
    expect(completed.players['player-one'].battleArea.map((cookie) => cookie.card.instanceId))
      .not.toContain('second-target')
    expect(completed.pendingBattle).toBeNull()
  })

  it('does not queue BS4-011 when the attacked opponent survives', () => {
    const base = createFaintState()
    const attacker = base.players['player-two'].battleArea[0]
    const target = base.players['player-one'].battleArea[0]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              ...target,
              hpCards: Array.from({ length: 6 }, (_, index) => item(`survivor-hp-${index}`)),
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              ...attacker,
              card: {
                ...attacker.card,
                id: 'BS4-011',
                skill: {
                  trigger: 'passive',
                  oncePerTurn: false,
                  yourTurn: false,
                  restSource: false,
                  cost: { energy: {}, discardHand: 0 },
                  text: 'BS4-011 test skill',
                  effects: [
                    {
                      kind: 'draw',
                      amount: 1,
                      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    }

    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)
    while (afterDamage.pendingBattle?.stage === 'damage') {
      afterDamage = resolveNextDamage(afterDamage)
    }

    expect(afterDamage.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(afterDamage.pendingAbilityEffect).toBeUndefined()
  })

  it('getFaintEffectCandidates returns opponent cookies', () => {
    const state = createFaintState()
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    const afterDamage = resolveNextDamage(battleState)

    const candidates = getFaintEffectCandidates(afterDamage)
    expect(candidates.length).toBe(1)
    expect(candidates[0].card.instanceId).toBe('attacker')
  })

  it('resolves a hand-to-battle faint effect with the selected hand Cookie', () => {
    const effect = {
      kind: 'hand-to-battle' as const,
      amount: 1,
      energyColor: 'yellow' as const,
      energyCost: { yellow: 1 },
      optional: true,
      gainHp: 1,
    }
    const handCookie = {
      ...cookie('yellow-hand'),
      energyColor: 'yellow' as const,
    }
    const base = createFaintState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('p1-hp-1'), item('p1-hp-2'), item('p1-hp-3'), item('p1-hp-4')],
          hand: [handCookie],
          supportArea: [
            { card: item('p1-yellow-energy', 'yellow'), rested: false },
          ],
        },
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          sourceCardName: 'Faint Cookie',
          effect,
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
            sourceCardName: 'Faint Cookie',
          },
        },
      ],
    }

    expect(getFaintEffectMinMax(state, effect)).toEqual({ min: 0, max: 1 })
    expect(getFaintEffectCardCandidates(state).map((card) => card.instanceId)).toEqual([
      'yellow-hand',
    ])
    expect(() => resolveFaintEffect(state, ['yellow-hand'])).toThrow(
      '昏厥效果能量費用',
    )
    const skipped = resolveFaintEffect(state, [])
    expect(skipped.pendingFaintEffects).toBeUndefined()
    expect(skipped.players['player-one'].hand).toHaveLength(1)

    const next = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: ['yellow-hand'],
      paymentIds: ['p1-yellow-energy'],
    })
    const played = next.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'yellow-hand',
    )
    expect(played?.hpCards).toHaveLength(3)
    expect(next.players['player-one'].supportArea[0].rested).toBe(true)
  })

  it('requires and pays the optional energy cost before a faint trash-to-battle effect', () => {
    const effect = {
      kind: 'trash-to-battle' as const,
      amount: 1,
      optional: true,
      energyColor: 'purple' as const,
      energyCost: { purple: 1 },
    }
    const trashCookie = {
      ...cookie('purple-trash-cookie'),
      level: 1,
      hp: 1,
      energyColor: 'purple' as const,
    }
    const base = createFaintState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('p1-hp-1'), item('p1-hp-2'), item('p1-hp-3')],
          supportArea: [
            { card: item('p1-purple-energy', 'purple'), rested: false },
          ],
          discardPile: [trashCookie],
        },
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          sourceCardName: 'Twizzly Gummy Cookie',
          effect,
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
            sourceCardName: 'Twizzly Gummy Cookie',
          },
        },
      ],
    }

    expect(getFaintEffectCardCandidates(state).map((card) => card.instanceId)).toEqual([
      'purple-trash-cookie',
    ])
    expect(() => resolveFaintEffect(state, ['purple-trash-cookie'])).toThrow(
      '昏厥效果能量費用',
    )

    const skipped = resolveFaintEffect(state, [])
    expect(skipped.pendingFaintEffects).toBeUndefined()
    expect(skipped.players['player-one'].supportArea[0].rested).toBe(false)
    expect(skipped.players['player-one'].discardPile).toHaveLength(1)

    const paid = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: ['purple-trash-cookie'],
      paymentIds: ['p1-purple-energy'],
    })
    expect(paid.pendingFaintEffects).toBeUndefined()
    expect(
      paid.players['player-one'].battleArea.some(
        (entry) => entry.card.instanceId === 'purple-trash-cookie',
      ),
    ).toBe(true)
    expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
  })

  it('requires an empty battle area replacement before resolving BS3-029', () => {
    const effect = {
      kind: 'hand-to-battle' as const,
      amount: 1,
      energyColor: 'yellow' as const,
      energyCost: { yellow: 1 },
      optional: true,
      gainHp: 1,
    }
    const base = createFaintState()
    const sourceEntry = base.players['player-one'].battleArea[0]
    const sourceCard = {
      ...sourceEntry.card,
      id: 'BS3-029',
      name: 'Burnt Cheese Cookie',
      skill: { ...sourceEntry.card.skill!, effects: [effect], faint: true },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('replace-hp-1'), item('replace-hp-2'), item('replace-hp-3'), item('replace-hp-4')],
          hand: [cookie('forced-replacement'), { ...cookie('yellow-follow-up'), energyColor: 'yellow' }],
          supportArea: [
            { card: item('yellow-energy', 'yellow'), rested: false },
          ],
          battleArea: [],
          breakArea: [sourceCard],
        },
      },
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: sourceCard.instanceId,
          sourceCardName: sourceCard.name,
          effect,
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: sourceCard.instanceId,
            sourceCardName: sourceCard.name,
          },
        },
      ],
    }

    let next = finalizePendingReplacements(state)
    expect(next.pendingReplacement).toBeNull()

    // 昏厥效果先從手牌登場一張餅乾，完成後才建立離場餅乾的補位任務。
    next = resolveFaintEffect(next, ['yellow-follow-up'], ['yellow-energy'])
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.pendingReplacement?.tasks).toEqual([
      { playerId: 'player-one', remaining: 1 },
    ])
    next = replaceDefeatedCookie(next, 'forced-replacement')
    expect(next.pendingReplacement).toBeNull()
    expect(next.players['player-one'].battleArea.map((entry) => entry.card.instanceId)).toEqual([
      'yellow-follow-up',
      'forced-replacement',
    ])
  })

  it('resolveFaintEffect damages selected target', () => {
    const state = createFaintState()
    state.players['player-one'].deck = [
      item('p1-replace-hp-1'),
      item('p1-replace-hp-2'),
      item('p1-replace-hp-3'),
      item('p1-replace-hp-4'),
    ]
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [item('p2-hp-a'), item('p2-hp-b')],
    }
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)

    afterDamage = resolveFaintEffect(afterDamage, ['attacker'])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
    expect(afterDamage.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    const replaced = replaceDefeatedCookie(afterDamage, 'p1-replacement')
    expect(replaced.pendingReplacement).toBeNull()
  })

  it('resolveFaintEffect skips when targets empty (up to 1 → 0)', () => {
    const state = createFaintState()
    state.players['player-one'].deck = [
      item('p1-replace-hp-1'),
      item('p1-replace-hp-2'),
      item('p1-replace-hp-3'),
      item('p1-replace-hp-4'),
    ]
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)

    afterDamage = resolveFaintEffect(afterDamage, [])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
    expect(afterDamage.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    const replaced = replaceDefeatedCookie(afterDamage, 'p1-replacement')
    expect(replaced.pendingReplacement).toBeNull()
  })

  it('preserves the faint source name for deferred draw effects', () => {
    const base = createFaintState()
    const faintCard = base.players['player-one'].battleArea[0].card
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [],
          breakArea: [faintCard],
        },
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: faintCard.instanceId,
          sourceCardName: faintCard.name,
          effect: { kind: 'draw-up-to', max: 2 },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: faintCard.instanceId,
          },
        },
      ],
    }

    const resolved = resolveFaintEffect(state, [])
    expect(resolved.pendingDrawUpTo).toMatchObject({
      max: 2,
      sourceCardName: faintCard.name,
    })
  })

  it('requires and resolves a faint-triggered hand discard before the target effect', () => {
    const base = createFaintState()
    const costCard = item('red-item-cost', 'red')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [costCard],
          breakArea: [base.players['player-one'].battleArea[0].card],
          battleArea: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              ...base.players['player-two'].battleArea[0],
              hpCards: [item('target-hp-a'), item('target-hp-b')],
            },
          ],
        },
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          sourceCardName: 'Faint Cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
          },
          cost: {
            discardHand: 1,
            discardHandColor: 'red',
            discardHandType: 'item',
          },
        },
      ],
    }

    const skipped = resolveFaintEffect(state, ['attacker'])
    expect(skipped.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(skipped.players['player-one'].hand).toHaveLength(1)

    const resolved = resolveFaintEffect(
      state,
      ['attacker'],
      [],
      { discardHandIds: [costCard.instanceId] },
    )
    expect(resolved.players['player-one'].hand).toHaveLength(0)
    expect(
      resolved.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toContain(costCard.instanceId)
    expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('faint triggered by effect damage also queues', () => {
    const state = createFaintState()
    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      ['faint-cookie'],
    )

    expect(result.pendingFaintEffects).toBeDefined()
    expect(result.pendingFaintEffects!.length).toBeGreaterThanOrEqual(1)
  })

  it('does not queue a faint effect whose condition is false at faint time', () => {
    const state = createFaintState()
    const faintCookie = state.players['player-one'].battleArea[0]
    state.players['player-one'].battleArea[0] = {
      ...faintCookie,
      card: {
        ...faintCookie.card,
        skill: {
          ...faintCookie.card.skill!,
          effects: [
            {
              kind: 'damage-all',
              amount: 1,
              side: 'opponent',
              condition: { kind: 'support-count-at-least', count: 5 },
            },
          ],
        },
      },
    }

    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    const afterDamage = resolveNextDamage(battleState)

    expect(afterDamage.pendingFaintEffects).toBeUndefined()
  })

  it('faint respects missing candidates (empty opponent battle area)', () => {
    let state = createFaintState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [],
        },
      },
    }
    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'effect-source' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      ['faint-cookie'],
    )

    expect(result.pendingFaintEffects ?? []).toHaveLength(0)
  })

  it('resolves faint effects before creating the replacement decision', () => {
    // Arrange: 直接建立一個有 pendingFaintEffects 的遊戲狀態
    const faintCookie: CookieCard = {
      id: 'faint-cookie',
      instanceId: 'faint-cookie',
      name: 'Faint Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 2,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }

    let state: GameState = {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('hp-a'), item('hp-b'), item('hp-c'), item('hp-d')],
          hand: [cookie('p1-replacement')],
          battleArea: [],
          supportArea: [],
          breakArea: [faintCookie],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: 'P2',
          deck: [item('p2-d')],
          hand: [],
          battleArea: [
            {
              card: cookie('p2-attacker'),
              hpCards: [item('p2-hp')],
              rested: false,
            },
          ],
          supportArea: [],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
      },
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      turnNumber: 2,
      phase: 'main',
      status: 'playing',
      result: null,
      supportPlacedThisTurn: false,
      skillUsesThisTurn: [],
      nextBattleEntrySequence: 1,
      attackModifiers: [],
      damageReceivedModifiers: [],
      pendingReplacement: null,
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingRefresh: null,
      pendingBattle: null,
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          sourceCardName: 'Faint Cookie',
          effect: faintCookie.skill!.effects[0],
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
            sourceCardName: 'Faint Cookie',
          },
        },
      ],
    }

    // Act: 觸發補位流程；昏厥效果尚未完成，因此不建立補位。
    state = finalizePendingReplacements(state)

    expect(state.pendingReplacement).toBeNull()

    // Act: 先結算昏厥效果，再建立補位任務。
    expect(state.pendingFaintEffects).toBeDefined()
    expect(state.pendingFaintEffects!.length).toBe(1)
    state = resolveFaintEffect(state, [])
    expect(state.pendingReplacement?.tasks).toEqual([
      { playerId: 'player-one', remaining: 1 },
    ])

    // Act: 效果完成後執行補位。
    state = replaceDefeatedCookie(state, 'p1-replacement')

    // Assert: 餅乾已放入戰鬥區
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].battleArea[0].card.instanceId).toBe('p1-replacement')
    expect(state.pendingReplacement).toBeNull()

    expect(state.pendingFaintEffects).toBeUndefined()
  })

  it('allows skipping replacement after faint effects finish', () => {
    const faintCookie: CookieCard = {
      id: 'faint-cookie',
      instanceId: 'faint-cookie',
      name: 'Faint Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 2,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }

    let state: GameState = {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('hp-a')],
          hand: [cookie('p1-replacement')],
          battleArea: [
            {
              card: cookie('p1-existing'),
              hpCards: [item('p1-hp')],
              rested: false,
            },
          ],
          supportArea: [],
          breakArea: [faintCookie],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: 'P2',
          deck: [],
          hand: [],
          battleArea: [],
          supportArea: [],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
      },
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      turnNumber: 2,
      phase: 'main',
      status: 'playing',
      result: null,
      supportPlacedThisTurn: false,
      skillUsesThisTurn: [],
      nextBattleEntrySequence: 1,
      attackModifiers: [],
      damageReceivedModifiers: [],
      pendingReplacement: null,
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingRefresh: null,
      pendingBattle: null,
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          sourceCardName: 'Faint Cookie',
          effect: faintCookie.skill!.effects[0],
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
            sourceCardName: 'Faint Cookie',
          },
        },
      ],
    }

    // Act: 昏厥效果尚未完成時，不建立補位。
    state = finalizePendingReplacements(state)

    expect(state.pendingReplacement).toBeNull()

    state = resolveFaintEffect(state, [])
    expect(state.pendingReplacement).toBeDefined()

    // Act: 跳過補位
    state = skipDefeatedCookieReplacement(state)

    // Assert: 補位已略過
    expect(state.pendingReplacement).toBeNull()

    expect(state.pendingFaintEffects).toBeUndefined()
  })

  // 迴歸測試：UI 走 applyGameCommand（會經過 assertNoPendingDecision），
  // 昏厥效果完成前不得補位；效果結算後才接受補位／略過補位指令。
  describe('replacement command dispatch after faint effect resolution', () => {
    const faintCookie: CookieCard = {
      id: 'faint-cookie',
      instanceId: 'faint-cookie',
      name: 'Faint Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 2,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'When this Cookie faints, deal 1 damage to an opponent Cookie.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }

    const createPendingState = (
      { withExistingCookie = false } = {},
    ): GameState =>
      finalizePendingReplacements({
        players: {
          'player-one': {
            id: 'player-one',
            name: 'P1',
            deck: [item('hp-a'), item('hp-b'), item('hp-c'), item('hp-d')],
            hand: [cookie('p1-replacement')],
            // 保留一隻既有餅乾時，略過補位不會因戰鬥區清空而判負
            battleArea: withExistingCookie
              ? [
                  {
                    card: cookie('p1-existing'),
                    hpCards: [item('p1-existing-hp')],
                    rested: false,
                  },
                ]
              : [],
            supportArea: [],
            breakArea: [faintCookie],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
          'player-two': {
            id: 'player-two',
            name: 'P2',
            deck: [item('p2-d')],
            hand: [],
            battleArea: [
              {
                card: cookie('p2-attacker'),
                hpCards: [item('p2-hp')],
                rested: false,
              },
            ],
            supportArea: [],
            breakArea: [],
            discardPile: [],
            stage: null,
            hasMulliganed: false,
            startingCookieSelected: true,
          },
        },
        firstPlayerId: 'player-two',
        activePlayerId: 'player-two',
        turnNumber: 2,
        phase: 'main',
        status: 'playing',
        result: null,
        supportPlacedThisTurn: false,
        skillUsesThisTurn: [],
        nextBattleEntrySequence: 1,
        attackModifiers: [],
        damageReceivedModifiers: [],
        pendingReplacement: null,
        departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
        pendingRefresh: null,
        pendingBattle: null,
        pendingFaintEffects: [
          {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
            sourceCardName: 'Faint Cookie',
            effect: faintCookie.skill!.effects[0],
            context: {
              sourcePlayerId: 'player-one',
              sourceInstanceId: 'faint-cookie',
              sourceCardName: 'Faint Cookie',
            },
          },
        ],
      })

    it('replace-cookie command succeeds after the faint effect completes', () => {
      const state = createPendingState()
      expect(state.pendingReplacement).toBeNull()
      expect(state.pendingFaintEffects!.length).toBe(1)
      expect(() =>
        applyGameCommand(state, {
          kind: 'replace-cookie',
          playerId: 'player-one',
          instanceId: 'p1-replacement',
        }),
      ).toThrowError('必須先處理待處理的決策。')

      const afterFaint = applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId: 'player-one',
        targetIds: [],
      })
      expect(afterFaint.pendingReplacement?.tasks).toEqual([
        { playerId: 'player-one', remaining: 1 },
      ])

      const next = applyGameCommand(afterFaint, {
        kind: 'replace-cookie',
        playerId: 'player-one',
        instanceId: 'p1-replacement',
      })

      expect(next.players['player-one'].battleArea).toHaveLength(1)
      expect(next.players['player-one'].battleArea[0].card.instanceId).toBe(
        'p1-replacement',
      )
      expect(next.pendingReplacement).toBeNull()
      expect(next.pendingFaintEffects).toBeUndefined()
    })

    it('skip-replacement command succeeds after faint effect completion', () => {
      const state = createPendingState({ withExistingCookie: true })
      expect(state.pendingReplacement).toBeNull()

      const afterFaint = applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId: 'player-one',
        targetIds: [],
      })

      const next = applyGameCommand(afterFaint, {
        kind: 'skip-replacement',
        playerId: 'player-one',
      })

      expect(next.status).toBe('playing')
      expect(next.pendingReplacement).toBeNull()
      expect(next.pendingFaintEffects).toBeUndefined()
    })

    it('still blocks non-replacement actions while a faint effect is pending', () => {
      const state = createPendingState()
      expect(() =>
        applyGameCommand(state, {
          kind: 'advance-phase',
          playerId: 'player-two',
        }),
      ).toThrowError('必須先處理待處理的決策。')
    })
  })
})
