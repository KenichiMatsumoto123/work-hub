import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const clientDir = join(__dirname, 'dist', 'client')
const port = process.env.PORT || 3000

// 本番用エントリポイント。pm2 などから起動されると NODE_ENV が未設定になるため明示する。
process.env.NODE_ENV ||= 'production'
// 起動ディレクトリに依存せず .env を見つけられるよう、アプリの配置先を伝える
process.env.WORK_HUB_APP_DIR ||= __dirname

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const { default: server } = await import('./dist/server/server.js')

createServer(async (req, res) => {
  // Try serving static files from dist/client first
  const staticPath = join(clientDir, req.url.split('?')[0])
  if (existsSync(staticPath) && statSync(staticPath).isFile()) {
    const ext = extname(staticPath)
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
    res.end(readFileSync(staticPath))
    return
  }

  // SSR: convert Node.js request to Web Request
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await new Promise((resolve) => {
          const chunks = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })
      : undefined

  const url = new URL(req.url, `http://${req.headers.host}`)
  const request = new Request(url, { method: req.method, headers, body })

  try {
    const response = await server.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))

    if (response.body) {
      const reader = response.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { res.end(); break }
          res.write(value)
        }
      }
      await pump()
    } else {
      res.end()
    }
  } catch (err) {
    console.error('SSR Error:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
}).listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
