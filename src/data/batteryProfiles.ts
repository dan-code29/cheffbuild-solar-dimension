export type TypeBatterie = 'gel' | 'agm' | 'lithium'

export const profilsBatteries: Record<TypeBatterie, {
  nom: string
  tensionUnitaire: number
  capaciteUnitaireAh: number
  profondeurDecharge: number
  rendement: number
}> = {
  gel: {
    nom: 'Gel',
    tensionUnitaire: 12,
    capaciteUnitaireAh: 200,
    profondeurDecharge: 50,
    rendement: 85
  },
  agm: {
    nom: 'AGM',
    tensionUnitaire: 12,
    capaciteUnitaireAh: 200,
    profondeurDecharge: 50,
    rendement: 85
  },
  lithium: {
    nom: 'Lithium LiFePO₄',
    tensionUnitaire: 48,
    capaciteUnitaireAh: 100,
    profondeurDecharge: 80,
    rendement: 95
  }
}
