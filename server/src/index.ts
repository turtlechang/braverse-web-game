import { WebSocketServer, type WebSocket } from 'ws'
import { ConnectionManager } from './connection'
import { createRoomStore } from './rooms'

// Render 等 PaaS 以 PORT 指定監聽埠；本機開發沿用 WS_PORT，預設 8787
const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 8787)

const store = createRoomStore()
const manager = new ConnectionManager(store)

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket: WebSocket) => {
  socket.on('message', (data) => {
    manager.handleMessage(socket, data.toString())
  })
  socket.on('close', () => {
    manager.handleDisconnect(socket)
  })
})

console.log(`Braverse 線上對戰 server 已啟動 (port ${PORT})`)
