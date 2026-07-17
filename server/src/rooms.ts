import { randomInt } from 'node:crypto'
import {
  GameRuleError,
  applyGameCommand,
  createDeckFromCustomDeck,
  createGame,
  createSeededShuffle,
  maskGameStateForViewer,
  validateCustomDeck,
  type CustomDeck,
  type GameCard,
  type GameCommand,
  type GameState,
  type PlayerId,
} from '../../src/game'
import {
  isValidOnlinePlayerName,
  type PublicCardReference,
  type PublicIntent,
  type PublicIntentDraft,
  type OnlineOpeningAction,
  type OnlineOpeningRpsResult,
  type OnlineOpeningSnapshot,
  type OnlineOpeningStage,
  type RpsChoice,
} from '../../src/net/onlineProtocol'

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 4

/** 公開決策提示的伺服器權威倒數；不直接替玩家自動選擇，只提供同步期限。 */
export const PUBLIC_INTENT_DEADLINE_MS = 45_000

export interface RoomSlot {
  playerId: PlayerId
  playerName: string
  deck: CustomDeck
  send: (data: string) => void
}

export type RoomStatus = 'waiting' | 'opening' | 'in-progress' | 'ended'

interface RoomOpeningState {
  stage: OnlineOpeningStage
  round: number
  actorId: PlayerId | null
  firstPlayerId: PlayerId | null
  rpsChoices: Partial<Record<PlayerId, RpsChoice>>
  rpsResult: OnlineOpeningRpsResult | null
  revealedNoCookieHand: GameCard[]
  forcedPlayerId: PlayerId | null
  startingCookieSelections: Partial<Record<PlayerId, string>>
}

export interface Room {
  code: string
  status: RoomStatus
  playerOne: RoomSlot
  playerTwo: RoomSlot | null
  state: GameState | null
  seed: number | null
  opening: RoomOpeningState | null
  publicIntents: Partial<Record<PlayerId, PublicIntent>>
  publicIntentSequences: Record<PlayerId, number>
}

export class RoomNotFoundError extends Error {}
export class RoomNotJoinableError extends Error {}

export class RoomStore {
  private rooms = new Map<string, Room>()

