import assert from 'node:assert/strict'
import { test } from 'node:test'

const { SolarEngine } = await import('../src/logic/solarEngine.ts')

const site = { tensionSysteme: 48 }

test('dimensionne quatre batteries Gel 12 V en série sur un bus 48 V', () => {
  const result = SolarEngine.calculerBatterie(
    1500,
    site,
    { joursAutonomie: 1, profondeurDecharge: 50, rendementBatterie: 85 },
    12,
    200
  )

  assert.equal(result.nombreBatteries, 4)
  assert.equal(result.batteriesEnSerie, 4)
  assert.equal(result.chainesParalleles, 1)
  assert.equal(result.capaciteKwh, '3.5')
})

test('ajoute des branches parallèles lorsque la capacité nominale est insuffisante', () => {
  const result = SolarEngine.calculerBatterie(
    1500,
    site,
    { joursAutonomie: 1, profondeurDecharge: 50, rendementBatterie: 85 },
    12,
    50
  )

  assert.equal(result.chainesParalleles, 2)
  assert.equal(result.nombreBatteries, 8)
})

test('retourne un nombre nul de batteries pour une tension de module incompatible', () => {
  const result = SolarEngine.calculerBatterie(
    1500,
    site,
    { joursAutonomie: 1, profondeurDecharge: 80, rendementBatterie: 95 },
    36,
    100
  )

  assert.equal(result.nombreBatteries, null)
})
