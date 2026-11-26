// src/stores/projectStore.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { CatalogueMateriel, CataloguePrix } from '../data/priceCatalog'
import type { TypeBatterie } from '../data/batteryProfiles'

export type Equipement = { nom: string, quantite: number, puissance: number, puissanceDemarrage: number, heures: number }
export type Materiel = { nom: string, quantite: number, prixUnitaire: number }
export type ModeSchema = 'unifilaire' | 'multifilaire'

export const useProjectStore = defineStore('project', () => {
  
  // --- ÉTATS DU PROJET ---
  const systemeSelectionne = ref<string | null>('hybride')
  const prioriteSysteme = ref<'solaire' | 'batterie' | 'reseau'>('solaire')
  
  const paramSite = ref({ heuresEnsoleillement: 5, tensionSysteme: 48, longueurCableDC: 15, longueurCableAC: 10 })
  const paramSys = ref({ puissancePanneau: 550, rendementSysteme: 75, joursAutonomie: 1, profondeurDecharge: 80, rendementBatterie: 95 })

  // --- GROUPE ÉLECTROGÈNE ---
  const aGroupeElectrogene = ref<boolean>(false)
  const puissanceGroupeKVA = ref<number>(5)
  const modeSchema = ref<ModeSchema>('unifilaire')
  const typeBatterie = ref<TypeBatterie>('lithium')
  const tensionBatterieUnitaire = ref(48)
  const capaciteBatterieUnitaireAh = ref(100)

  // --- ÉQUIPEMENTS & MATÉRIELS ---
  const equipements = ref<Equipement[]>([
    { nom: 'Ampoules LED', quantite: 6, puissance: 10, puissanceDemarrage: 10, heures: 5 },
    { nom: 'Réfrigérateur', quantite: 1, puissance: 150, puissanceDemarrage: 450, heures: 8 }
  ])

  const materiels = ref<Materiel[]>([
    { nom: 'Régulateur MPPT', quantite: 1, prixUnitaire: 150000 },
    { nom: 'Rails de fixation', quantite: 1, prixUnitaire: 50000 },
    { nom: 'Coffret de protection AC/DC', quantite: 1, prixUnitaire: 75000 },
    { nom: 'Câbles DC (mètres)', quantite: 20, prixUnitaire: 2000 }
  ])

  // --- PRIX ---
  const prixPanneau = ref<number>(100000)
  const prixBatterieKwh = ref<number>(200000)
  const prixOnduleurKVA = ref<number>(150000)
  const catalogueMateriels = ref<CatalogueMateriel[]>([])

  // --- MODE SOMBRE ---
  const isDarkMode = ref<boolean>(false)

  // --- SAUVEGARDE AUTOMATIQUE ---
  const dataSauvegardee = localStorage.getItem('cheffbuild_project')
  if (dataSauvegardee) {
    try {
      const data = JSON.parse(dataSauvegardee)
      if (data.systemeSelectionne) systemeSelectionne.value = data.systemeSelectionne
      if (data.prioriteSysteme) prioriteSysteme.value = data.prioriteSysteme
      if (data.paramSite) paramSite.value = data.paramSite
      if (data.paramSys) paramSys.value = data.paramSys
      if (data.aGroupeElectrogene !== undefined) aGroupeElectrogene.value = data.aGroupeElectrogene
      if (data.puissanceGroupeKVA) puissanceGroupeKVA.value = data.puissanceGroupeKVA
      if (data.modeSchema === 'unifilaire' || data.modeSchema === 'multifilaire') modeSchema.value = data.modeSchema
      if (data.typeBatterie === 'gel' || data.typeBatterie === 'agm' || data.typeBatterie === 'lithium') typeBatterie.value = data.typeBatterie
      if (data.tensionBatterieUnitaire) tensionBatterieUnitaire.value = data.tensionBatterieUnitaire
      if (data.capaciteBatterieUnitaireAh) capaciteBatterieUnitaireAh.value = data.capaciteBatterieUnitaireAh
      if (data.equipements) equipements.value = data.equipements
      if (data.materiels) materiels.value = data.materiels
      if (data.prixPanneau) prixPanneau.value = data.prixPanneau
      if (data.prixBatterieKwh) prixBatterieKwh.value = data.prixBatterieKwh
      if (data.prixOnduleurKVA) prixOnduleurKVA.value = data.prixOnduleurKVA
      if (data.isDarkMode !== undefined) isDarkMode.value = data.isDarkMode
    } catch (e) {
      console.error("Erreur lecture localStorage", e)
    }
  }

  // Appliquer le thème au chargement
  if (isDarkMode.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }

  // Surveiller les changements
  watch(
    [systemeSelectionne, prioriteSysteme, paramSite, paramSys, aGroupeElectrogene, puissanceGroupeKVA, modeSchema, typeBatterie, tensionBatterieUnitaire, capaciteBatterieUnitaireAh, equipements, materiels, prixPanneau, prixBatterieKwh, prixOnduleurKVA, isDarkMode],
    () => {
      localStorage.setItem('cheffbuild_project', JSON.stringify({
        systemeSelectionne: systemeSelectionne.value,
        prioriteSysteme: prioriteSysteme.value,
        paramSite: paramSite.value,
        paramSys: paramSys.value,
        aGroupeElectrogene: aGroupeElectrogene.value,
        puissanceGroupeKVA: puissanceGroupeKVA.value,
        modeSchema: modeSchema.value,
        typeBatterie: typeBatterie.value,
        tensionBatterieUnitaire: tensionBatterieUnitaire.value,
        capaciteBatterieUnitaireAh: capaciteBatterieUnitaireAh.value,
        equipements: equipements.value,
        materiels: materiels.value,
        prixPanneau: prixPanneau.value,
        prixBatterieKwh: prixBatterieKwh.value,
        prixOnduleurKVA: prixOnduleurKVA.value,
        isDarkMode: isDarkMode.value
      }))
    },
    { deep: true }
  )

  // Bascule du thème
  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value
    if (isDarkMode.value) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  const resetProjet = () => {
    localStorage.removeItem('cheffbuild_project')
    window.location.reload()
  }

  const appliquerCataloguePrix = (catalogue: CataloguePrix) => {
    prixPanneau.value = catalogue.prixPanneau
    prixBatterieKwh.value = catalogue.prixBatterieKwh
    prixOnduleurKVA.value = catalogue.prixOnduleurKVA
    catalogueMateriels.value = catalogue.materiels.map(materiel => ({ ...materiel }))
    catalogue.materiels.forEach(materiel => {
      const ligneProjet = materiels.value.find(ligne => ligne.nom === materiel.nom)
      if (ligneProjet) ligneProjet.prixUnitaire = materiel.prixUnitaire
    })
  }

  return {
    systemeSelectionne, prioriteSysteme, paramSite, paramSys, 
    aGroupeElectrogene, puissanceGroupeKVA,
    modeSchema,
    typeBatterie, tensionBatterieUnitaire, capaciteBatterieUnitaireAh,
    equipements, materiels, prixPanneau, prixBatterieKwh, prixOnduleurKVA, 
    catalogueMateriels, appliquerCataloguePrix,
    isDarkMode, toggleDarkMode, resetProjet
  }
})