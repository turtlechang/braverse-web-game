import type { CustomDeck, GameCommand, GameState, PlayerId } from '../game'

export interface AttackSelectionPreview {
  attackerInstanceId: string | null
  supportPaymentIds: string[]
}

export const ONLINE_PLAYER_NAME_MAX_LENGTH = 20

export const isValidOnlinePlayerName = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= ONLINE_PLAYER_NAME_MAX_LENGTH

export type ClientMessage =
  | { type: 'create-room'; deck: CustomDeck; playerName?: string }
  | { type: 'join-room'; code: string; deck: CustomDeck; playerName?: string }
  | { type: 'submit-command'; command: GameCommand }
  | { type: 'update-attack-selection'; selection: AttackSelectionPreview }
  | { type: 'leave-room' }

/**
 * `state` 是遮罩版 GameState（見 src/game/masked-state.ts）：型別上是完整
 * GameState，只是對手的隱藏區域內容換成佔位卡，讓既有戰場 UI 不用改就能吃。
 */
export type ServerMessage =
  | { type: 'room-created'; code: string }
  | { type: 'room-join-error'; reason: string }
  | { type: 'match-start'; seed: number; viewerId: PlayerId; state: GameState }
  | { type: 'state-update'; state: GameState }
  | { type: 'opponent-attack-selection'; selection: AttackSelectionPreview }
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
  'resolve-faint-effect': { requiredStringArrays: ['targetIds'] },
  'resolve-opponent-hand-discard': { requiredStringArrays: ['cardIds'] },
  'resolve-inspect-deck': {
    requiredNullableStrings: ['pickedCardId'],
    requiredStringArrays: ['restOrder'],
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
  'deploy-cookie': { requiredStrings: ['instanceId'] },
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
      'trashBattleCookieIds',
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
      'trashBattleCookieIds',
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
      'targetIds',
    ],
  },
  'resolve-ability-effect': { requiredStringArrays: ['targetIds'] },
  'replace-cookie': { requiredStrings: ['instanceId'] },
  'skip-replacement': {},
  'refresh-deck': {
    requiredStrings: ['cookieInstanceId'],
    optionalNumbers: ['shuffleSeed'],
  },
  'play-trap': {
    requiredStrings: ['trapInstanceId'],
    requiredStringArrays: ['paymentIds', 'targetIds'],
    optionalStringArrays: [
      'supportTrashIds',
      'supportToHandIds',
      'handToSupportIds',
      'discardHandIds',
      'trashBattleCookieIds',
      'trashToDeckIds',
    ],
  },
  'skip-trap': {},
  'play-blocker': {
    requiredStrings: ['sourceInstanceId'],
    requiredStringArrays: ['paymentIds'],
  },
  'resolve-flip': {
    requiredBooleans: ['activate'],
    optionalStringArrays: ['discardHandIds'],
  },
  'resolve-attack-effect': { requiredStringArrays: ['targetIds'] },
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
    case 'submit-command':
      return isGameCommand(value.command)
    case 'update-attack-selection':
      return (
        isRecord(value.selection) &&
        (value.selection.attackerInstanceId === null ||
          typeof value.selection.attackerInstanceId === 'string') &&
        isStringArray(value.selection.supportPaymentIds)
      )
    case 'leave-room':
      return true
    default:
      return false
  }
}