  private generateCode(): string {
    let code: string
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
      ).join('')
    } while (this.rooms.has(code))
    return code
  }

  createRoom(
    deck: CustomDeck,
    send: (data: string) => void,
    playerName = 'Player One',
  ): Room {
    const validation = validateCustomDeck(deck.entries)
    if (!validation.isValid) {
      throw new GameRuleError(validation.errors[0] ?? '牌組不合法。')
    }
    if (!isValidOnlinePlayerName(playerName)) {
      throw new GameRuleError('玩家名稱必須為 1 至 20 個字元。')
    }

    const code = this.generateCode()
    const room: Room = {
      code,
      status: 'waiting',
      playerOne: {
        playerId: 'player-one',
        playerName: playerName.trim(),
        deck,
        send,
      },
      playerTwo: null,
      state: null,
      seed: null,
      opening: null,
      publicIntents: {},
      publicIntentSequences: {
        'player-one': 0,
        'player-two': 0,
      },
    }
    this.rooms.set(code, room)
    return room
  }

  joinRoom(
    code: string,
    deck: CustomDeck,
    send: (data: string) => void,
    seed: number = Date.now(),
    playerName = 'Player Two',
  ): Room {
    const room = this.rooms.get(code)
    if (!room) {
      throw new RoomNotFoundError('找不到這個房間代碼。')
    }
    if (room.status !== 'waiting') {
      throw new RoomNotJoinableError('這個房間已經無法加入。')
    }

    const validation = validateCustomDeck(deck.entries)
    if (!validation.isValid) {
      throw new GameRuleError(validation.errors[0] ?? '牌組不合法。')
    }
    if (!isValidOnlinePlayerName(playerName)) {
      throw new GameRuleError('玩家名稱必須為 1 至 20 個字元。')
    }

    room.playerTwo = {
      playerId: 'player-two',
      playerName: playerName.trim(),
      deck,
      send,
    }
    room.status = 'opening'
    room.seed = seed
    room.opening = {
      stage: 'rps',
      round: 1,
      actorId: null,
      firstPlayerId: null,
      rpsChoices: {},
      rpsResult: null,
      revealedNoCookieHand: [],
      forcedPlayerId: null,
      startingCookieSelections: {},
    }

    return room
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code)
  }

  private createOpeningGame(room: Room, firstPlayerId: PlayerId): void {
    if (!room.playerTwo || room.seed === null || !room.opening) {
      throw new GameRuleError('開局資料不完整。')
    }

    const shuffle = createSeededShuffle(room.seed)
    room.state = createGame(
      {
        id: 'player-one',
        name: room.playerOne.playerName,
        deck: createDeckFromCustomDeck(room.playerOne.deck, 'player-one'),
      },
      {
        id: 'player-two',
        name: room.playerTwo.playerName,
        deck: createDeckFromCustomDeck(room.playerTwo.deck, 'player-two'),
      },
      firstPlayerId,
      shuffle,
    )
    room.opening.firstPlayerId = firstPlayerId
    room.opening.stage = 'mulligan'
    room.opening.actorId = firstPlayerId
    room.opening.rpsChoices = {}
    room.opening.revealedNoCookieHand = []
  }

  private submitRpsChoice(
    room: Room,
    playerId: PlayerId,
    choice: RpsChoice,
  ): void {
    const opening = room.opening!
    if (opening.stage !== 'rps') {
      throw new GameRuleError('目前不是猜拳階段。')
    }
    if (opening.rpsChoices[playerId]) {
      throw new GameRuleError('本輪猜拳已送出，請等待對手。')
    }

    if (Object.keys(opening.rpsChoices).length === 0) {
      opening.rpsResult = null
    }
    opening.rpsChoices[playerId] = choice

    const playerOneChoice = opening.rpsChoices['player-one']
    const playerTwoChoice = opening.rpsChoices['player-two']
    if (!playerOneChoice || !playerTwoChoice) return

    const playerOneWins =
      (playerOneChoice === 'rock' && playerTwoChoice === 'scissors') ||
      (playerOneChoice === 'paper' && playerTwoChoice === 'rock') ||
      (playerOneChoice === 'scissors' && playerTwoChoice === 'paper')
    const winnerId =
      playerOneChoice === playerTwoChoice
        ? null
        : playerOneWins
          ? 'player-one'
          : 'player-two'

    opening.rpsResult = {
      choices: {
        'player-one': playerOneChoice,
        'player-two': playerTwoChoice,
      },
      winnerId,
    }

    if (winnerId === null) {
      opening.round += 1
      opening.rpsChoices = {}
      return
    }

    opening.stage = 'choose-order'
    opening.actorId = winnerId
  }

  private submitTurnOrder(
    room: Room,
    playerId: PlayerId,
    goFirst: boolean,
  ): void {
    const opening = room.opening!
    if (opening.stage !== 'choose-order' || opening.actorId !== playerId) {
      throw new GameRuleError('只有猜拳勝者可以選擇先攻或後攻。')
    }
    const firstPlayerId = goFirst ? playerId : opponentOf(playerId)
    this.createOpeningGame(room, firstPlayerId)
  }

  private submitMulligan(
    room: Room,
    playerId: PlayerId,
    replaceAll: boolean,
  ): void {
    const opening = room.opening!
    const state = room.state!
    if (opening.stage !== 'mulligan' || opening.actorId !== playerId) {
      throw new GameRuleError('請等待目前的調度玩家完成決定。')
    }

    room.state = applyGameCommand(state, {
      kind: replaceAll ? 'mulligan-opening-hand' : 'keep-opening-hand',
      playerId,
    })

    if (!room.state.players[playerId].hand.some((card) => card.type === 'cookie')) {
      opening.stage = 'forced-mulligan'
      opening.actorId = playerId
      return
    }

    const firstPlayerId = opening.firstPlayerId!
    const secondPlayerId = opponentOf(firstPlayerId)
    if (playerId === firstPlayerId) {
      opening.actorId = secondPlayerId
      return
    }

    opening.stage = 'starting-cookie'
    opening.actorId = null
  }

  private submitForcedMulligan(room: Room, playerId: PlayerId): void {
    const opening = room.opening!
    const state = room.state!
    if (opening.stage !== 'forced-mulligan' || opening.actorId !== playerId) {
      throw new GameRuleError('目前不需要由此玩家強制調度。')
    }

    opening.revealedNoCookieHand = [...state.players[playerId].hand]
    opening.forcedPlayerId = playerId
    room.state = applyGameCommand(state, {
      kind: 'force-mulligan-opening-hand',
      playerId,
    })
    opening.stage = 'compensation'
    opening.actorId = opponentOf(playerId)
  }

  private submitMulliganCompensation(
    room: Room,
    playerId: PlayerId,
    draw: boolean,
  ): void {
    const opening = room.opening!
    if (opening.stage !== 'compensation' || opening.actorId !== playerId) {
      throw new GameRuleError('目前沒有可決定的調度補償。')
    }
    const forcedPlayerId = opening.forcedPlayerId
    if (!forcedPlayerId || !room.state) {
      throw new GameRuleError('強制調度資料不完整。')
    }

    if (draw) {
      room.state = applyGameCommand(room.state, {
        kind: 'draw-mulligan-compensation',
        playerId,
      })
    }

    opening.revealedNoCookieHand = []
    opening.forcedPlayerId = null
    if (
      !room.state.players[forcedPlayerId].hand.some(
        (card) => card.type === 'cookie',
      )
    ) {
      opening.stage = 'forced-mulligan'
      opening.actorId = forcedPlayerId
      return
    }

    const firstPlayerId = opening.firstPlayerId!
    const secondPlayerId = opponentOf(firstPlayerId)
    if (!room.state.players[secondPlayerId].freeMulliganDecided) {
      opening.stage = 'mulligan'
      opening.actorId = secondPlayerId
      return
    }

    opening.stage = 'starting-cookie'
    opening.actorId = null
  }

  private submitStartingCookie(
    room: Room,
    playerId: PlayerId,
    instanceId: string,
  ): void {
    const opening = room.opening!
    const state = room.state!
    if (opening.stage !== 'starting-cookie') {
      throw new GameRuleError('目前不是選擇起始餅乾的階段。')
    }
    if (opening.startingCookieSelections[playerId]) {
      throw new GameRuleError('已完成起始餅乾選擇。')
    }
    const card = state.players[playerId].hand.find(
      (candidate) => candidate.instanceId === instanceId,
    )
    if (!card || card.type !== 'cookie') {
      throw new GameRuleError('起始卡牌必須是手牌中的餅乾卡。')
    }

    opening.startingCookieSelections[playerId] = instanceId
    const playerOneSelection = opening.startingCookieSelections['player-one']
    const playerTwoSelection = opening.startingCookieSelections['player-two']
    if (!playerOneSelection || !playerTwoSelection) return

    let nextState = applyGameCommand(state, {
      kind: 'select-starting-cookie',
      playerId: 'player-one',
      instanceId: playerOneSelection,
    })
    nextState = applyGameCommand(nextState, {
      kind: 'select-starting-cookie',
      playerId: 'player-two',
      instanceId: playerTwoSelection,
    })
    room.state = nextState
    room.status = 'in-progress'
    room.opening = null
  }

  submitOpeningAction(
    room: Room,
    playerId: PlayerId,
    action: OnlineOpeningAction,
  ): void {
    if (room.status !== 'opening' || !room.opening) {
      throw new GameRuleError('目前沒有進行中的開局流程。')
    }

    switch (action.kind) {
      case 'rps':
        this.submitRpsChoice(room, playerId, action.choice)
        return
      case 'choose-order':
        this.submitTurnOrder(room, playerId, action.goFirst)
        return
      case 'mulligan':
        this.submitMulligan(room, playerId, action.replaceAll)
        return
      case 'force-mulligan':
        this.submitForcedMulligan(room, playerId)
        return
      case 'mulligan-compensation':
        this.submitMulliganCompensation(room, playerId, action.draw)
        return
      case 'starting-cookie':
        this.submitStartingCookie(room, playerId, action.instanceId)
    }
  }

  /**
   * 驗證指令聲稱的玩家與送出來源(這個 socket 被指派的玩家身分)相符,
   * 再委派給 applyGameCommand。回合/待處理決策等玩家資格驗證已經是
   * applyGameCommand 每個指令 case 自己的職責(例如 advance-phase/attack
   * 有 requireActivePlayer,補位/傷害結算有各自的驗證),這裡不重複判斷,
   * 否則會誤擋 keep-opening-hand 這類雙方各自獨立行動的開局指令。
   */
  applyCommand(room: Room, playerId: PlayerId, command: GameCommand): GameState {
    if (room.status !== 'in-progress' || !room.state) {
      throw new GameRuleError('對局尚未開始。')
    }
    if (command.playerId !== playerId) {
      throw new GameRuleError('指令的玩家與送出來源不符。')
    }
    const nextState = applyGameCommand(room.state, command)
    room.state = nextState
    return nextState
  }

  setPublicIntent(
    room: Room,
    playerId: PlayerId,
    draft: PublicIntentDraft,
  ): PublicIntent {
    const sequence = (room.publicIntentSequences[playerId] ?? 0) + 1
    room.publicIntentSequences[playerId] = sequence

    const source = draft.sourceInstanceId
      ? publicCardReferenceFor(room, playerId, draft.sourceInstanceId)
      : undefined
    const previous = room.publicIntents[playerId]
    const sameDecisionStage =
      previous?.type === draft.type &&
      previous.source?.instanceId === source?.instanceId
    const expiresAt =
      draft.type === 'resolving'
        ? undefined
        : sameDecisionStage && previous.expiresAt
          ? previous.expiresAt
          : new Date(Date.now() + PUBLIC_INTENT_DEADLINE_MS).toISOString()
    const actorSource = source?.ownerId === playerId ? source : undefined
    const highlightedTargetInstanceIds = draft.highlightedTargetInstanceIds
      ? [...
          new Set(
            draft.highlightedTargetInstanceIds.filter((instanceId) =>
              publicCardReferenceFor(room, playerId, instanceId),
            ),
          )]
      : undefined
    const safeDraft = { ...draft } as Record<string, unknown>
    delete safeDraft.sourceInstanceId
    delete safeDraft.highlightedTargetInstanceIds
    delete safeDraft.source
    delete safeDraft.intentId
    delete safeDraft.actorId
    delete safeDraft.sequence
    delete safeDraft.stateVersion
    delete safeDraft.updatedAt
    delete safeDraft.expiresAt

    const intent = {
      ...safeDraft,
      intentId: `${playerId}-${sequence}`,
      actorId: playerId,
      sequence,
      stateVersion: stateVersionFor(room),
      updatedAt: new Date().toISOString(),
      ...(actorSource ? { source: actorSource } : {}),
      ...(highlightedTargetInstanceIds?.length
        ? { highlightedTargetInstanceIds }
        : {}),
      ...(expiresAt ? { expiresAt } : {}),
    } as PublicIntent

    room.publicIntents[playerId] = intent
    return intent
  }

  clearPublicIntent(
    room: Room,
    playerId: PlayerId,
    intentId?: string,
  ): boolean {
    const current = room.publicIntents[playerId]
    if (!current || (intentId && current.intentId !== intentId)) return false

    delete room.publicIntents[playerId]
    room.publicIntentSequences[playerId] =
      (room.publicIntentSequences[playerId] ?? current.sequence) + 1
    return true
  }
}

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export const createRoomStore = (): RoomStore => new RoomStore()

