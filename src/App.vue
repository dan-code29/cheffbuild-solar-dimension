<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { SolarEngine } from './logic/solarEngine'
import { useProjectStore } from './stores/projectStore'
import SchemaElectrique from './components/SchemaElectrique.vue'
import { catalogueEquipements } from './data/equipmentCatalog'
import { profilsBatteries, type TypeBatterie } from './data/batteryProfiles'
import type { CataloguePrix } from './data/priceCatalog'

const store = useProjectStore()

// Navigation
const pageActuelle = ref<'accueil' | 'configurateur' | 'admin'>(
  window.location.pathname === '/admin/catalogue' ? 'admin' : 'accueil'
)
const etapeActuelle = ref<number>(1)
const totalEtapes = 5
const nomsEtapes = ["Contexte", "Bilan", "Dimensionnement", "Matériel", "Résumé"]
const tensionAC = ref(230)
const afficherEtudeTechnique = ref(false)
const ongletActif = ref('synthese')
const erreurValidation = ref<string | null>(null)
const erreurCatalogue = ref<string | null>(null)
const messageCatalogue = ref<string | null>(null)
const motDePasseAdmin = ref('')
const adminAuthentifie = ref(false)
const chargementAdmin = ref(false)
const catalogueEdition = ref<CataloguePrix>({
  prixPanneau: store.prixPanneau,
  prixBatterieKwh: store.prixBatterieKwh,
  prixOnduleurKVA: store.prixOnduleurKVA,
  materiels: store.catalogueMateriels.map(materiel => ({ ...materiel }))
})

const chargerCataloguePrix = async () => {
  try {
    const response = await fetch('/api/catalogue-prix')
    if (!response.ok) throw new Error(`Chargement des prix impossible (HTTP ${response.status}).`)
    const catalogue = await response.json() as CataloguePrix
    store.appliquerCataloguePrix(catalogue)
    if (adminAuthentifie.value) catalogueEdition.value = structuredClone(catalogue)
    erreurCatalogue.value = null
  } catch (error) {
    erreurCatalogue.value = error instanceof Error ? error.message : 'Le catalogue de prix est indisponible.'
  }
}

const verifierSessionAdmin = async () => {
  try {
    const response = await fetch('/api/admin/session', { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`Vérification de la session impossible (HTTP ${response.status}).`)
    const session = await response.json() as { authenticated: boolean }
    adminAuthentifie.value = session.authenticated
    if (session.authenticated) await chargerCataloguePrix()
  } catch (error) {
    erreurCatalogue.value = error instanceof Error ? error.message : 'La session administrateur est indisponible.'
  }
}

const lireReponseApi = async <T>(response: Response): Promise<T> => {
  const result = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(result.message || `Erreur serveur (HTTP ${response.status}).`)
  return result
}

const connecterAdmin = async () => {
  chargementAdmin.value = true
  erreurCatalogue.value = null
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: motDePasseAdmin.value })
    })
    await lireReponseApi<{ authenticated: boolean, message?: string }>(response)
    adminAuthentifie.value = true
    motDePasseAdmin.value = ''
    await chargerCataloguePrix()
  } catch (error) {
    erreurCatalogue.value = error instanceof Error ? error.message : 'Connexion administrateur impossible.'
  } finally {
    chargementAdmin.value = false
  }
}

const deconnecterAdmin = async () => {
  erreurCatalogue.value = null
  try {
    const response = await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    await lireReponseApi<{ authenticated: boolean }>(response)
    adminAuthentifie.value = false
    pageActuelle.value = 'accueil'
    window.history.replaceState(null, '', '/')
  } catch (error) {
    erreurCatalogue.value = error instanceof Error ? error.message : 'Déconnexion impossible.'
  }
}

const enregistrerCatalogue = async () => {
  chargementAdmin.value = true
  erreurCatalogue.value = null
  messageCatalogue.value = null
  try {
    const response = await fetch('/api/admin/catalogue', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(catalogueEdition.value)
    })
    const catalogue = await lireReponseApi<CataloguePrix & { message?: string }>(response)
    catalogueEdition.value = structuredClone(catalogue)
    store.appliquerCataloguePrix(catalogue)
    messageCatalogue.value = 'Catalogue enregistré sur le serveur.'
  } catch (error) {
    erreurCatalogue.value = error instanceof Error ? error.message : 'Enregistrement du catalogue impossible.'
  } finally {
    chargementAdmin.value = false
  }
}

const ajouterArticleCatalogue = () => {
  let id = `materiel-${Date.now()}`
  while (catalogueEdition.value.materiels.some(materiel => materiel.id === id)) id += '-1'
  catalogueEdition.value.materiels.push({ id, nom: '', prixUnitaire: 0 })
}

const optionsTensionBatterie = computed(() => [12, 24, 48].filter(
  tension => tension <= store.paramSite.tensionSysteme && store.paramSite.tensionSysteme % tension === 0
))

const selectionnerTypeBatterie = (type: TypeBatterie) => {
  const profil = profilsBatteries[type]
  store.typeBatterie = type
  store.paramSys.profondeurDecharge = profil.profondeurDecharge
  store.paramSys.rendementBatterie = profil.rendement
  store.capaciteBatterieUnitaireAh = profil.capaciteUnitaireAh
  store.tensionBatterieUnitaire = optionsTensionBatterie.value.includes(profil.tensionUnitaire)
    ? profil.tensionUnitaire
    : Math.max(...optionsTensionBatterie.value)
}

watch(() => store.paramSite.tensionSysteme, () => {
  if (!optionsTensionBatterie.value.includes(store.tensionBatterieUnitaire)) {
    store.tensionBatterieUnitaire = Math.max(...optionsTensionBatterie.value)
  }
}, { immediate: true })

const appliquerPrixCatalogue = (materiel: { nom: string, prixUnitaire: number }) => {
  const article = store.catalogueMateriels.find(item => item.nom === materiel.nom)
  if (article) materiel.prixUnitaire = article.prixUnitaire
}

onMounted(async () => {
  await chargerCataloguePrix()
  if (pageActuelle.value === 'admin') await verifierSessionAdmin()
})

const optionsSystemes = [
  { id: 'equipements', titre: 'Quelques équipements', description: 'Alimentez uniquement des appareils spécifiques.', icone: '🔌', usage: 'Idéal petit budget' },
  { id: 'hybride', titre: 'Système hybride', description: 'Solaire + réseau + batterie.', icone: '🔄', usage: 'Idéal maison moderne' },
  { id: 'personnalise', titre: 'Configurer tout moi-même', description: 'Saisie libre de vos besoins.', icone: '🛠️', usage: 'Mode expert / technicien' }
]

// Navigation
const choisirSysteme = (id: string) => { store.systemeSelectionne = id; pageActuelle.value = 'configurateur'; etapeActuelle.value = 1 }
const revenirAccueil = () => { pageActuelle.value = 'accueil' }
const allerAEtape = (num: number) => { etapeActuelle.value = num }

