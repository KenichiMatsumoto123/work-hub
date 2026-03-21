import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: {
        preset: 'node-server',
      },
    }),
    viteReact(),
    tailwindcss(),
    {
      name: 'work-hub-api',
      configureServer(server) {
        server.middlewares.use('/api/reports', async (req, res) => {
          // Dynamic import to avoid bundling server code in client
          const mod = await server.ssrLoadModule('./src/server/functions/reports')
          const { getAllReports, getReportsByMonth, saveReportToDb, deleteReportFromDb } = mod

          res.setHeader('Content-Type', 'application/json')

          try {
            if (req.method === 'GET') {
              const url = new URL(req.url || '/', `http://${req.headers.host}`)
              const year = url.searchParams.get('year')
              const month = url.searchParams.get('month')

              if (year && month) {
                const data = await getReportsByMonth(Number(year), Number(month))
                res.end(JSON.stringify(data))
              } else {
                const data = await getAllReports()
                res.end(JSON.stringify(data))
              }
            } else if (req.method === 'POST') {
              let body = ''
              for await (const chunk of req) body += chunk
              const parsed = JSON.parse(body)

              if (parsed.action === 'delete') {
                await deleteReportFromDb(parsed.date)
                res.end(JSON.stringify({ success: true }))
              } else {
                await saveReportToDb(parsed)
                res.end(JSON.stringify({ success: true }))
              }
            }
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      },
    },
  ],
})
