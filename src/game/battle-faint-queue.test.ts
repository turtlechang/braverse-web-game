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

    expect(getFaintEffectMinMax(effect)).toEqual({ min: 0, max: 1 })
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
    expect(next.pendingReplacement?.tasks).toEqual([
      { playerId: 'player-one', remaining: 1 },
    ])
    expect(() => skipDefeatedCookieReplacement(next)).toThrow(
      '戰鬥區沒有餅乾時必須先補位',
    )
    expect(() =>
      resolveFaintEffect(next, ['yellow-follow-up'], ['yellow-energy']),
    ).toThrow('必須先完成補位')
    next = replaceDefeatedCookie(next, 'forced-replacement')
    expect(next.pendingReplacement).toBeNull()
    expect(next.pendingFaintEffects).toHaveLength(1)

    next = resolveFaintEffect(
      next,
      ['yellow-follow-up'],
      ['yellow-energy'],
    )
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players['player-one'].battleArea.map((entry) => entry.card.instanceId)).toEqual([
      'forced-replacement',
      'yellow-follow-up',
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
    afterDamage = replaceDefeatedCookie(afterDamage, 'p1-replacement')

    afterDamage = resolveFaintEffect(afterDamage, ['attacker'])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
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
    afterDamage = replaceDefeatedCookie(afterDamage, 'p1-replacement')

    afterDamage = resolveFaintEffect(afterDamage, [])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
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

  it('allows replacement before resolving faint effects', () => {
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

    // Act: 觸發補位流程
    state = finalizePendingReplacements(state)

    // Assert: 補位任務應該被建立（即使有 pendingFaintEffects）
    expect(state.pendingReplacement).toBeDefined()
    expect(state.pendingReplacement!.tasks).toEqual([
      { playerId: 'player-one', remaining: 1 },
    ])

    // Act: 執行補位 - 選擇手牌餅乾放入戰鬥區
    expect(state.pendingFaintEffects).toBeDefined()
    expect(state.pendingFaintEffects!.length).toBe(1)
    state = replaceDefeatedCookie(state, 'p1-replacement')

    // Assert: 餅乾已放入戰鬥區
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].battleArea[0].card.instanceId).toBe('p1-replacement')
    expect(state.pendingReplacement).toBeNull()

    // Assert: 昏厥效果仍然存在，留待後續處理
    expect(state.pendingFaintEffects).toBeDefined()
    expect(state.pendingFaintEffects!.length).toBe(1)
    expect(state.pendingFaintEffects![0].sourceInstanceId).toBe('faint-cookie')
  })

  it('allows skipping replacement when pendingFaintEffects exist', () => {
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

    // Act: 觸發補位流程
    state = finalizePendingReplacements(state)

    // Assert: 補位任務已建立
    expect(state.pendingReplacement).toBeDefined()

    // Act: 跳過補位
    state = skipDefeatedCookieReplacement(state)

    // Assert: 補位已略過
    expect(state.pendingReplacement).toBeNull()

    // Assert: 昏厥效果仍然存在
    expect(state.pendingFaintEffects).toBeDefined()
    expect(state.pendingFaintEffects!.length).toBe(1)
  })

  // 迴歸測試：UI 走 applyGameCommand（會經過 assertNoPendingDecision），
  // 必須允許在昏厥效果待處理時補位／略過補位，否則會出現「無法補位」死結
  // （對方回合我方餅乾被打死，補位視窗顯示卻點不動）。
  describe('replacement command dispatch while faint effect pending', () => {
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

    it('replace-cookie command succeeds while a faint effect is pending', () => {
      const state = createPendingState()
      expect(state.pendingReplacement?.tasks).toEqual([
        { playerId: 'player-one', remaining: 1 },
      ])
      expect(state.pendingFaintEffects!.length).toBe(1)

      const next = applyGameCommand(state, {
        kind: 'replace-cookie',
        playerId: 'player-one',
        instanceId: 'p1-replacement',
      })

      expect(next.players['player-one'].battleArea).toHaveLength(1)
      expect(next.players['player-one'].battleArea[0].card.instanceId).toBe(
        'p1-replacement',
      )
      expect(next.pendingReplacement).toBeNull()
      // 昏厥效果留待補位後處理
      expect(next.pendingFaintEffects!.length).toBe(1)
    })

    it('skip-replacement command succeeds while a faint effect is pending', () => {
      const state = createPendingState({ withExistingCookie: true })

      const next = applyGameCommand(state, {
        kind: 'skip-replacement',
        playerId: 'player-one',
      })

      expect(next.status).toBe('playing')
      expect(next.pendingReplacement).toBeNull()
      // 昏厥效果留待略過補位後處理
      expect(next.pendingFaintEffects!.length).toBe(1)
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