// Gestion des équipements
const ajouterEquipement = () => store.equipements.push({ nom: '', quantite: 1, puissance: 0, puissanceDemarrage: 0, heures: 0 })
const supprimerEquipement = (index: number) => store.equipements.splice(index, 1)

const selectionnerEquipement = (index: number, nom: string) => {
  const modele = catalogueEquipements.find(e => e.nom === nom)
  const equipement = store.equipements[index]
  if (modele && equipement) {
    equipement.puissance = modele.puissance
    equipement.puissanceDemarrage = modele.puissanceDemarrage
  }
}

// Gestion des matériels
const ajouterMateriel = () => store.materiels.push({ nom: '', quantite: 1, prixUnitaire: 0 })
const supprimerMateriel = (index: number) => store.materiels.splice(index, 1)

// Validation
const validerEtape = () => {
  erreurValidation.value = null
  if (etapeActuelle.value === 2) {
    if (store.equipements.length === 0) {
      erreurValidation.value = "Veuillez ajouter au moins un équipement."
      return false
    }
    const invalide = store.equipements.some(eq => eq.puissance <= 0 || eq.heures <= 0 || eq.nom.trim() === '')
    if (invalide) {
      erreurValidation.value = "Veuillez remplir tous les champs en rouge (Nom, Puissance > 0, Durée > 0)."
      return false
    }
  }
  return true
}

const etapeSuivante = () => { if (validerEtape() && etapeActuelle.value < totalEtapes) etapeActuelle.value++ }
const etapePrecedente = () => { if (etapeActuelle.value > 1) { erreurValidation.value = null; etapeActuelle.value-- } }

// Calculs
const bilan = computed(() => SolarEngine.calculerBilan(store.equipements))
const dimensionnementPV = computed(() => SolarEngine.calculerPV(bilan.value.consoJourWh, store.paramSite, store.paramSys))
const dimensionnementBatterie = computed(() => SolarEngine.calculerBatterie(
  bilan.value.consoJourWh,
  store.paramSite,
  store.paramSys,
  store.tensionBatterieUnitaire,
  store.capaciteBatterieUnitaireAh
))
const dimensionnementOnduleur = computed(() => SolarEngine.calculerOnduleur(bilan.value.puissanceDemarrageMaxW))
const alertesBase = computed(() => SolarEngine.verifierInstallation(dimensionnementPV.value, dimensionnementBatterie.value, dimensionnementOnduleur.value, store.paramSite))
const alertesGroupe = computed(() => {
  if (!store.aGroupeElectrogene || !dimensionnementOnduleur.value) return []
  return SolarEngine.verifierGroupe(parseFloat(dimensionnementOnduleur.value.puissanceRequiseKVA), store.puissanceGroupeKVA)
})
const alertes = computed(() => [...alertesBase.value, ...alertesGroupe.value])

const cablageDC = computed(() => {
  if (!dimensionnementPV.value) return null
  const courant = (parseFloat(dimensionnementPV.value.puissanceCreteKw) * 1000) / store.paramSite.tensionSysteme
  return SolarEngine.calculerSectionCable(store.paramSite.longueurCableDC, courant, store.paramSite.tensionSysteme)
})
const cablageAC = computed(() => {
  if (!dimensionnementOnduleur.value) return null
  return SolarEngine.calculerCableAC(parseFloat(dimensionnementOnduleur.value.puissanceRequiseVA.toString()), tensionAC.value, store.paramSite.longueurCableAC)
})
const protections = computed(() => {
  if (!dimensionnementOnduleur.value || !dimensionnementPV.value) return null
  const courantPV = (parseFloat(dimensionnementPV.value.puissanceCreteKw) * 1000) / store.paramSite.tensionSysteme
  return SolarEngine.calculerProtections(parseFloat(dimensionnementOnduleur.value.puissanceRequiseVA.toString()), tensionAC.value, courantPV)
})
const strings = computed(() => {
  if (!dimensionnementPV.value) return null
  return SolarEngine.calculerStrings(dimensionnementPV.value.nombrePanneaux, store.paramSite.tensionSysteme)
})

const budget = computed(() => {
  if (!dimensionnementPV.value || !dimensionnementBatterie.value || !dimensionnementOnduleur.value) return null
  const coutPanneaux = dimensionnementPV.value.nombrePanneaux * store.prixPanneau
  const coutBatteries = Math.ceil(parseFloat(dimensionnementBatterie.value.capaciteKwh) * 10) / 10 * store.prixBatterieKwh
  const coutOnduleur = Math.max(300000, parseFloat(dimensionnementOnduleur.value.puissanceRequiseKVA) * store.prixOnduleurKVA)
  let coutMat = 0
  store.materiels.forEach(m => { coutMat += (m.quantite * m.prixUnitaire) })
  return { panneaux: coutPanneaux, batteries: coutBatteries, onduleur: coutOnduleur, materiels: coutMat, total: coutPanneaux + coutBatteries + coutOnduleur + coutMat }
})

