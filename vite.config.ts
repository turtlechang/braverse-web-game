import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The demo/test-state harness is only needed after the battle shell
        // starts, but its large scenario table was previously pulled into the
        // entry chunk. Keep the initial bundle budget focused on the menu and
        // core shell while letting Vite load the harness as a shared chunk.
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          if (normalizedId.endsWith('/src/game/demo.ts')) {
            return 'game-demo'
          }
          return undefined
        },
      },
    },
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
  test: {
    css: true,
  },
})
