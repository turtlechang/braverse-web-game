import { useState } from 'react'
import {
  OFFICIAL_RED_STARTER_DECK,
  type CustomDeck,
  type GameCommand,
} from '../../game'
import { useOnlineMatch } from '../../hooks/useOnlineMatch'

/**
 * Phase 5 M2 的最小可用線上對戰畫面,僅供手動驗證房間配對/輪次閘門/
 * PlayerView 過濾是否正確。真正的選單串接與正式對戰畫面留到 M3。
 */
const debugDeck = (label: string): CustomDeck => ({
  id: `debug-${label}`,
  name: `除錯牌組（${label}）`,
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export function OnlineMatchDebugView() {
  const online = useOnlineMatch()
  const [joinCode, setJoinCode] = useState('')
  const [rawCommand, setRawCommand] = useState('')
  const [rawCommandError, setRawCommandError] = useState<string | null>(null)

  const submitRawCommand = () => {
    try {
      const command = JSON.parse(rawCommand) as GameCommand
      online.sendCommand(command)
      setRawCommandError(null)
    } catch {
      setRawCommandError('指令必須是合法的 JSON。')
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', color: '#eee' }}>
      <h1>線上對戰除錯畫面（M2）</h1>
      <p>狀態：{online.status}</p>
      {online.errorMessage && <p style={{ color: 'salmon' }}>錯誤：{online.errorMessage}</p>}

      {online.status === 'idle' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => online.createRoom(debugDeck('host'))}>
            建立房間
          </button>
          <div>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="輸入房號"
            />
            <button
              onClick={() => online.joinRoom(joinCode.trim(), debugDeck('guest'))}
            >
              加入房間
            </button>
          </div>
        </div>
      )}

      {online.status === 'waiting-for-opponent' && online.roomCode && (
        <p>
          房號：<strong>{online.roomCode}</strong>，等待對手加入…
        </p>
      )}

      {online.status === 'in-progress' && online.playerView && (
        <>
          <p>
            我的身分：{online.viewerPlayerId}｜房號：{online.roomCode}
          </p>
          <div>
            <textarea
              rows={4}
              style={{ width: '100%' }}
              value={rawCommand}
              onChange={(event) => setRawCommand(event.target.value)}
              placeholder='例如 {"kind":"keep-opening-hand","playerId":"player-one"}'
            />
            <button onClick={submitRawCommand}>送出指令</button>
            {rawCommandError && <p style={{ color: 'salmon' }}>{rawCommandError}</p>}
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 500, overflow: 'auto' }}>
            {JSON.stringify(online.playerView, null, 2)}
          </pre>
        </>
      )}

      {online.status === 'ended' && (
        <p>對局結束：{online.matchEndedReason}</p>
      )}

      <button onClick={online.leave}>離開</button>
    </main>
  )
}
