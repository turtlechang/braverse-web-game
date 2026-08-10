import type {
  CardType,
  CustomDeck,
  GameCard,
  GameCommand,
  GameState,
  PlayerId,
} from '../game'

export interface AttackSelectionPreview {
  attackerInstanceId: string | null
  supportPaymentIds: string[]
}

/**
 * 公開給對手看的互動範圍。只允許描述公開區域，避免把手牌／牌庫內容
 * 當成即時提示傳出去。
 */
export type PublicTargetScope =
  | 'opponent-battle-cookie'
  | 'own-battle-cookie'
  | 'support'
  | 'break'
  | 'discard'
  | 'hand'
  | 'deck'
  | 'stage'
  | 'public-card'

export type PublicIntentStepState = 'done' | 'active' | 'pending'

export type PublicIntentProgressKey =
  | 'declare'
  | 'payment'
  | 'cost'
  | 'target'
  | 'resolve'

export interface PublicIntentProgressStep {
  key: PublicIntentProgressKey
  label: string
  state: PublicIntentStepState
}

export interface PublicCardReference {
  instanceId: string
  id: string
  name: string
  type: CardType
  ownerId: PlayerId
}

export type PublicResponseType = 'trap' | 'flip' | 'effect'

interface PublicIntentCommon {
  intentId: string
  actorId: PlayerId
  sequence: number
  stateVersion: number
  updatedAt: string
  expiresAt?: string
  source?: PublicCardReference
  highlightedTargetInstanceIds?: string[]
  progress?: PublicIntentProgressStep[]
}

export type PublicIntent =
  | (PublicIntentCommon & {
      type: 'selecting-payment'
      requiredCount: number
      selectedCount: number
    })
  | (PublicIntentCommon & {
      type: 'selecting-hidden-cost'
      requiredCount: number
      selectedCount: number
      publicDescription: string
    })
  | (PublicIntentCommon & {
      type: 'selecting-target'
      targetScope: PublicTargetScope
      requiredCount: number
      selectedCount: number
    })
  | (PublicIntentCommon & {
      type: 'awaiting-response'
      responderId: PlayerId
      responseType: PublicResponseType
    })
  | (PublicIntentCommon & {
      type: 'resolving'
      resolutionLabel?: string
    })

type PublicIntentDraftCommon = Omit<
  PublicIntentCommon,
  | 'intentId'
  | 'actorId'
  | 'sequence'
  | 'stateVersion'
  | 'updatedAt'
  | 'expiresAt'
  | 'source'
> & {
  sourceInstanceId?: string
}

export type PublicIntentDraft =
  | (PublicIntentDraftCommon & {
      type: 'selecting-payment'
      requiredCount: number
      selectedCount: number
    })
  | (PublicIntentDraftCommon & {
      type: 'selecting-hidden-cost'
      requiredCount: number
      selectedCount: number
      publicDescription: string
    })
  | (PublicIntentDraftCommon & {
      type: 'selecting-target'
      targetScope: PublicTargetScope
      requiredCount: number
      selectedCount: number
    })
  | (PublicIntentDraftCommon & {
      type: 'awaiting-response'
      responderId: PlayerId
      responseType: PublicResponseType
    })
  | (PublicIntentDraftCommon & {
      type: 'resolving'
      resolutionLabel?: string
    })

export type RpsChoice = 'rock' | 'paper' | 'scissors'

export type OnlineOpeningStage =
  | 'rps'
  | 'choose-order'
  | 'mulligan'
  | 'forced-mulligan'
  | 'compensation'
  | 'starting-cookie'

export type OnlineOpeningAction =
  | { kind: 'rps'; choice: RpsChoice }
  | { kind: 'choose-order'; goFirst: boolean }
  | { kind: 'mulligan'; replaceAll: boolean }
  | { kind: 'force-mulligan' }
  | { kind: 'mulligan-compensation'; draw: boolean }
  | { kind: 'starting-cookie'; instanceId: string }

export interface OnlineOpeningPlayerProgress {
  name: string
  submitted: boolean
}

export interface OnlineOpeningRpsResult {
  choices: Record<PlayerId, RpsChoice>
  winnerId: PlayerId | null
}