export const maskedStateFor = (
  room: Room,
  playerId: PlayerId,
): GameState | null => {
  if (!room.state) return null
  return maskGameStateForViewer(room.state, playerId)
}

export const stateVersionFor = (room: Room): number =>
  room.state?.commandLog?.length ?? 0

const publicCardsFor = (room: Room): Array<{
  card: GameCard
  ownerId: PlayerId
}> => {
  if (!room.state) return []

  return (['player-one', 'player-two'] as const).flatMap((ownerId) => {
    const player = room.state!.players[ownerId]
    return [
      ...player.battleArea.map(({ card }) => ({ card, ownerId })),
      ...player.supportArea.map(({ card }) => ({ card, ownerId })),
      ...player.breakArea.map((card) => ({ card, ownerId })),
      ...player.discardPile.map((card) => ({ card, ownerId })),
      ...(player.stage ? [{ card: player.stage.card, ownerId }] : []),
    ]
  })
}

export const publicCardReferenceFor = (
  room: Room,
  _viewerId: PlayerId,
  instanceId: string,
): PublicCardReference | undefined => {
  const entry = publicCardsFor(room).find(
    ({ card }) => card.instanceId === instanceId,
  )
  if (!entry) return undefined

  return {
    instanceId: entry.card.instanceId,
    id: entry.card.id,
    name: entry.card.name,
    type: entry.card.type,
    ownerId: entry.ownerId,
  }
}

