// src/stores/projectStore.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// --- TYPES ---
export type Equipement = { nom: string, quantite: number, puissance: number, puissanceDemarrage: number, heures: number }
export type Materiel = { nom: string, quantite: number, prixUnitaire: number }

export const useProjectStore = defineStore('project', () => {
  
  // ==========================================
  // 1. DONNÉES DU PROJET
  // ==========================================
  const systemeSelectionne = ref<string | null>('hybride')
  const prioriteSysteme = ref<'solaire' | 'batterie' | 'reseau'>('solaire')
  
  // Paramètres du site
  const paramSite = ref({ 
    heuresEnsoleillement: 5, 
    tensionSysteme: 48, 
    longueurCableDC: 15, 
    longueurCableAC: 10 
  })

  // Paramètres du système
  const paramSys = ref({ 
    puissancePanneau: 550, 
    rendementSysteme: 75, 
    joursAutonomie: 1, 
    profondeurDecharge: 80, 
    rendementBatterie: 95 
  })

  // Équipements de l'utilisateur
  const equipements = ref<Equipement[]>([
    { nom: 'Ampoules LED', quantite: 6, puissance: 10, puissanceDemarrage: 10, heures: 5 },
    { nom: 'Réfrigérateur', quantite: 1, puissance: 150, puissanceDemarrage: 450, heures: 8 }
  ])

  // ==========================================
  // 2. CATALOGUE DE PRIX (Modifiable)
  // ==========================================
  // Prix par défaut adaptés au marché (à ajuster selon vos fournisseurs)
  const prixPanneau = ref<number>(100000)          // FCFA / panneau
  const prixBatterieKwh = ref<number>(200000)      // FCFA / kWh
  const prixOnduleurKVA = ref<number>(150000)      // FCFA / kVA
  const prixRegulateurMPPT = ref<number>(150000)   // FCFA
  
  // Liste des matériels annexes par défaut
  const materiels = ref<Materiel[]>([
    { nom: 'Régulateur MPPT', quantite: 1, prixUnitaire: prixRegulateurMPPT.value },
    { nom: 'Rails de fixation', quantite: 1, prixUnitaire: 50000 },
    { nom: 'Coffret de protection AC/DC', quantite: 1, prixUnitaire: 75000 },
    { nom: 'Câbles DC (mètres)', quantite: 20, prixUnitaire: 2000 }
  ])

  // ==========================================
  // 3. SAUVEGARDE AUTOMATIQUE (localStorage)
  // ==========================================
  // On récupère les données sauvegardées lors de l'ouverture
  const dataSauvegardee = localStorage.getItem('cheffbuild_project')
  if (dataSauvegardee) {
    try {
      const data = JSON.parse(dataSauvegardee)
      if (data.systemeSelectionne) systemeSelectionne.value = data.systemeSelectionne
      if (data.prioriteSysteme) prioriteSysteme.value = data.prioriteSysteme
      if (data.paramSite) paramSite.value = data.paramSite
      if (data.paramSys) paramSys.value = data.paramSys
      if (data.equipements) equipements.value = data.equipements
      if (data.materiels) materiels.value = data.materiels
      if (data.prixPanneau) prixPanneau.value = data.prixPanneau
      if (data.prixBatterieKwh) prixBatterieKwh.value = data.prixBatterieKwh
      if (data.prixOnduleurKVA) prixOnduleurKVA.value = data.prixOnduleurKVA
    } catch (e) {
      console.error("Erreur de lecture des données locales", e)
    }
  }

  // On écoute toutes les modifications pour sauvegarder instantanément
  watch(
    [systemeSelectionne, prioriteSysteme, paramSite, paramSys, equipements, materiels, prixPanneau, prixBatterieKwh, prixOnduleurKVA],
    () => {
      localStorage.setItem('cheffbuild_project', JSON.stringify({
        systemeSelectionne: systemeSelectionne.value,
        prioriteSysteme: prioriteSysteme.value,
        paramSite: paramSite.value,
        paramSys: paramSys.value,
        equipements: equipements.value,
        materiels: materiels.value,
        prixPanneau: prixPanneau.value,
        prixBatterieKwh: prixBatterieKwh.value,
        prixOnduleurKVA: prixOnduleurKVA.value
      }))
    },
    { deep: true } // deep: true permet de surveiller les changements à l'intérieur des tableaux et objets
  )

  // Fonction pour réinitialiser le projet
  const resetProjet = () => {
    localStorage.removeItem('cheffbuild_project')
    window.location.reload()
  }

  return {
    systemeSelectionne, prioriteSysteme, paramSite, paramSys, equipements, materiels,
    prixPanneau, prixBatterieKwh, prixOnduleurKVA, resetProjet
  }
})