/**
 * 只包含雙方在開局流程中都能知道的資訊。猜拳選擇在雙方送出前不會出現，
 * 起始餅乾的 instanceId 永遠不會透過此快照傳給對手。
 */
export interface OnlineOpeningSnapshot {
  stage: OnlineOpeningStage
  round: number
  actorId: PlayerId | null
  firstPlayerId: PlayerId | null
  players: Record<PlayerId, OnlineOpeningPlayerProgress>
  rpsResult: OnlineOpeningRpsResult | null
  revealedNoCookieHand: GameCard[]
}

export const ONLINE_PLAYER_NAME_MAX_LENGTH = 20

export const isValidOnlinePlayerName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= ONLINE_PLAYER_NAME_MAX_LENGTH

export type ClientMessage =
  | { type: 'create-room'; deck: CustomDeck; playerName?: string }
  | { type: 'join-room'; code: string; deck: CustomDeck; playerName?: string }
  | { type: 'submit-opening-action'; action: OnlineOpeningAction }
  | { type: 'submit-command'; command: GameCommand }
  | { type: 'update-attack-selection'; selection: AttackSelectionPreview }
  | { type: 'set-public-intent'; intent: PublicIntentDraft }
  | { type: 'clear-public-intent'; intentId?: string }
  | { type: 'leave-room' }

/**
 * `state` 是遮罩版 GameState（見 src/game/masked-state.ts）：型別上是完整
 * GameState，只是對手的隱藏區域內容換成佔位卡，讓既有戰場 UI 不用改就能吃。
 */
export type ServerMessage =
  | { type: 'room-created'; code: string }
  | { type: 'room-join-error'; reason: string }
  | {
      type: 'opening-update'
      viewerId: PlayerId
      opening: OnlineOpeningSnapshot
      state: GameState | null
    }
  | { type: 'match-start'; seed: number; viewerId: PlayerId; state: GameState }
  | { type: 'state-update'; state: GameState; updatedBy?: PlayerId }
  | { type: 'opponent-attack-selection'; selection: AttackSelectionPreview }
  | {
      type: 'public-intent-update'
      playerId: PlayerId
      sequence: number
      stateVersion: number
      intent: PublicIntent | null
    }
  | { type: 'command-rejected'; reason: string }
  | {
      type: 'match-ended'
      reason: 'victory' | 'defeat' | 'opponent-disconnected'
    }

type UnknownRecord = Record<string, unknown>

