export type CatalogueMateriel = {
  id: string
  nom: string
  prixUnitaire: number
}

export type CataloguePrix = {
  prixPanneau: number
  prixBatterieKwh: number
  prixOnduleurKVA: number
  materiels: CatalogueMateriel[]
}