// Outils
const formatFCFA = (valeur: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(valeur) + ' FCFA'

const genererDevis = () => {
  if (!budget.value) return
  const modeleHTML = document.getElementById('modele-pdf')?.innerHTML
  if (!modeleHTML) return
  const fenetre = window.open('', '_blank')
  if (!fenetre) return
  fenetre.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Devis</title><style>body{font-family:Arial;padding:20px;color:#000}.pdf-header{text-align:center;border-bottom:3px solid #0066FF;padding-bottom:15px;margin-bottom:25px}.pdf-section h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:5px;color:#0066FF;margin-bottom:10px}.pdf-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}.pdf-table th{background:#f0f4f8;padding:10px;border:1px solid #ccc;text-align:left}.pdf-table td{padding:8px;border:1px solid #ddd}.pdf-table tfoot .pdf-total td{background:#e0f2fe;font-size:14px;padding:12px;border-top:2px solid #0066FF}.pdf-note{font-size:11px;color:#666}@media print{body{padding:0}@page{margin:15mm}}</style></head><body>${modeleHTML}</body></html>`)
  fenetre.document.close()
  fenetre.onload = () => { fenetre.focus(); fenetre.print(); }
}

const genererEtudeTechnique = () => {
  if (!budget.value) return
  const modeleHTML = document.getElementById('modele-etude-tech')?.innerHTML
  if (!modeleHTML) return
  const fenetre = window.open('', '_blank')
  if (!fenetre) return
  fenetre.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Étude Technique</title><style>
    body{font-family:Arial;padding:20px;color:#000;font-size:13px}
    h1{color:#0A2540;text-align:center}
    h2{color:#0066FF;border-bottom:1px solid #ccc;padding-bottom:5px;margin-top:30px}
    .tech-table{width:100%;border-collapse:collapse;margin-top:10px}
    .tech-table td{padding:6px;border-bottom:1px solid #eee}
    .tech-table td:first-child{font-weight:bold;width:50%}
    .alerte{padding:10px;border-radius:5px;margin-bottom:5px}
    .alerte.danger{background:#fee2e2;color:#991b1b}
    .alerte.warning{background:#fef3c7;color:#92400e}
    .alerte.success{background:#dcfce7;color:#166534}
    .schema-pdf{page-break-before:always;break-before:page}
    .schema-pdf svg{width:100%!important;min-width:0!important}
    @media print{body{padding:0}@page{margin:15mm}}
  </style></head><body>${modeleHTML}</body></html>`)
  fenetre.document.close()
  fenetre.onload = () => { fenetre.focus(); fenetre.print(); }
}
</script>

<template>
  <div class="app-container">
    <div v-if="erreurCatalogue" class="alerte warning" role="status">{{ erreurCatalogue }}</div>
    <div v-if="messageCatalogue" class="alerte success" role="status">{{ messageCatalogue }}</div>
    
    <!-- ================= PAGE D'ACCUEIL ================= -->
    <div v-if="pageActuelle === 'accueil'" class="page-accueil">
      <header class="hero">
        <h1>☀️ CheffBuild Solar</h1>
        <p>Dimensionnement et estimation pour vos projets photovoltaïques.</p>
      </header>
      <main>
        <div class="grille-options">
          <div v-for="option in optionsSystemes" :key="option.id" class="carte-option" @click="choisirSysteme(option.id)">
            <div class="icone">{{ option.icone }}</div>
            <h3>{{ option.titre }}</h3>
            <p>{{ option.description }}</p>
            <span class="badge-usage">{{ option.usage }}</span>
            <button class="btn-choisir">Configurer</button>
          </div>
        </div>
        <div style="text-align: center; margin-top: 3rem;">
          <button @click="store.resetProjet()" style="background:none; border:none; color:#999; cursor:pointer; text-decoration:underline; font-size: 0.9rem;">
            Effacer le projet actuel et recommencer
          </button>
        </div>
      </main>
    </div>

    <!-- ================= CONFIGURATEUR ================= -->
    <div v-else-if="pageActuelle === 'configurateur'" class="page-configurateur">
      
      <nav class="stepper">
        <div class="stepper-top">
          <button @click="revenirAccueil" class="btn-retour">← Accueil</button>
          <button @click="store.toggleDarkMode()" class="btn-retour" title="Changer de thème">
            {{ store.isDarkMode ? '☀️ Mode Clair' : '🌙 Mode Sombre' }}
          </button>
        </div>
        <div class="steps-container">
          <div v-for="(nom, index) in nomsEtapes" :key="index" class="step-item" 
               :class="{ 'active': etapeActuelle === index + 1, 'done': etapeActuelle > index + 1 }" 
               @click="allerAEtape(index + 1)">
            <div class="step-circle">{{ index + 1 }}</div>
            <span class="step-label">{{ nom }}</span>
          </div>
        </div>
      </nav>

      <div class="etape-contenu">
        <!-- ÉTAPE 1 -->
        <section v-if="etapeActuelle === 1" class="card fade-in">
          <h2>Étape 1 : Contexte & Site</h2>
          <div class="grid-params">
            <div class="form-group">
              <label>Ensoleillement : {{ store.paramSite.heuresEnsoleillement }} h/j</label>
              <input type="range" v-model.number="store.paramSite.heuresEnsoleillement" min="2" max="8" step="0.5" />
            </div>
            <div class="form-group">
              <label>Tension Bus DC :</label>
              <select v-model.number="store.paramSite.tensionSysteme" class="select-input">
                <option :value="12">12 V (Petit)</option>
                <option :value="24">24 V (Moyen)</option>
                <option :value="48">48 V (Recommandé)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Longueur câble DC (m) :</label>
              <input type="number" v-model.number="store.paramSite.longueurCableDC" min="1" class="select-input" />
            </div>
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" v-model="store.aGroupeElectrogene" /> 
              J'ai un groupe électrogène de secours
            </label>
          </div>
          <div class="form-group" v-if="store.aGroupeElectrogene">
            <label>Puissance du groupe (kVA) :</label>
            <input type="number" v-model.number="store.puissanceGroupeKVA" min="1" step="0.5" class="select-input" />
          </div>

          <div class="form-group" v-if="store.systemeSelectionne === 'hybride'">
            <label>Priorité de fonctionnement :</label>
            <div class="radio-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label><input type="radio" value="solaire" v-model="store.prioriteSysteme" /> ☀️ Solaire en priorité</label>
              <label><input type="radio" value="batterie" v-model="store.prioriteSysteme" /> 🔋 Batterie en priorité</label>
              <label><input type="radio" value="reseau" v-model="store.prioriteSysteme" /> 🔌 Réseau en priorité</label>
            </div>
          </div>
        </section>

        <!-- ÉTAPE 2 -->
        <section v-if="etapeActuelle === 2" class="card fade-in">
          <h2>Étape 2 : Bilan Énergétique</h2>
          <p class="help-text">Sélectionnez un appareil pour pré-remplir ses caractéristiques.</p>
          <div class="table-responsive">
            <table class="tableau-equipements">
              <thead><tr><th>Équipement</th><th>Qté</th><th>Puiss. (W)</th><th>Démarrage (W)</th><th>Durée (h/j)</th><th>Total (Wh/j)</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(eq, index) in store.equipements" :key="index">
                  <td>
                    <select v-model="eq.nom" @change="selectionnerEquipement(index, eq.nom)" class="select-input" style="width: 100%;">
                      <option value="" disabled>-- Choisir --</option>
                      <option v-for="cat in catalogueEquipements" :key="cat.nom" :value="cat.nom">{{ cat.nom }}</option>
                    </select>
                  </td>
                  <td><input type="number" v-model.number="eq.quantite" min="1" :class="{ 'input-error': eq.quantite <= 0 }" /></td>
                  <td><input type="number" v-model.number="eq.puissance" min="0" :class="{ 'input-error': eq.puissance <= 0 }" /></td>
                  <td><input type="number" v-model.number="eq.puissanceDemarrage" min="0" /></td>
                  <td><input type="number" v-model.number="eq.heures" min="0" max="24" :class="{ 'input-error': eq.heures <= 0 }" /></td>
                  <td class="text-right">{{ (eq.puissance * eq.quantite * eq.heures) }} Wh</td>
                  <td><button @click="supprimerEquipement(index)" class="btn-suppr">✖</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button @click="ajouterEquipement" class="btn-ajouter">+ Ajouter un équipement</button>
          <div class="total-encart">
            <p>Consommation : <strong>{{ bilan.consoJourWh }} Wh/j</strong></p>
            <p>Pic de démarrage : <strong>{{ bilan.puissanceDemarrageMaxW }} W</strong></p>
          </div>
        </section>

        <!-- ÉTAPE 3 -->
        <section v-if="etapeActuelle === 3" class="card fade-in">
          <h2>Étape 3 : Dimensionnement</h2>
          <div class="grid-params">
            <div class="form-group">
              <label>Autonomie : {{ store.paramSys.joursAutonomie }} jour(s)</label>
              <input type="range" v-model.number="store.paramSys.joursAutonomie" min="0" max="5" step="0.5" />
            </div>
            <div class="form-group">
              <label>Puissance panneau : {{ store.paramSys.puissancePanneau }} Wc</label>
              <input type="range" v-model.number="store.paramSys.puissancePanneau" min="300" max="700" step="10" />
            </div>
            <div class="form-group">
              <label for="type-batterie">Technologie de batterie</label>
              <select id="type-batterie" v-model="store.typeBatterie" class="select-input" @change="selectionnerTypeBatterie(store.typeBatterie)">
                <option value="gel">Gel</option>
                <option value="agm">AGM</option>
                <option value="lithium">Lithium LiFePO₄</option>
              </select>
            </div>
            <div class="form-group">
              <label for="tension-batterie">Tension par batterie (V)</label>
              <select id="tension-batterie" v-model.number="store.tensionBatterieUnitaire" class="select-input">
                <option v-for="tension in optionsTensionBatterie" :key="tension" :value="tension">{{ tension }} V</option>
              </select>
            </div>
            <div class="form-group">
              <label for="capacite-batterie-unitaire">Capacité par batterie (Ah)</label>
              <input id="capacite-batterie-unitaire" v-model.number="store.capaciteBatterieUnitaireAh" type="number" min="1" step="10" class="select-input" />
            </div>
            <div class="form-group">
              <label for="profondeur-decharge">Profondeur de décharge : {{ store.paramSys.profondeurDecharge }} %</label>
              <input id="profondeur-decharge" v-model.number="store.paramSys.profondeurDecharge" type="range" min="30" max="95" step="5" />
            </div>
            <div class="form-group">
              <label for="rendement-batterie">Rendement batterie : {{ store.paramSys.rendementBatterie }} %</label>
              <input id="rendement-batterie" v-model.number="store.paramSys.rendementBatterie" type="range" min="70" max="100" step="1" />
            </div>
          </div>
          <p class="help-text">Les valeurs de chaque technologie sont indicatives : vérifiez la fiche fabricant et ajustez la tension, la capacité et les paramètres de décharge.</p>
          <div class="resultats-dimensionnement" v-if="dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur">
            <div class="res-box"><span>Panneaux</span><strong>{{ dimensionnementPV.nombrePanneaux }}</strong><small>{{ dimensionnementPV.puissanceCreteKw }} kWc</small></div>
            <div class="res-box">
              <span>Stockage {{ profilsBatteries[store.typeBatterie].nom }}</span>
              <strong>{{ dimensionnementBatterie.nombreBatteries ?? 'À vérifier' }} batterie(s)</strong>
              <small>{{ dimensionnementBatterie.capaciteKwh }} kWh requis · {{ dimensionnementBatterie.capaciteAh }} Ah</small>
              <small v-if="dimensionnementBatterie.nombreBatteries !== null">
                {{ dimensionnementBatterie.batteriesEnSerie }} en série × {{ dimensionnementBatterie.chainesParalleles }} branche(s) parallèle(s)
              </small>
              <small>{{ store.tensionBatterieUnitaire }} V · {{ store.capaciteBatterieUnitaireAh }} Ah par batterie</small>
            </div>
            <div class="res-box"><span>Onduleur</span><strong>{{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA</strong><small>Pic de démarrage</small></div>
          </div>
        </section>

        <!-- ÉTAPE 4 -->
        <section v-if="etapeActuelle === 4" class="card fade-in">
          <h2>Étape 4 : Matériel Annexe</h2>
          <div class="table-responsive">
            <table class="tableau-equipements">
              <thead><tr><th>Désignation</th><th>Qté</th><th>Prix Unitaire (FCFA)</th><th>Total</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(mat, index) in store.materiels" :key="index">
                  <td><input type="text" v-model="mat.nom" list="catalogue-materiels" @change="appliquerPrixCatalogue(mat)" /></td>
                  <td><input type="number" v-model.number="mat.quantite" min="1" /></td>
                  <td><input type="number" v-model.number="mat.prixUnitaire" min="0" step="1000" /></td>
                  <td class="text-right">{{ formatFCFA(mat.prixUnitaire * mat.quantite) }}</td>
                  <td><button @click="supprimerMateriel(index)" class="btn-suppr">✖</button></td>
                </tr>
              </tbody>
            </table>
            <datalist id="catalogue-materiels">
              <option v-for="article in store.catalogueMateriels" :key="article.id" :value="article.nom" />
            </datalist>
          </div>
          <button @click="ajouterMateriel" class="btn-ajouter">+ Ajouter</button>
        </section>

        <!-- ÉTAPE 5 -->
        <section v-if="etapeActuelle === 5" class="card fade-in">
          <h2>Étape 5 : Résumé</h2>
          <div class="alertes-container" v-if="alertes.length > 0">
            <div v-for="(alerte, i) in alertes" :key="i" :class="['alerte', alerte.type]">{{ alerte.msg }}</div>
          </div>
          <div v-if="budget && dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur" class="recapitulatif">
            <div class="bloc-recap">
              <h3>Résumé Technique</h3>
              <p><strong>Énergie :</strong> {{ bilan.consoJourWh }} Wh/jour</p>
              <p><strong>Panneaux :</strong> {{ dimensionnementPV.nombrePanneaux }} x {{ store.paramSys.puissancePanneau }}Wc</p>
              <p><strong>Batteries :</strong> {{ dimensionnementBatterie.nombreBatteries ?? 'Configuration à vérifier' }} × {{ profilsBatteries[store.typeBatterie].nom }} ({{ dimensionnementBatterie.capaciteKwh }} kWh)</p>
              <p><strong>Onduleur :</strong> {{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA</p>
              <button class="btn-tech" @click="afficherEtudeTechnique = true">🔍 Voir l'étude technique détaillée</button>
            </div>
            <div class="bloc-recap budget-final">
              <h3>Budget Estimatif</h3>
              <div class="ligne-budget"><span>Panneaux :</span> <strong>{{ formatFCFA(budget.panneaux) }}</strong></div>
              <div class="ligne-budget"><span>Batteries :</span> <strong>{{ formatFCFA(budget.batteries) }}</strong></div>
              <div class="ligne-budget"><span>Onduleur :</span> <strong>{{ formatFCFA(budget.onduleur) }}</strong></div>
              <div class="ligne-budget"><span>Matériel :</span> <strong>{{ formatFCFA(budget.materiels) }}</strong></div>
              <div class="total-budget"><span>TOTAL</span> <strong>{{ formatFCFA(budget.total) }}</strong></div>
            </div>
          </div>
          <div class="actions-finales">
            <button @click="genererDevis" class="btn-telecharger">📥 Générer le Devis PDF</button>
          </div>
        </section>
      </div>

      <div v-if="erreurValidation" class="alerte danger" style="margin-bottom: 1rem;">⚠️ {{ erreurValidation }}</div>
      <div class="navigation-bas">
        <button v-if="etapeActuelle > 1" @click="etapePrecedente" class="btn-nav btn-prev">← Précédent</button><div v-else></div>
        <button v-if="etapeActuelle < totalEtapes" @click="etapeSuivante" class="btn-nav btn-next">Suivant →</button>
      </div>
    </div>

    <!-- ================= CATALOGUE ADMINISTRATEUR (ROUTE CACHÉE) ================= -->
    <section v-else-if="pageActuelle === 'admin'" class="admin-page card">
      <header class="admin-header">
        <div>
          <h1>Administration · Catalogue de prix</h1>
          <p>Les prix enregistrés ici sont partagés par le serveur avec les nouveaux devis.</p>
        </div>
        <div class="admin-actions">
          <a href="/">← Retour au configurateur</a>
          <button v-if="adminAuthentifie" class="btn-retour" @click="deconnecterAdmin">Se déconnecter</button>
        </div>
      </header>

      <form v-if="!adminAuthentifie" class="admin-login" @submit.prevent="connecterAdmin">
        <h2>Connexion administrateur</h2>
        <p>La connexion est vérifiée par le serveur ; le mot de passe n’est pas enregistré dans le navigateur.</p>
        <label for="admin-password">Mot de passe</label>
        <input id="admin-password" v-model="motDePasseAdmin" type="password" autocomplete="current-password" required />
        <button class="btn-telecharger" type="submit" :disabled="chargementAdmin">
          {{ chargementAdmin ? 'Connexion…' : 'Ouvrir le catalogue' }}
        </button>
      </form>

      <form v-else class="admin-catalogue" @submit.prevent="enregistrerCatalogue">
        <h2>Équipements principaux</h2>
        <div class="admin-price-grid">
          <label>Prix d’un panneau solaire (FCFA)
            <input v-model.number="catalogueEdition.prixPanneau" type="number" min="0" step="1" required />
          </label>
          <label>Prix du stockage par kWh (FCFA)
            <input v-model.number="catalogueEdition.prixBatterieKwh" type="number" min="0" step="1" required />
          </label>
          <label>Prix onduleur par kVA (FCFA)
            <input v-model.number="catalogueEdition.prixOnduleurKVA" type="number" min="0" step="1" required />
          </label>
        </div>

        <h2>Matériels annexes</h2>
        <div class="table-responsive">
          <table class="tableau-equipements admin-table">
            <thead><tr><th>Article</th><th>Prix unitaire (FCFA)</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(materiel, index) in catalogueEdition.materiels" :key="materiel.id">
                <td><input v-model.trim="materiel.nom" type="text" maxlength="120" required /></td>
                <td><input v-model.number="materiel.prixUnitaire" type="number" min="0" step="1" required /></td>
                <td><button type="button" class="btn-suppr" :aria-label="`Supprimer ${materiel.nom}`" @click="catalogueEdition.materiels.splice(index, 1)">✖</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" class="btn-ajouter" @click="ajouterArticleCatalogue">+ Ajouter un matériel</button>
        <button class="btn-telecharger admin-save" type="submit" :disabled="chargementAdmin">
          {{ chargementAdmin ? 'Enregistrement…' : 'Enregistrer le catalogue' }}
        </button>
      </form>
    </section>

    <!-- ================= MODALE ÉTUDE TECHNIQUE ================= -->
    <div v-if="afficherEtudeTechnique" class="modal-overlay" @click.self="afficherEtudeTechnique = false">
      <div class="modal-contenu">
        <header class="modal-header">
          <h2>📑 Étude Technique - CheffBuild Solar</h2>
          <div style="display:flex; gap:10px;">
            <button @click="genererEtudeTechnique" class="btn-pdf-tech">📥 Exporter PDF</button>
            <button @click="afficherEtudeTechnique = false" class="btn-close">✖</button>
          </div>
        </header>
        <div class="modal-tabs">
          <button :class="{ active: ongletActif === 'synthese' }" @click="ongletActif = 'synthese'">Synthèse</button>
          <button :class="{ active: ongletActif === 'strings' }" @click="ongletActif = 'strings'">Strings</button>
          <button :class="{ active: ongletActif === 'batterie' }" @click="ongletActif = 'batterie'">Batteries</button>
          <button :class="{ active: ongletActif === 'cablage' }" @click="ongletActif = 'cablage'">Câblage</button>
          <button :class="{ active: ongletActif === 'protections' }" @click="ongletActif = 'protections'">Protections</button>
          <button :class="{ active: ongletActif === 'schema' }" @click="ongletActif = 'schema'">Schéma</button>
          <button :class="{ active: ongletActif === 'alertes' }" @click="ongletActif = 'alertes'">Alertes ({{ alertes.length }})</button>
        </div>
        <div class="modal-body" v-if="dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur && cablageDC && protections && strings">
          
          <div v-if="ongletActif === 'synthese'">
            <div class="tech-section">
              <h3>Résumé global</h3>
              <table class="tech-table">
                <tr><td>Consommation</td><td>{{ bilan.consoJourWh }} Wh/j</td></tr>
                <tr><td>Puissance crête</td><td>{{ dimensionnementPV.puissanceCreteKw }} kWc</td></tr>
                <tr><td>Stockage</td><td>{{ dimensionnementBatterie.capaciteKwh }} kWh</td></tr>
                <tr><td>Onduleur</td><td>{{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA</td></tr>
              </table>
            </div>
          </div>
          <div v-if="ongletActif === 'strings'">
            <div class="tech-section">
              <h3>Configuration PV</h3>
              <table class="tech-table">
                <tr><td>Panneaux totaux</td><td>{{ dimensionnementPV.nombrePanneaux }}</td></tr>
                <tr><td>Panneaux en série</td><td>{{ strings.panneauxParSerie }}</td></tr>
                <tr><td>Chaînes parallèles</td><td>{{ strings.nombreChaines }}</td></tr>
                <tr><td>Tension Voc</td><td>{{ strings.tensionVocString }} V</td></tr>
              </table>
            </div>
          </div>
          <div v-if="ongletActif === 'batterie'">
            <div class="tech-section">
              <h3>Stockage</h3>
              <table class="tech-table">
                <tr><td>Autonomie</td><td>{{ store.paramSys.joursAutonomie }} j</td></tr>
                <tr><td>Technologie</td><td>{{ profilsBatteries[store.typeBatterie].nom }}</td></tr>
                <tr><td>Nombre de batteries</td><td>{{ dimensionnementBatterie.nombreBatteries ?? 'Configuration incompatible' }}</td></tr>
                <tr><td>DoD</td><td>{{ store.paramSys.profondeurDecharge }} %</td></tr>
                <tr><td>Tension</td><td>{{ store.paramSite.tensionSysteme }} V</td></tr>
                <tr><td>Capacité requise</td><td>{{ dimensionnementBatterie.capaciteKwh }} kWh ({{ dimensionnementBatterie.capaciteAh }} Ah)</td></tr>
                <tr><td>Montage</td><td>{{ dimensionnementBatterie.batteriesEnSerie }} en série × {{ dimensionnementBatterie.chainesParalleles }} en parallèle</td></tr>
              </table>
            </div>
          </div>
          <div v-if="ongletActif === 'cablage'">
            <div class="tech-section">
              <h3>Câblage</h3>
              <table class="tech-table">
                <tr><td>Longueur DC</td><td>{{ store.paramSite.longueurCableDC }} m</td></tr>
                <tr><td>Section DC</td><td>{{ cablageDC.sectionMm2 }} mm²</td></tr>
                <tr><td>Section AC</td><td>{{ cablageAC?.sectionMm2 }} mm²</td></tr>
              </table>
            </div>
          </div>
          <div v-if="ongletActif === 'protections'">
            <div class="tech-section">
              <h3>Protections</h3>
              <table class="tech-table">
                <tr><td>Disjoncteur AC</td><td>{{ protections.disjoncteurAC }}</td></tr>
                <tr><td>Fusible DC</td><td>{{ protections.fusibleDC }}</td></tr>
              </table>
            </div>
          </div>
          
          <!-- ONGLET SCHEMA -->
          <div v-if="ongletActif === 'schema'">
            <div class="tech-section">
              <h3>Schéma électrique {{ store.modeSchema }}</h3>
              <div class="schema-mode" role="group" aria-label="Type de schéma">
                <button :class="{ active: store.modeSchema === 'unifilaire' }" @click="store.modeSchema = 'unifilaire'">Unifilaire</button>
                <button :class="{ active: store.modeSchema === 'multifilaire' }" @click="store.modeSchema = 'multifilaire'">Multifilaire</button>
              </div>
              <p class="schema-help">Modifiez les charges ci-dessous ou dans le bilan énergétique : le schéma et l’export PDF seront actualisés automatiquement.</p>
              <div class="schema-editeur">
                <div v-for="(equipement, index) in store.equipements" :key="index" class="schema-equipement">
                  <input v-model="equipement.nom" aria-label="Nom de l’équipement" placeholder="Nom de l’équipement" />
                  <label>Qté <input v-model.number="equipement.quantite" type="number" min="1" /></label>
                  <label>W <input v-model.number="equipement.puissance" type="number" min="0" /></label>
                  <button @click="supprimerEquipement(index)" class="btn-suppr" :aria-label="`Supprimer ${equipement.nom || 'cet équipement'}`">✖</button>
                </div>
                <button @click="ajouterEquipement" class="btn-ajouter">+ Ajouter une charge au schéma</button>
              </div>
              <SchemaElectrique
                :mode="store.modeSchema"
                :panneaux="dimensionnementPV.nombrePanneaux"
                :puissance-panneau="store.paramSys.puissancePanneau"
                :strings="`${strings.panneauxParSerie}S × ${strings.nombreChaines}P`"
                :tension-d-c="store.paramSite.tensionSysteme"
                :section-d-c="cablageDC.sectionMm2"
                :fusible-d-c="protections.fusibleDC"
                :capacite-batterie="dimensionnementBatterie.capaciteKwh"
                :onduleur="dimensionnementOnduleur.puissanceRequiseKVA"
                :disjoncteur-a-c="protections.disjoncteurAC"
                :tension-a-c="tensionAC"
                :section-a-c="cablageAC?.sectionMm2 || 0"
                :equipements="store.equipements"
                :groupe-actif="store.aGroupeElectrogene"
                :puissance-groupe="store.puissanceGroupeKVA"
              />
            </div>
          </div>

          <div v-if="ongletActif === 'alertes'">
            <div class="tech-section">
              <h3>Contrôles</h3>
              <div v-if="alertes.length === 0" class="alerte success">✔ Aucun problème.</div>
              <div v-for="(alerte, i) in alertes" :key="i" :class="['alerte', alerte.type]">⚠️ {{ alerte.msg }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= MODÈLE PDF DEVIS ================= -->
    <div id="modele-pdf" class="pdf-container">
      <header class="pdf-header"><h1>CheffBuild Solar</h1><p>Devis estimatif détaillé</p><p class="pdf-date">Émis le : {{ new Date().toLocaleDateString('fr-FR') }}</p></header>
      <div class="pdf-section">
        <h2>1. Informations du projet</h2>
        <table class="pdf-info-table">
          <tr><td><strong>Type de système :</strong></td><td>{{ store.systemeSelectionne }}</td></tr>
          <tr v-if="store.systemeSelectionne === 'hybride'"><td><strong>Priorité :</strong></td><td>{{ store.prioriteSysteme }}</td></tr>
          <tr><td><strong>Énergie journalière :</strong></td><td>{{ bilan.consoJourWh }} Wh/jour</td></tr>
          <tr><td><strong>Tension bus DC :</strong></td><td>{{ store.paramSite.tensionSysteme }} V</td></tr>
        </table>
      </div>
      <div class="pdf-section">
        <h2>2. Nomenclature et Chiffrage</h2>
        <table class="pdf-table">
          <thead><tr><th>Désignation</th><th>Qté</th><th>Prix Unitaire</th><th>Total</th></tr></thead>
          <tbody>
            <tr><td>Panneaux solaires {{ store.paramSys.puissancePanneau }} Wc</td><td style="text-align:center;">{{ dimensionnementPV?.nombrePanneaux }}</td><td style="text-align:right;">{{ formatFCFA(store.prixPanneau) }}</td><td style="text-align:right;">{{ formatFCFA(budget?.panneaux || 0) }}</td></tr>
            <tr>
              <td>{{ profilsBatteries[store.typeBatterie].nom }} ({{ dimensionnementBatterie?.capaciteKwh }} kWh)</td>
              <td style="text-align:center;">{{ dimensionnementBatterie?.nombreBatteries ?? 0 }}</td>
              <td style="text-align:right;">{{ formatFCFA(dimensionnementBatterie?.nombreBatteries ? (budget?.batteries || 0) / dimensionnementBatterie.nombreBatteries : 0) }}</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.batteries || 0) }}</td>
            </tr>
            <tr><td>Onduleur hybride {{ dimensionnementOnduleur?.puissanceRequiseKVA }} kVA</td><td style="text-align:center;">1</td><td style="text-align:right;">{{ formatFCFA(budget?.onduleur || 0) }}</td><td style="text-align:right;">{{ formatFCFA(budget?.onduleur || 0) }}</td></tr>
            <tr v-for="(mat, index) in store.materiels" :key="index"><td>{{ mat.nom || 'Désignation' }}</td><td style="text-align:center;">{{ mat.quantite }}</td><td style="text-align:right;">{{ formatFCFA(mat.prixUnitaire) }}</td><td style="text-align:right;">{{ formatFCFA(mat.prixUnitaire * mat.quantite) }}</td></tr>
          </tbody>
          <tfoot><tr class="pdf-total"><td colspan="3"><strong>MONTANT TOTAL ESTIMÉ (FCFA)</strong></td><td style="text-align:right;"><strong>{{ formatFCFA(budget?.total || 0) }}</strong></td></tr></tfoot>
        </table>
      </div>
      <div class="pdf-section"><h2>3. Réserves</h2><p class="pdf-note">Cette estimation est une pré-étude non contractuelle. Les quantités et les prix sont donnés à titre indicatif et doivent être validés sur site.</p></div>
    </div>

    <!-- ================= MODÈLE PDF ÉTUDE TECHNIQUE ================= -->
    <div id="modele-etude-tech" class="pdf-container">
      <h1>Étude Technique Photovoltaïque</h1>
      <p style="text-align:center;">Émis le : {{ new Date().toLocaleDateString('fr-FR') }}</p>
      <h2>1. Hypothèses</h2>
      <table class="tech-table">
        <tr><td>Type de système</td><td>{{ store.systemeSelectionne }}</td></tr>
        <tr><td>Ensoleillement</td><td>{{ store.paramSite.heuresEnsoleillement }} h/j</td></tr>
        <tr><td>Tension Bus DC</td><td>{{ store.paramSite.tensionSysteme }} V</td></tr>
      </table>
      <h2>2. Dimensionnement</h2>
      <table class="tech-table">
        <tr><td>Énergie journalière</td><td>{{ bilan.consoJourWh }} Wh/j</td></tr>
        <tr><td>Puissance crête PV</td><td>{{ dimensionnementPV?.puissanceCreteKw }} kWc</td></tr>
        <tr><td>Strings</td><td>{{ strings?.panneauxParSerie }} S x {{ strings?.nombreChaines }} P</td></tr>
        <tr><td>Technologie batterie</td><td>{{ profilsBatteries[store.typeBatterie].nom }}</td></tr>
        <tr><td>Batteries</td><td>{{ dimensionnementBatterie?.nombreBatteries ?? 'Configuration incompatible' }} unités · {{ dimensionnementBatterie?.capaciteKwh }} kWh ({{ dimensionnementBatterie?.capaciteAh }} Ah)</td></tr>
        <tr><td>Montage batteries</td><td>{{ dimensionnementBatterie?.batteriesEnSerie }} en série × {{ dimensionnementBatterie?.chainesParalleles }} en parallèle</td></tr>
        <tr><td>Onduleur</td><td>{{ dimensionnementOnduleur?.puissanceRequiseKVA }} kVA</td></tr>
      </table>
      <h2>3. Câblage et Protections</h2>
      <table class="tech-table">
        <tr><td>Section DC</td><td>{{ cablageDC?.sectionMm2 }} mm²</td></tr>
        <tr><td>Section AC</td><td>{{ cablageAC?.sectionMm2 }} mm²</td></tr>
        <tr><td>Disjoncteur AC</td><td>{{ protections?.disjoncteurAC }}</td></tr>
        <tr><td>Fusible DC</td><td>{{ protections?.fusibleDC }}</td></tr>
      </table>
      <h2>4. Alertes</h2>
      <div v-if="alertes.length === 0" class="alerte success">Aucune alerte.</div>
      <div v-for="(alerte, i) in alertes" :key="i" :class="['alerte', alerte.type]">{{ alerte.msg }}</div>
      <div class="schema-pdf">
        <h2>5. Schéma électrique de l’installation</h2>
        <SchemaElectrique
          :mode="store.modeSchema"
          :panneaux="dimensionnementPV?.nombrePanneaux || 0"
          :puissance-panneau="store.paramSys.puissancePanneau"
          :strings="`${strings?.panneauxParSerie || 0}S × ${strings?.nombreChaines || 0}P`"
          :tension-d-c="store.paramSite.tensionSysteme"
          :section-d-c="cablageDC?.sectionMm2 || 0"
          :fusible-d-c="protections?.fusibleDC || '—'"
          :capacite-batterie="dimensionnementBatterie?.capaciteKwh || '0'"
          :onduleur="dimensionnementOnduleur?.puissanceRequiseKVA || '0'"
          :disjoncteur-a-c="protections?.disjoncteurAC || '—'"
          :tension-a-c="tensionAC"
          :section-a-c="cablageAC?.sectionMm2 || 0"
          :equipements="store.equipements"
          :groupe-actif="store.aGroupeElectrogene"
          :puissance-groupe="store.puissanceGroupeKVA"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- Styles globaux --- */
.app-container { max-width: 1000px; margin: 0 auto; padding: 2rem; font-family: system-ui, -apple-system, sans-serif; color: var(--text-color); min-height: 100vh; }
.stepper-top { display: flex; justify-content: space-between; margin-bottom: 1rem; }
.hero { text-align: center; padding: 3rem 1rem; background: #0A2540; color: white; border-radius: 12px; margin-bottom: 3rem; }
.hero h1 { color: #00C896; font-size: 2.5rem; margin-bottom: 1rem; }
.hero p { font-size: 1.2rem; color: #cbd5e1; }
.grille-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
.carte-option { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
.carte-option:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); border-color: #0066FF; }
.icone { font-size: 3rem; margin-bottom: 1rem; }
.carte-option h3 { font-size: 1.1rem; color: var(--text-color); margin-bottom: 0.5rem; }
.carte-option p { color: #888; font-size: 0.9rem; flex-grow: 1; margin-bottom: 1rem; }
.btn-choisir { background: #0066FF; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer; }
.carte-option:hover .btn-choisir { background: #004ccc; }

/* --- Stepper --- */
.stepper { display: flex; flex-direction: column; margin-bottom: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem; }
.btn-retour { background: none; border: 1px solid var(--border-color); color: var(--text-color); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
.steps-container { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.step-item { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; opacity: 0.5; }
.step-item.active { opacity: 1; font-weight: bold; color: #0066FF; }
.step-item.done { opacity: 1; color: #00C896; }
.step-circle { width: 30px; height: 30px; border-radius: 50%; background: var(--border-color); display: flex; align-items: center; justify-content: center; }
.step-item.active .step-circle { background: #0066FF; color: white; }
.step-item.done .step-circle { background: #00C896; color: white; }

/* --- Cartes --- */
.card { background: var(--card-bg); border-radius: 8px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid var(--border-color); }
.card h2 { margin-top: 0; font-size: 1.4rem; border-bottom: 2px solid #0066FF; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: var(--text-color); }
.help-text { font-size: 0.95rem; color: #888; margin-bottom: 1.5rem; font-style: italic; }

/* --- Formulaires & Tableaux --- */
.form-group { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
.select-input { padding: 0.6rem; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--text-color); }
.table-responsive { overflow-x: auto; }
.tableau-equipements { width: 100%; border-collapse: collapse; margin-bottom: 1rem; min-width: 700px; }
.tableau-equipements th { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 2px solid var(--border-color); font-size: 0.9rem; color: var(--text-color); }
.tableau-equipements td { padding: 0.5rem; border-bottom: 1px solid var(--border-color); }
.tableau-equipements input, .tableau-equipements select { width: 100%; padding: 0.5rem; border: 1px solid var(--input-border); border-radius: 4px; font-size: 0.9rem; background: var(--input-bg); color: var(--text-color); }
.input-error { border-color: #e74c3c !important; background-color: rgba(231, 76, 60, 0.1) !important; }
.text-right { text-align: right; font-weight: bold; font-size: 0.9rem; white-space: nowrap; }
.btn-ajouter { background: var(--bg-color); border: 1px dashed var(--border-color); color: var(--text-color); padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 0.5rem; transition: background 0.2s; }
.btn-ajouter:hover { background: var(--border-color); }
.btn-suppr { background: #ffebee; color: #c0392b; border: none; padding: 0.4rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; }

/* --- Résultats & Encarts --- */
.total-encart { background: var(--bg-color); padding: 1rem; border-radius: 6px; margin-top: 1rem; border: 1px solid var(--border-color); }
.total-encart p { margin: 0.5rem 0; }
.grid-params { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
@media (max-width: 768px) { .grid-params { grid-template-columns: 1fr; } }

.resultats-dimensionnement { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.res-box { flex: 1; background: var(--bg-color); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-width: 150px; }
.res-box span { font-size: 0.9rem; color: #888; text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem; }
.res-box strong { font-size: 1.8rem; color: #2980b9; }
.res-box small { color: #888; margin-top: 0.5rem; }

/* --- Résumé & Budget --- */
.recapitulatif { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
@media (max-width: 768px) { .recapitulatif { grid-template-columns: 1fr; } }
.bloc-recap { background: var(--bg-color); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); }
.bloc-recap h3 { margin-top: 0; color: var(--text-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
.bloc-recap p { margin: 0.5rem 0; font-size: 0.95rem; }
.budget-final { background: rgba(34, 197, 94, 0.1); border-color: #bbf7d0; }
.ligne-budget { display: flex; justify-content: space-between; margin-bottom: 0.7rem; font-size: 0.95rem; }
.total-budget { display: flex; justify-content: space-between; margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed #22c55e; font-size: 1.3rem; font-weight: bold; color: #16a34a; }

.actions-finales { text-align: center; margin-top: 2rem; }
.btn-telecharger { background: #27ae60; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 6px rgba(39, 174, 96, 0.3); }
.btn-telecharger:hover { background: #219150; transform: translateY(-2px); }

/* --- Navigation Bas de Page --- */
.navigation-bas { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); }
.btn-nav { padding: 0.8rem 1.5rem; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.2s; border: none; }
.btn-prev { background: var(--bg-color); color: var(--text-color); border: 1px solid var(--border-color); }
.btn-next { background: #2980b9; color: white; }

/* --- Alertes --- */
.alertes-container { margin-bottom: 1.5rem; }
.alerte { padding: 1rem; border-radius: 6px; margin-bottom: 0.5rem; font-weight: 500; }
.alerte.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.alerte.warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.alerte.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

/* --- Modale Technique --- */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-contenu {
  background-color: var(--modal-bg) !important;
  color: var(--text-color) !important;
  border-radius: 12px; 
  width: 100%; 
  max-width: 800px; 
  max-height: 90vh; 
  display: flex; 
  flex-direction: column; 
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); /* Ombre plus forte pour bien séparer */
  overflow: hidden;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: #0A2540; color: white; }
.modal-header h2 { margin: 0; font-size: 1.25rem; }
.btn-close { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
.btn-pdf-tech { background: #27ae60; border: none; color: white; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-right: 1rem; font-weight: bold;}
.modal-tabs { display: flex; border-bottom: 1px solid var(--border-color); overflow-x: auto; }
.modal-tabs button { padding: 1rem 1.5rem; background: none; border: none; cursor: pointer; font-weight: 600; color: #888; border-bottom: 3px solid transparent; white-space: nowrap; }
.modal-tabs button.active { color: #0066FF; border-bottom-color: #0066FF; background-color: var(--bg-color); }
.modal-body { padding: 1.5rem; overflow-y: auto; }
.tech-section { margin-bottom: 2rem; }
.tech-section h3 { color: #0066FF; font-size: 1.1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
.tech-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.tech-table td { padding: 0.5rem; border-bottom: 1px solid var(--border-color); color: var(--text-color);}
.tech-table td:first-child { font-weight: 600; color: #888; width: 50%; }
.btn-tech { background: #0A2540; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; margin-top: 1rem; cursor: pointer; font-weight: bold; width: 100%; }
.admin-page { max-width: 900px; margin: 3rem auto; }
.admin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; padding-bottom: 1rem; }
.admin-header h1 { margin-top: 0; color: var(--text-color); }
.admin-header p, .admin-login p { color: #64748b; }
.admin-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.admin-actions a { color: #0066FF; white-space: nowrap; }
.admin-login { display: grid; gap: 0.8rem; max-width: 480px; }
.admin-login h2, .admin-catalogue h2 { color: var(--text-color); }
.admin-login input, .admin-price-grid input, .admin-table input { padding: 0.65rem; border-radius: 5px; }
.admin-login .btn-telecharger { margin-top: 0.5rem; }
.admin-price-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.admin-price-grid label { display: grid; gap: 0.5rem; }
.admin-save { display: block; margin: 1.5rem 0 0 auto; }
.admin-page button:disabled { opacity: 0.65; cursor: wait; }
.schema-mode { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.schema-mode button { background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-color); padding: 0.5rem 0.8rem; border-radius: 6px; cursor: pointer; }
.schema-mode button.active { background: #0066FF; color: white; border-color: #0066FF; }
.schema-help { color: #64748b; font-size: 0.9rem; }
.schema-editeur { display: grid; gap: 0.5rem; margin: 1rem 0; }
.schema-equipement { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(90px, 0.35fr) minmax(90px, 0.35fr) auto; gap: 0.5rem; align-items: center; }
.schema-equipement input { width: 100%; min-width: 0; padding: 0.5rem; border-radius: 4px; }
.schema-equipement label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; }
.schema-equipement label input { width: 65px; }
@media (max-width: 600px) {
  .schema-equipement { grid-template-columns: 1fr 1fr; }
  .admin-header { flex-direction: column; }
}

/* --- Modèle PDF (Caché de l'écran) --- */
.pdf-container { display: none; }

/* --- Animation --- */
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>