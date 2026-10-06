import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const widget = fileURLToPath(new URL('../../dist/quotelet.js', import.meta.url))

// In dev, serve the widget bundle built by `bun run build:widget` at /quotelet.js.
const widgetDev = (): Plugin => ({
  name: 'quotelet-widget-dev',
  configureServer(server) {
    server.middlewares.use('/quotelet.js', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(existsSync(widget) ? readFileSync(widget) : 'console.warn("run bun run build:widget")')
    })
  },
})

export default defineConfig({
  plugins: [react(), widgetDev()],
  build: { outDir: 'dist', emptyOutDir: true },
})
