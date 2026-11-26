import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

let server
let baseUrl
let adminCookie
let temporaryDirectory
let validerCatalogue

const catalogueInitial = {
  prixPanneau: 100000,
  prixBatterieKwh: 200000,
  prixOnduleurKVA: 150000,
  materiels: [{ id: 'mppt', nom: 'Régulateur MPPT', prixUnitaire: 150000 }]
}

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'cheffbuild-catalogue-test-'))
  process.env.CATALOGUE_FILE = join(temporaryDirectory, 'catalogue-prix.json')
  process.env.ADMIN_PASSWORD = 'password-for-tests-123'
  process.env.APP_ORIGIN = 'http://localhost:5173'
  await writeFile(process.env.CATALOGUE_FILE, JSON.stringify(catalogueInitial), 'utf8')

  const module = await import('./index.mjs')
  validerCatalogue = module.validerCatalogue
  server = module.createAppServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test('valide et normalise un catalogue, et refuse les prix ou identifiants invalides', () => {
  const normalized = validerCatalogue({
    ...catalogueInitial,
    materiels: [{ id: 'mppt', nom: '  MPPT  ', prixUnitaire: 120000 }]
  })
  assert.equal(normalized.materiels[0].nom, 'MPPT')
  assert.equal(validerCatalogue({ ...catalogueInitial, prixPanneau: -1 }), null)
  assert.equal(validerCatalogue({
    ...catalogueInitial,
    materiels: [
      { id: 'duplicate', nom: 'Un', prixUnitaire: 1 },
      { id: 'duplicate', nom: 'Deux', prixUnitaire: 2 }
    ]
  }), null)
  assert.equal(validerCatalogue({
    ...catalogueInitial,
    materiels: [
      { id: 'first', nom: 'Câble DC', prixUnitaire: 1 },
      { id: 'second', nom: ' câble dc ', prixUnitaire: 2 }
    ]
  }), null)
})

test('protège les modifications du catalogue et persiste les changements autorisés', async () => {
  const rejectedOrigin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
  })
  assert.equal(rejectedOrigin.status, 403)

  const unauthorized = await fetch(`${baseUrl}/api/admin/catalogue`, {
    method: 'PUT',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify(catalogueInitial)
  })
  assert.equal(unauthorized.status, 401)

  const failedLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' })
  })
  assert.equal(failedLogin.status, 401)

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
  })
  assert.equal(login.status, 200)
  adminCookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(adminCookie?.startsWith('cheffbuild_admin='))

  const changedCatalogue = { ...catalogueInitial, prixPanneau: 125000 }
  const update = await fetch(`${baseUrl}/api/admin/catalogue`, {
    method: 'PUT',
    headers: {
      Origin: 'http://localhost:5173',
      Cookie: adminCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(changedCatalogue)
  })
  assert.equal(update.status, 200)

  const saved = JSON.parse(await readFile(process.env.CATALOGUE_FILE, 'utf8'))
  assert.equal(saved.prixPanneau, 125000)
  const publicCatalogue = await fetch(`${baseUrl}/api/catalogue-prix`)
  assert.equal((await publicCatalogue.json()).prixPanneau, 125000)
})
