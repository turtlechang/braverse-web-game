import type { GameCard, PlayerId } from '../../game'
import type {
  OnlineOpeningAction,
  OnlineOpeningSnapshot,
} from '../../net/onlineProtocol'
import { CardFace } from '../cards/CardVisuals'
import { OnlineOpeningOverlay } from './OnlineOpeningOverlay'

const openingCardBacks = (owner: PlayerId): GameCard[] =>
  Array.from({ length: 6 }, (_, index) => ({
    id: 'online-opening-card-back',
    instanceId: `${owner}-opening-card-back-${index}`,
    name: '隱藏卡牌',
    type: 'item',
  }))

export interface OnlineOpeningViewProps {
  opening: OnlineOpeningSnapshot
  viewerPlayerId: PlayerId
  roomCode: string | null
  commandRejectedReason: string | null
  sendOpeningAction: (action: OnlineOpeningAction) => void
  onLeave: () => void
}

export function OnlineOpeningView({
  opening,
  viewerPlayerId,
  roomCode,
  commandRejectedReason,
  sendOpeningAction,
  onLeave,
}: OnlineOpeningViewProps) {
  const opponentId: PlayerId =
    viewerPlayerId === 'player-one' ? 'player-two' : 'player-one'

  return (
    <main className="game-shell online-opening-shell">
      <div className="board-texture" />
      <section className="online-opening-arena" aria-label="Braverse 線上對戰桌">
        <div className="online-opening-lane is-opponent">
          <span>OPPONENT</span>
          <strong>{opening.players[opponentId].name}</strong>
          <div className="online-opening-card-backs" aria-hidden="true">
            {openingCardBacks(opponentId).map((card) => (
              <CardFace key={card.instanceId} card={card} concealed />
            ))}
          </div>
        </div>
        <div className="online-opening-divider">
          <span />
          <strong>OPENING</strong>
          <span />
        </div>
        <div className="online-opening-lane is-viewer">
          <span>PLAYER</span>
          <strong>{opening.players[viewerPlayerId].name}</strong>
          <div className="online-opening-card-backs" aria-hidden="true">
            {openingCardBacks(viewerPlayerId).map((card) => (
              <CardFace key={card.instanceId} card={card} concealed />
            ))}
          </div>
        </div>
      </section>

      <OnlineOpeningOverlay
        opening={opening}
        game={null}
        viewerPlayerId={viewerPlayerId}
        roomCode={roomCode}
        errorMessage={commandRejectedReason}
        onAction={sendOpeningAction}
        onLeave={onLeave}
      />
    </main>
  )
}