interface CommandShape {
  requiredStrings?: readonly string[]
  requiredStringArrays?: readonly string[]
  optionalStringArrays?: readonly string[]
  optionalStrings?: readonly string[]
  requiredStringMatrices?: readonly string[]
  optionalStringMatrices?: readonly string[]
  requiredNumbers?: readonly string[]
  optionalNumbers?: readonly string[]
  requiredBooleans?: readonly string[]
  requiredNullableStrings?: readonly string[]
  enumFields?: Readonly<Record<string, readonly string[]>>
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPlayerId = (value: unknown): value is PlayerId =>
  value === 'player-one' || value === 'player-two'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isStringMatrix = (value: unknown): value is string[][] =>
  Array.isArray(value) && value.every(isStringArray)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const publicTargetScopes: readonly PublicTargetScope[] = [
  'opponent-battle-cookie',
  'own-battle-cookie',
  'support',
  'break',
  'discard',
  'hand',
  'deck',
  'stage',
  'public-card',
]

const publicIntentTypes = [
  'selecting-payment',
  'selecting-hidden-cost',
  'selecting-target',
  'awaiting-response',
  'resolving',
] as const

const isPublicTargetScope = (value: unknown): value is PublicTargetScope =>
  typeof value === 'string' && publicTargetScopes.includes(value as PublicTargetScope)

const isCardType = (value: unknown): value is CardType =>
  value === 'cookie' || value === 'item' || value === 'trap' || value === 'stage'

const isPublicProgress = (value: unknown): value is PublicIntentProgressStep[] =>
  Array.isArray(value) &&
  value.every(
    (step) =>
      isRecord(step) &&
      (step.key === 'declare' ||
        step.key === 'payment' ||
        step.key === 'cost' ||
        step.key === 'target' ||
        step.key === 'resolve') &&
      typeof step.label === 'string' &&
      (step.state === 'done' || step.state === 'active' || step.state === 'pending'),
  )

const isPublicCardReference = (value: unknown): value is PublicCardReference =>
  isRecord(value) &&
  typeof value.instanceId === 'string' &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isCardType(value.type) &&
  isPlayerId(value.ownerId)

const isStringArrayOrUndefined = (value: unknown): value is string[] | undefined =>
  value === undefined || isStringArray(value)

export const isPublicIntentDraft = (value: unknown): value is PublicIntentDraft => {
  if (!isRecord(value) || !publicIntentTypes.includes(value.type as PublicIntent['type'])) {
    return false
  }

  if (
    (value.sourceInstanceId !== undefined && typeof value.sourceInstanceId !== 'string') ||
    !isStringArrayOrUndefined(value.highlightedTargetInstanceIds) ||
    (value.progress !== undefined && !isPublicProgress(value.progress))
  ) {
    return false
  }

  switch (value.type) {
    case 'selecting-payment':
    case 'selecting-hidden-cost':
    case 'selecting-target':
      if (
        !isFiniteNumber(value.requiredCount) ||
        !Number.isInteger(value.requiredCount) ||
        value.requiredCount < 0 ||
        !isFiniteNumber(value.selectedCount) ||
        !Number.isInteger(value.selectedCount) ||
        value.selectedCount < 0
      ) {
        return false
      }
      if (
        value.type === 'selecting-hidden-cost' &&
        typeof value.publicDescription !== 'string'
      ) {
        return false
      }
      return value.type !== 'selecting-target' || isPublicTargetScope(value.targetScope)
    case 'awaiting-response':
      return (
        isPlayerId(value.responderId) &&
        (value.responseType === 'trap' ||
          value.responseType === 'flip' ||
          value.responseType === 'effect')
      )
    case 'resolving':
      return (
        value.resolutionLabel === undefined ||
        typeof value.resolutionLabel === 'string'
      )
    default:
      return false
  }
}

export const isPublicIntent = (value: unknown): value is PublicIntent => {
  if (!isRecord(value) || !isPublicIntentDraft(value)) return false
  const record = value as UnknownRecord

  return (
    typeof record.intentId === 'string' &&
    isPlayerId(record.actorId) &&
    isFiniteNumber(record.sequence) &&
    Number.isInteger(record.sequence) &&
    record.sequence >= 0 &&
    isFiniteNumber(record.stateVersion) &&
    Number.isInteger(record.stateVersion) &&
    record.stateVersion >= 0 &&
    typeof record.updatedAt === 'string' &&
    (record.expiresAt === undefined || typeof record.expiresAt === 'string') &&
    (record.source === undefined || isPublicCardReference(record.source))
  )
}

const isCustomDeck = (value: unknown): value is CustomDeck =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string' &&
  Array.isArray(value.entries) &&
  value.entries.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.cardNumber === 'string' &&
      Number.isInteger(entry.count),
  )

