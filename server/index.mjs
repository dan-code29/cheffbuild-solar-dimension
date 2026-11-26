import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = resolve(root, 'dist')
const catalogueFile = resolve(process.env.CATALOGUE_FILE || resolve(root, 'server/data/catalogue-prix.json'))
const sessionDurationMs = 8 * 60 * 60 * 1000
const maxRequestBytes = 100 * 1024
const sessions = new Map()
const failedLogins = new Map()

const hash = (value) => createHash('sha256').update(value).digest()

export function validerCatalogue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const prices = ['prixPanneau', 'prixBatterieKwh', 'prixOnduleurKVA']
  if (prices.some((key) => !Number.isFinite(value[key]) || value[key] < 0)) return null
  if (!Array.isArray(value.materiels) || value.materiels.length > 200) return null

  const ids = new Set()
  const names = new Set()
  const materiels = []
  for (const materiel of value.materiels) {
    if (!materiel || typeof materiel.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(materiel.id)) return null
    if (ids.has(materiel.id) || typeof materiel.nom !== 'string' || !materiel.nom.trim() || materiel.nom.trim().length > 120) return null
    if (!Number.isFinite(materiel.prixUnitaire) || materiel.prixUnitaire < 0) return null
    const nomNormalise = materiel.nom.trim().toLocaleLowerCase('fr-FR')
    if (names.has(nomNormalise)) return null
    ids.add(materiel.id)
    names.add(nomNormalise)
    materiels.push({
      id: materiel.id,
      nom: materiel.nom.trim(),
      prixUnitaire: materiel.prixUnitaire
    })
  }

  return {
    prixPanneau: value.prixPanneau,
    prixBatterieKwh: value.prixBatterieKwh,
    prixOnduleurKVA: value.prixOnduleurKVA,
    materiels
  }
}

function jsonResponse(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  })
  response.end(JSON.stringify(value))
}

async function readJsonBody(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > maxRequestBytes) {
      const error = new Error('La requête est trop volumineuse.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('Le corps de la requête doit être un JSON valide.')
    error.statusCode = 400
    throw error
  }
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie || ''
  const prefix = `${name}=`
  const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  if (!cookie) return ''
  try {
    return decodeURIComponent(cookie.slice(prefix.length))
  } catch {
    return ''
  }
}

function sessionFor(request) {
  const token = cookieValue(request, 'cheffbuild_admin')
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }
  return { token, session }
}

function originIsAllowed(request) {
  const origin = request.headers.origin
  if (!origin) return false

  const configuredOrigin = process.env.APP_ORIGIN
  if (configuredOrigin) return origin === configuredOrigin
  if (process.env.NODE_ENV === 'production') return false

  return origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173'
}

function cookieSecure() {
  return process.env.NODE_ENV === 'production' || process.env.APP_ORIGIN?.startsWith('https://')
}

async function lireCatalogue() {
  const contents = await readFile(catalogueFile, 'utf8')
  const catalogue = validerCatalogue(JSON.parse(contents))
  if (!catalogue) throw new Error(`Catalogue de prix invalide : ${catalogueFile}`)
  return catalogue
}

async function enregistrerCatalogue(catalogue) {
  const temporaryFile = `${catalogueFile}.${process.pid}.tmp`
  await mkdir(dirname(catalogueFile), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8')
  await rename(temporaryFile, catalogueFile)
}

function contentType(path) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  }
  return types[extname(path).toLowerCase()] || 'application/octet-stream'
}