export const publicIntentFor = (
  room: Room,
  playerId: PlayerId,
): PublicIntent | null => room.publicIntents[playerId] ?? null

export const publicIntentSequenceFor = (
  room: Room,
  playerId: PlayerId,
): number => room.publicIntentSequences[playerId] ?? 0

export const openingSnapshotFor = (
  room: Room,
  _viewerId: PlayerId,
): OnlineOpeningSnapshot | null => {
  const opening = room.opening
  if (!opening || !room.playerTwo) return null

  const progressFor = (playerId: PlayerId): boolean => {
    switch (opening.stage) {
      case 'rps':
        return Boolean(opening.rpsChoices[playerId])
      case 'mulligan':
        return Boolean(room.state?.players[playerId].freeMulliganDecided)
      case 'starting-cookie':
        return Boolean(opening.startingCookieSelections[playerId])
      default:
        return opening.actorId !== playerId
    }
  }

  return {
    stage: opening.stage,
    round: opening.round,
    actorId: opening.actorId,
    firstPlayerId: opening.firstPlayerId,
    players: {
      'player-one': {
        name: room.playerOne.playerName,
        submitted: progressFor('player-one'),
      },
      'player-two': {
        name: room.playerTwo.playerName,
        submitted: progressFor('player-two'),
      },
    },
    rpsResult: opening.rpsResult,
    revealedNoCookieHand: [...opening.revealedNoCookieHand],
  }
}
