import { useCallback, useState } from 'react'
import type { GameCard, PlayerId } from '../game'

export type BattleResourceKind = 'deck' | 'stage' | 'break'

interface HpPileInfo {
  title: string
  cards: GameCard[]
}

interface ResourcePopover {
  playerId: PlayerId
  kind: BattleResourceKind
}

export function useMatchDialogs() {
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [inspectedDiscardPlayerId, setInspectedDiscardPlayerId] =
    useState<PlayerId | null>(null)
  const [inspectedHpPile, setInspectedHpPile] = useState<HpPileInfo | null>(
    null,
  )
  const [showPause, setShowPause] = useState(false)
  const [showDeckList, setShowDeckList] = useState(false)
  const [deckListOwner, setDeckListOwner] =
    useState<'player' | 'ai'>('player')
  const [resourcePopover, setResourcePopover] =
    useState<ResourcePopover | null>(null)

  const openCardDetail = useCallback(
    (card: GameCard) => setInspectedCard(card),
    [],
  )
  const closeCardDetail = useCallback(() => setInspectedCard(null), [])
  const openDiscardPile = useCallback(
    (playerId: PlayerId) => setInspectedDiscardPlayerId(playerId),
    [],
  )
  const closeDiscardPile = useCallback(
    () => setInspectedDiscardPlayerId(null),
    [],
  )
  const openHpPile = useCallback(
    (info: HpPileInfo) => setInspectedHpPile(info),
    [],
  )
  const closeHpPile = useCallback(() => setInspectedHpPile(null), [])
  const openPause = useCallback(() => setShowPause(true), [])
  const closePause = useCallback(() => setShowPause(false), [])
  const openDeckList = useCallback(
    (owner: 'player' | 'ai') => {
      setDeckListOwner(owner)
      setShowDeckList(true)
    },
    [],
  )
  const closeDeckList = useCallback(() => setShowDeckList(false), [])
  const toggleResourcePopover = useCallback(
    (playerId: PlayerId, kind: BattleResourceKind) => {
      setResourcePopover((current) =>
        current?.playerId === playerId && current.kind === kind
          ? null
          : { playerId, kind },
      )
    },
    [],
  )
  const closeResourcePopover = useCallback(
    () => setResourcePopover(null),
    [],
  )

  return {
    inspectedCard,
    openCardDetail,
    closeCardDetail,
    inspectedDiscardPlayerId,
    openDiscardPile,
    closeDiscardPile,
    inspectedHpPile,
    openHpPile,
    closeHpPile,
    showPause,
    openPause,
    closePause,
    showDeckList,
    deckListOwner,
    openDeckList,
    closeDeckList,
    resourcePopover,
    toggleResourcePopover,
    closeResourcePopover,
  } as const
}