async function servirFichier(request, response, pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    response.writeHead(400).end('Chemin invalide.')
    return
  }

  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath
  const filePath = resolve(distDirectory, `.${requestedPath}`)
  const pathFromDist = relative(distDirectory, filePath)
  if (pathFromDist.startsWith(`..${sep}`) || pathFromDist === '..') {
    response.writeHead(403).end('Accès refusé.')
    return
  }

  let targetPath = filePath
  try {
    const info = await stat(targetPath)
    if (info.isDirectory()) targetPath = resolve(targetPath, 'index.html')
  } catch {
    if (!request.headers.accept?.includes('text/html')) {
      response.writeHead(404).end('Fichier introuvable.')
      return
    }
    targetPath = resolve(distDirectory, 'index.html')
  }

  try {
    const contents = await readFile(targetPath)
    response.writeHead(200, {
      'Content-Type': contentType(targetPath),
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(contents)
  } catch {
    response.writeHead(404).end('Application non compilée : lancez npm run build.')
  }
}

export function createAppServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost')
    const pathname = url.pathname

    try {
      if (request.method === 'GET' && pathname === '/api/health') {
        jsonResponse(response, 200, { ok: true })
        return
      }

      if (request.method === 'GET' && pathname === '/api/catalogue-prix') {
        jsonResponse(response, 200, await lireCatalogue())
        return
      }

      if (request.method === 'GET' && pathname === '/api/admin/session') {
        jsonResponse(response, 200, { authenticated: Boolean(sessionFor(request)) })
        return
      }

      if (request.method === 'POST' && pathname === '/api/admin/login') {
        if (!originIsAllowed(request)) {
          jsonResponse(response, 403, { message: 'Origine de connexion refusée.' })
          return
        }

        const password = process.env.ADMIN_PASSWORD
        if (!password || password.length < 12) {
          jsonResponse(response, 503, { message: 'Le serveur doit être configuré avec un mot de passe admin de 12 caractères minimum.' })
          return
        }

        const address = request.socket.remoteAddress || 'unknown'
        const attempts = failedLogins.get(address)
        if (attempts && attempts.blockedUntil > Date.now()) {
          jsonResponse(response, 429, { message: 'Trop de tentatives. Réessayez dans quelques minutes.' })
          return
        }

        const body = await readJsonBody(request)
        const providedPassword = body && typeof body === 'object' && typeof body.password === 'string'
          ? body.password
          : ''
        if (!timingSafeEqual(hash(providedPassword), hash(password))) {
          const current = failedLogins.get(address)
          const count = current?.windowStart && current.windowStart > Date.now() - 15 * 60 * 1000 ? current.count + 1 : 1
          failedLogins.set(address, {
            count,
            windowStart: current?.windowStart && current.windowStart > Date.now() - 15 * 60 * 1000 ? current.windowStart : Date.now(),
            blockedUntil: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0
          })
          jsonResponse(response, count >= 5 ? 429 : 401, {
            message: count >= 5 ? 'Trop de tentatives. Réessayez dans 15 minutes.' : 'Mot de passe incorrect.'
          })
          return
        }

        failedLogins.delete(address)
        const token = randomBytes(32).toString('base64url')
        sessions.set(token, { expiresAt: Date.now() + sessionDurationMs })
        const secure = cookieSecure() ? '; Secure' : ''
        jsonResponse(response, 200, { authenticated: true }, {
          'Set-Cookie': `cheffbuild_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationMs / 1000}${secure}`
        })
        return
      }

      if (request.method === 'POST' && pathname === '/api/admin/logout') {
        if (!originIsAllowed(request)) {
          jsonResponse(response, 403, { message: 'Origine de connexion refusée.' })
          return
        }
        const currentSession = sessionFor(request)
        if (currentSession) sessions.delete(currentSession.token)
        const secure = cookieSecure() ? '; Secure' : ''
        jsonResponse(response, 200, { authenticated: false }, {
          'Set-Cookie': `cheffbuild_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
        })
        return
      }

      if (request.method === 'PUT' && pathname === '/api/admin/catalogue') {
        if (!originIsAllowed(request)) {
          jsonResponse(response, 403, { message: 'Origine de connexion refusée.' })
          return
        }
        if (!sessionFor(request)) {
          jsonResponse(response, 401, { message: 'Session administrateur expirée.' })
          return
        }
        const catalogue = validerCatalogue(await readJsonBody(request))
        if (!catalogue) {
          jsonResponse(response, 400, { message: 'Catalogue invalide : prix, noms ou identifiants incorrects.' })
          return
        }
        await enregistrerCatalogue(catalogue)
        jsonResponse(response, 200, catalogue)
        return
      }

      if (pathname.startsWith('/api/')) {
        jsonResponse(response, 404, { message: 'Route API introuvable.' })
        return
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        await servirFichier(request, response, pathname)
        return
      }

      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Méthode non autorisée.')
    } catch (error) {
      console.error('Erreur serveur :', error)
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500
      jsonResponse(response, status, {
        message: status === 500 ? 'Erreur interne du serveur.' : error.message
      })
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3001
  const server = createAppServer()
  const productionHost = process.env.NODE_ENV === 'production' || process.env.APP_ORIGIN?.startsWith('https://')
  const host = process.env.HOST || (productionHost ? '0.0.0.0' : '127.0.0.1')
  server.listen(port, host, () => {
    console.log(`CheffBuild API démarrée sur le port ${port}.`)
  })
}
