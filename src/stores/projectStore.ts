// src/stores/projectStore.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Equipement = { nom: string, quantite: number, puissance: number, puissanceDemarrage: number, heures: number }
export type Materiel = { nom: string, quantite: number, prixUnitaire: number }

export const useProjectStore = defineStore('project', () => {
  
  // --- ÉTATS DU PROJET ---
  const systemeSelectionne = ref<string | null>('hybride')
  const prioriteSysteme = ref<'solaire' | 'batterie' | 'reseau'>('solaire')
  
  const paramSite = ref({ heuresEnsoleillement: 5, tensionSysteme: 48, longueurCableDC: 15, longueurCableAC: 10 })
  const paramSys = ref({ puissancePanneau: 550, rendementSysteme: 75, joursAutonomie: 1, profondeurDecharge: 80, rendementBatterie: 95 })

  // --- GROUPE ÉLECTROGÈNE ---
  const aGroupeElectrogene = ref<boolean>(false)
  const puissanceGroupeKVA = ref<number>(5)

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
    [systemeSelectionne, prioriteSysteme, paramSite, paramSys, aGroupeElectrogene, puissanceGroupeKVA, equipements, materiels, prixPanneau, prixBatterieKwh, prixOnduleurKVA, isDarkMode],
    () => {
      localStorage.setItem('cheffbuild_project', JSON.stringify({
        systemeSelectionne: systemeSelectionne.value,
        prioriteSysteme: prioriteSysteme.value,
        paramSite: paramSite.value,
        paramSys: paramSys.value,
        aGroupeElectrogene: aGroupeElectrogene.value,
        puissanceGroupeKVA: puissanceGroupeKVA.value,
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

  return {
    systemeSelectionne, prioriteSysteme, paramSite, paramSys, 
    aGroupeElectrogene, puissanceGroupeKVA,
    equipements, materiels, prixPanneau, prixBatterieKwh, prixOnduleurKVA, 
    isDarkMode, toggleDarkMode, resetProjet
  }
})