const commandShapes = {
  'resolve-faint-effect': {
    requiredStringArrays: ['targetIds'],
    optionalStringArrays: ['paymentIds'],
  },
  'resolve-opponent-hand-discard': { requiredStringArrays: ['cardIds'] },
  'resolve-opponent-rest-support': { requiredStringArrays: ['cardIds'] },
  'resolve-inspect-deck': {
    requiredStringArrays: ['pickedCardIds', 'restOrder'],
  },
  'resolve-optional-cost-attack': {
    optionalStringArrays: ['discardCardIds', 'targetIds', 'paymentIds'],
    enumFields: { action: ['skip', 'pay'] },
  },
  'resolve-draw-up-to': { requiredNumbers: ['drawCount'] },
  'resolve-stage-trigger': { enumFields: { action: ['activate', 'skip'] } },
  'resolve-after-damage-effect': { requiredStringArrays: ['targetIds'] },
  'resolve-effect-order': { requiredStringArrays: ['orderedIds'] },
  'keep-opening-hand': {},
  'mulligan-opening-hand': {},
  'force-mulligan-opening-hand': {},
  'draw-mulligan-compensation': {},
  'select-starting-cookie': { requiredStrings: ['instanceId'] },
  'advance-phase': {},
  'place-support': { requiredStrings: ['instanceId'] },
  'deploy-cookie': {
    requiredStrings: ['instanceId'],
    optionalStrings: ['specialPlayCookieInstanceId'],
  },
  attack: {
    requiredStrings: ['attackerInstanceId', 'targetInstanceId'],
    requiredStringArrays: ['supportPaymentIds'],
  },
  'declare-attack': {
    requiredStrings: ['attackerInstanceId', 'targetInstanceId'],
    requiredStringArrays: ['supportPaymentIds'],
  },
  'activate-skill': {
    requiredStrings: ['sourceInstanceId'],
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'costSupportToTrashIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'trashBattleCookieIds',
      'trashToDeckBottomIds',
      'supportToHandIds',
    ],
    optionalStringMatrices: ['effectTargets'],
    enumFields: { trigger: ['activate', 'on-play'] },
  },
  'begin-activate-skill': {
    requiredStrings: ['sourceInstanceId'],
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'costSupportToTrashIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'trashBattleCookieIds',
      'trashToDeckBottomIds',
      'supportToHandIds',
      'targetIds',
    ],
    enumFields: { trigger: ['activate', 'on-play'] },
  },
  'skip-on-play': { requiredStrings: ['sourceInstanceId'] },
  'play-item': {
    requiredStrings: ['instanceId'],
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'supportToTrashIds',
      'supportToHandIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'trashBattleCookieIds',
    ],
    optionalStringMatrices: ['effectTargets'],
  },
  'begin-play-item': {
    requiredStrings: ['instanceId'],
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'supportToTrashIds',
      'supportToHandIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'targetIds',
      'trashBattleCookieIds',
    ],
  },
  'play-stage': {
    requiredStrings: ['instanceId'],
    requiredStringArrays: ['paymentIds'],
  },
  'activate-stage': {
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'supportToTrashIds',
      'supportToHandIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'trashBattleCookieIds',
      'targetIds',
    ],
    optionalStringMatrices: ['effectTargets'],
  },
  'begin-activate-stage': {
    requiredStringArrays: ['paymentIds'],
    optionalStringArrays: [
      'supportToTrashIds',
      'supportToHandIds',
      'discardHandIds',
      'hpToTrashTargetIds',
      'trashBattleCookieIds',
      'targetIds',
    ],
  },
  'resolve-ability-effect': { requiredStringArrays: ['targetIds'] },
  'resolve-place-hand-hp': { optionalStrings: ['handCardInstanceId'] },
  'resolve-choose-one': { requiredNumbers: ['modeIndex'] },
  'replace-cookie': { requiredStrings: ['instanceId'] },
  'skip-replacement': {},
  'refresh-deck': {
    requiredStrings: ['cookieInstanceId'],
    optionalNumbers: ['shuffleSeed'],
  },
  'play-trap': {
    requiredStrings: ['trapInstanceId'],
    requiredStringArrays: ['paymentIds', 'targetIds'],
    optionalNumbers: ['costOptionIndex'],
    optionalStringArrays: [
      'supportTrashIds',
      'supportToHandIds',
      'handToSupportIds',
      'discardHandIds',
      'handToBreakIds',
      'trashBattleCookieIds',
      'trashCookieToBreakAreaIds',
      'trashToDeckIds',
      'selfTargetIds',
    ],
  },
  'skip-trap': {},
  'play-blocker': {
    requiredStrings: ['sourceInstanceId'],
    requiredStringArrays: ['paymentIds'],
  },
  'play-attack-response': {
    requiredStrings: ['sourceInstanceId'],
    requiredStringArrays: ['discardHandIds'],
  },
  'resolve-flip': {
    requiredBooleans: ['activate'],
    optionalStringArrays: ['discardHandIds', 'targetIds'],
    optionalNumbers: ['chooseOneModeIndex'],
  },
  'resolve-attack-effect': { requiredStringArrays: ['targetIds'] },
  'resolve-reveal-top-deck': { optionalStringArrays: ['targetIds'] },
  'resolve-next-damage': {},
  'resolve-battle': {},
} as const satisfies Record<GameCommand['kind'], CommandShape>

const hasValidCommandShape = (
  command: UnknownRecord,
  shape: CommandShape,
): boolean => {
  if (!isPlayerId(command.playerId)) return false

  return (
    (shape.requiredStrings ?? []).every(
      (field) => typeof command[field] === 'string',
    ) &&
    (shape.requiredStringArrays ?? []).every((field) =>
      isStringArray(command[field]),
    ) &&
    (shape.optionalStringArrays ?? []).every(
      (field) => command[field] === undefined || isStringArray(command[field]),
    ) &&
    (shape.optionalStrings ?? []).every(
      (field) =>
        command[field] === undefined || typeof command[field] === 'string',
    ) &&
    (shape.requiredStringMatrices ?? []).every((field) =>
      isStringMatrix(command[field]),
    ) &&
    (shape.optionalStringMatrices ?? []).every(
      (field) => command[field] === undefined || isStringMatrix(command[field]),
    ) &&
    (shape.requiredNumbers ?? []).every((field) => isFiniteNumber(command[field])) &&
    (shape.optionalNumbers ?? []).every(
      (field) => command[field] === undefined || isFiniteNumber(command[field]),
    ) &&
    (shape.requiredBooleans ?? []).every(
      (field) => typeof command[field] === 'boolean',
    ) &&
    (shape.requiredNullableStrings ?? []).every(
      (field) => command[field] === null || typeof command[field] === 'string',
    ) &&
    Object.entries(shape.enumFields ?? {}).every(
      ([field, values]) => typeof command[field] === 'string' && values.includes(command[field]),
    )
  )
}

const isGameCommand = (value: unknown): value is GameCommand => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false
  if (!(value.kind in commandShapes)) return false

  const shape = commandShapes[value.kind as GameCommand['kind']]
  return hasValidCommandShape(value, shape)
}

const isOnlineOpeningAction = (
  value: unknown,
): value is OnlineOpeningAction => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false

  switch (value.kind) {
    case 'rps':
      return (
        value.choice === 'rock' ||
        value.choice === 'paper' ||
        value.choice === 'scissors'
      )
    case 'choose-order':
      return typeof value.goFirst === 'boolean'
    case 'mulligan':
      return typeof value.replaceAll === 'boolean'
    case 'force-mulligan':
      return true
    case 'mulligan-compensation':
      return typeof value.draw === 'boolean'
    case 'starting-cookie':
      return typeof value.instanceId === 'string'
    default:
      return false
  }
}

/**
 * 伺服器將不受信任的 WebSocket payload 轉為型別化訊息前的執行期防線。
 * 牌組是否合法、指令是否符合當前局面，仍分別由 RoomStore 與規則引擎驗證。
 */
export const isClientMessage = (value: unknown): value is ClientMessage => {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'create-room':
      return (
        isCustomDeck(value.deck) &&
        (value.playerName === undefined ||
          isValidOnlinePlayerName(value.playerName))
      )
    case 'join-room':
      return (
        typeof value.code === 'string' &&
        isCustomDeck(value.deck) &&
        (value.playerName === undefined ||
          isValidOnlinePlayerName(value.playerName))
      )
    case 'submit-opening-action':
      return isOnlineOpeningAction(value.action)
    case 'submit-command':
      return isGameCommand(value.command)
    case 'update-attack-selection':
      return (
        isRecord(value.selection) &&
        (value.selection.attackerInstanceId === null ||
          typeof value.selection.attackerInstanceId === 'string') &&
        isStringArray(value.selection.supportPaymentIds)
      )
    case 'set-public-intent':
      return isPublicIntentDraft(value.intent)
    case 'clear-public-intent':
      return value.intentId === undefined || typeof value.intentId === 'string'
    case 'leave-room':
      return true
    default:
      return false
  }
}
