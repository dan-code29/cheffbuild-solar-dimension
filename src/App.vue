<script setup lang="ts">
import { ref, computed } from 'vue'
import { SolarEngine, type Equipement, type ParametresSite, type ParametresSysteme } from './logic/solarEngine'

// ============================================================================
// 1. NAVIGATION GLOBALE
// ============================================================================
const pageActuelle = ref<'accueil' | 'configurateur'>('accueil')
const etapeActuelle = ref<number>(1)
const totalEtapes = 5
const nomsEtapes = ["Contexte", "Bilan", "Dimensionnement", "Matériel", "Résumé"]
const systemeSelectionne = ref<string | null>('hybride')
const prioriteSysteme = ref<'solaire' | 'batterie' | 'reseau'>('solaire')

const optionsSystemes = [
  { id: 'equipements', titre: 'Quelques équipements', description: 'Alimentez uniquement des appareils spécifiques.', icone: '🔌', usage: 'Idéal petit budget' },
  { id: 'hybride', titre: 'Système hybride', description: 'Solaire + réseau + batterie.', icone: '🔄', usage: 'Idéal maison moderne' },
  { id: 'personnalise', titre: 'Configurer tout moi-même', description: 'Saisie libre de vos besoins.', icone: '🛠️', usage: 'Mode expert / technicien' }
]

// ============================================================================
// 2. ÉTATS DES DONNÉES
// ============================================================================
const paramSite = ref<ParametresSite>({ 
  heuresEnsoleillement: 5, tensionSysteme: 48, longueurCableDC: 15, longueurCableAC: 10 
})

const paramSys = ref<ParametresSysteme>({ 
  puissancePanneau: 550, rendementSysteme: 75, joursAutonomie: 1, profondeurDecharge: 80, rendementBatterie: 95 
})

const tensionAC = ref(230)

const equipements = ref<Equipement[]>([
  { nom: 'Ampoules LED', quantite: 6, puissance: 10, puissanceDemarrage: 10, heures: 5 },
  { nom: 'Réfrigérateur', quantite: 1, puissance: 150, puissanceDemarrage: 450, heures: 8 }
])

type Materiel = { nom: string, quantite: number, prixUnitaire: number }
const materiels = ref<Materiel[]>([
  { nom: 'Régulateur MPPT', quantite: 1, prixUnitaire: 150000 },
  { nom: 'Rails de fixation', quantite: 1, prixUnitaire: 50000 },
  { nom: 'Coffret de protection AC/DC', quantite: 1, prixUnitaire: 75000 }
])

const prixPanneau = ref<number>(100000)
const prixBatterieKwh = ref<number>(200000)
const prixOnduleurKVA = ref<number>(150000)

const afficherEtudeTechnique = ref(false)
const ongletActif = ref('synthese')
const erreurValidation = ref<string | null>(null)

// ============================================================================
// 3. FONCTIONS DE NAVIGATION
// ============================================================================
const choisirSysteme = (id: string) => { 
  systemeSelectionne.value = id
  pageActuelle.value = 'configurateur'
  etapeActuelle.value = 1 
}
const revenirAccueil = () => { pageActuelle.value = 'accueil' }
const allerAEtape = (num: number) => { etapeActuelle.value = num }

const ajouterEquipement = () => equipements.value.push({ nom: '', quantite: 1, puissance: 0, puissanceDemarrage: 0, heures: 0 })
const supprimerEquipement = (index: number) => equipements.value.splice(index, 1)

const ajouterMateriel = () => materiels.value.push({ nom: '', quantite: 1, prixUnitaire: 0 })
const supprimerMateriel = (index: number) => materiels.value.splice(index, 1)

const validerEtape = () => {
  erreurValidation.value = null
  if (etapeActuelle.value === 2) {
    if (equipements.value.length === 0) {
      erreurValidation.value = "Veuillez ajouter au moins un équipement."
      return false
    }
    const invalide = equipements.value.some(eq => eq.puissance <= 0 || eq.heures <= 0 || eq.nom.trim() === '')
    if (invalide) {
      erreurValidation.value = "Veuillez remplir tous les champs (Nom, Puissance > 0, Durée > 0)."
      return false
    }
  }
  return true
}

const etapeSuivante = () => { 
  if (validerEtape() && etapeActuelle.value < totalEtapes) etapeActuelle.value++ 
}

const etapePrecedente = () => { 
  if (etapeActuelle.value > 1) { erreurValidation.value = null; etapeActuelle.value-- }
}

// ============================================================================
// 4. CALCULS REACTIFS
// ============================================================================
const bilan = computed(() => SolarEngine.calculerBilan(equipements.value))
const dimensionnementPV = computed(() => SolarEngine.calculerPV(bilan.value.consoJourWh, paramSite.value, paramSys.value))
const dimensionnementBatterie = computed(() => SolarEngine.calculerBatterie(bilan.value.consoJourWh, paramSite.value, paramSys.value))
const dimensionnementOnduleur = computed(() => SolarEngine.calculerOnduleur(bilan.value.puissanceDemarrageMaxW))
const alertes = computed(() => SolarEngine.verifierInstallation(dimensionnementPV.value, dimensionnementBatterie.value, dimensionnementOnduleur.value, paramSite.value))

const cablageDC = computed(() => {
  if (!dimensionnementPV.value) return null
  const courant = (parseFloat(dimensionnementPV.value.puissanceCreteKw) * 1000) / paramSite.value.tensionSysteme
  return SolarEngine.calculerSectionCable(paramSite.value.longueurCableDC, courant, paramSite.value.tensionSysteme)
})

const cablageAC = computed(() => {
  if (!dimensionnementOnduleur.value) return null
  const puissanceVA = parseFloat(dimensionnementOnduleur.value.puissanceRequiseVA.toString())
  return SolarEngine.calculerCableAC(puissanceVA, tensionAC.value, paramSite.value.longueurCableAC)
})

const protections = computed(() => {
  if (!dimensionnementOnduleur.value || !dimensionnementPV.value) return null
  const puissanceVA = parseFloat(dimensionnementOnduleur.value.puissanceRequiseVA.toString())
  const courantPV = (parseFloat(dimensionnementPV.value.puissanceCreteKw) * 1000) / paramSite.value.tensionSysteme
  return SolarEngine.calculerProtections(puissanceVA, tensionAC.value, courantPV)
})

const strings = computed(() => {
  if (!dimensionnementPV.value) return null
  return SolarEngine.calculerStrings(dimensionnementPV.value.nombrePanneaux, paramSite.value.tensionSysteme)
})

const budget = computed(() => {
  if (!dimensionnementPV.value || !dimensionnementBatterie.value || !dimensionnementOnduleur.value) return null
  const coutPanneaux = dimensionnementPV.value.nombrePanneaux * prixPanneau.value
  const coutBatteries = Math.ceil(parseFloat(dimensionnementBatterie.value.capaciteKwh) * 10) / 10 * prixBatterieKwh.value
  const coutOnduleur = Math.max(300000, parseFloat(dimensionnementOnduleur.value.puissanceRequiseKVA) * prixOnduleurKVA.value)
  let coutMat = 0
  materiels.value.forEach(m => { coutMat += (m.quantite * m.prixUnitaire) })
  return { panneaux: coutPanneaux, batteries: coutBatteries, onduleur: coutOnduleur, materiels: coutMat, total: coutPanneaux + coutBatteries + coutOnduleur + coutMat }
})

// ============================================================================
// 5. OUTILS (Formatage, Export PDF via impression)
// ============================================================================
const formatFCFA = (valeur: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(valeur) + ' FCFA'
}

const genererDevis = () => {
  if (!budget.value) return

  // On récupère le contenu HTML du modèle
  const modeleHTML = document.getElementById('modele-pdf')?.innerHTML
  if (!modeleHTML) return

  // On ouvre une nouvelle fenêtre
  const fenetre = window.open('', '_blank')
  if (!fenetre) {
    alert("Veuillez autoriser les pop-ups pour générer le devis.")
    return
  }

  // On écrit le contenu avec des styles d'impression propres
  fenetre.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Devis CheffBuild Solar</title>
      <style>
        body { font-family: Arial, sans-serif; color: #000; padding: 20px; max-width: 800px; margin: 0 auto; }
        .pdf-header { text-align: center; border-bottom: 3px solid #0066FF; padding-bottom: 15px; margin-bottom: 25px; }
        .pdf-header h1 { color: #0A2540; margin: 0; font-size: 28px; }
        .pdf-header p { margin: 5px 0; font-size: 14px; color: #555; }
        .pdf-date { font-size: 12px !important; color: #888 !important; margin-top: 10px !important; }
        .pdf-section { margin-bottom: 25px; }
        .pdf-section h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #0066FF; margin-bottom: 10px; }
        .pdf-info-table { width: 100%; font-size: 13px; margin-bottom: 15px; }
        .pdf-info-table td { padding: 4px 0; }
        .pdf-info-table td:first-child { width: 40%; color: #555; }
        .pdf-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
        .pdf-table th { background-color: #f0f4f8; padding: 10px 8px; border: 1px solid #ccc; text-align: left; }
        .pdf-table td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
        .pdf-table tfoot .pdf-total td { background-color: #e0f2fe; font-size: 14px; padding: 12px 8px; border-top: 2px solid #0066FF; }
        .pdf-note { font-size: 11px; color: #666; line-height: 1.5; margin-bottom: 8px; }
        @media print {
          body { padding: 0; }
          @page { margin: 15mm; }
        }
      </style>
    </head>
    <body>
      ${modeleHTML}
    </body>
    </html>
  `)
  fenetre.document.close()
  
  // On attend le chargement pour lancer l'impression
  fenetre.onload = () => {
    fenetre.focus()
    fenetre.print()
  }
}
</script>

<template>
  <div class="app-container">
    
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
      </main>
    </div>

    <!-- ================= CONFIGURATEUR ================= -->
    <div v-else-if="pageActuelle === 'configurateur'" class="page-configurateur">
      
      <nav class="stepper">
        <button @click="revenirAccueil" class="btn-retour">← Accueil</button>
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
              <label>Ensoleillement : {{ paramSite.heuresEnsoleillement }} h/j</label>
              <input type="range" v-model.number="paramSite.heuresEnsoleillement" min="2" max="8" step="0.5" />
            </div>
            <div class="form-group">
              <label>Tension Bus DC :</label>
              <select v-model.number="paramSite.tensionSysteme" class="select-input">
                <option :value="12">12 V (Petit)</option>
                <option :value="24">24 V (Moyen)</option>
                <option :value="48">48 V (Recommandé)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Longueur câble DC (m) :</label>
              <input type="number" v-model.number="paramSite.longueurCableDC" min="1" class="select-input" />
            </div>
          </div>
          <div class="form-group" v-if="systemeSelectionne === 'hybride'">
            <label>Priorité de fonctionnement :</label>
            <div class="radio-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label><input type="radio" value="solaire" v-model="prioriteSysteme" /> ☀️ Solaire en priorité</label>
              <label><input type="radio" value="batterie" v-model="prioriteSysteme" /> 🔋 Batterie en priorité</label>
              <label><input type="radio" value="reseau" v-model="prioriteSysteme" /> 🔌 Réseau en priorité</label>
            </div>
          </div>
        </section>

        <!-- ÉTAPE 2 -->
        <section v-if="etapeActuelle === 2" class="card fade-in">
          <h2>Étape 2 : Bilan Énergétique</h2>
          <p class="help-text">N'oubliez pas la puissance de démarrage pour les moteurs.</p>
          <div class="table-responsive">
            <table class="tableau-equipements">
              <thead><tr><th>Équipement</th><th>Qté</th><th>Puiss. (W)</th><th>Démarrage (W)</th><th>Durée (h/j)</th><th>Total (Wh/j)</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(eq, index) in equipements" :key="index">
                  <td><input type="text" v-model="eq.nom" /></td>
                  <td><input type="number" v-model.number="eq.quantite" min="1" /></td>
                  <td><input type="number" v-model.number="eq.puissance" min="0" /></td>
                  <td><input type="number" v-model.number="eq.puissanceDemarrage" min="0" /></td>
                  <td><input type="number" v-model.number="eq.heures" min="0" max="24" /></td>
                  <td class="text-right">{{ (eq.puissance * eq.quantite * eq.heures) }} Wh</td>
                  <td><button @click="supprimerEquipement(index)" class="btn-suppr">✖</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button @click="ajouterEquipement" class="btn-ajouter">+ Ajouter</button>
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
              <label>Autonomie : {{ paramSys.joursAutonomie }} jour(s)</label>
              <input type="range" v-model.number="paramSys.joursAutonomie" min="0" max="5" step="0.5" />
            </div>
            <div class="form-group">
              <label>Puissance panneau : {{ paramSys.puissancePanneau }} Wc</label>
              <input type="range" v-model.number="paramSys.puissancePanneau" min="300" max="700" step="10" />
            </div>
          </div>
          <div class="resultats-dimensionnement" v-if="dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur">
            <div class="res-box"><span>Panneaux</span><strong>{{ dimensionnementPV.nombrePanneaux }}</strong><small>{{ dimensionnementPV.puissanceCreteKw }} kWc</small></div>
            <div class="res-box"><span>Batteries</span><strong>{{ dimensionnementBatterie.capaciteKwh }} kWh</strong><small>{{ dimensionnementBatterie.capaciteAh }} Ah</small></div>
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
                <tr v-for="(mat, index) in materiels" :key="index">
                  <td><input type="text" v-model="mat.nom" /></td>
                  <td><input type="number" v-model.number="mat.quantite" min="1" /></td>
                  <td><input type="number" v-model.number="mat.prixUnitaire" min="0" step="1000" /></td>
                  <td class="text-right">{{ formatFCFA(mat.prixUnitaire * mat.quantite) }}</td>
                  <td><button @click="supprimerMateriel(index)" class="btn-suppr">✖</button></td>
                </tr>
              </tbody>
            </table>
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
              <h3>Résumé Technique (Client)</h3>
              <p><strong>Énergie :</strong> {{ bilan.consoJourWh }} Wh/jour</p>
              <p><strong>Panneaux :</strong> {{ dimensionnementPV.nombrePanneaux }} x {{ paramSys.puissancePanneau }}Wc</p>
              <p><strong>Batteries :</strong> {{ dimensionnementBatterie.capaciteKwh }} kWh</p>
              <p><strong>Onduleur :</strong> {{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA</p>
              <p v-if="systemeSelectionne === 'hybride'"><strong>Priorité :</strong> {{ prioriteSysteme }}</p>
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

    <!-- ================= MODALE ÉTUDE TECHNIQUE ================= -->
    <div v-if="afficherEtudeTechnique" class="modal-overlay" @click.self="afficherEtudeTechnique = false">
      <div class="modal-contenu">
        <header class="modal-header">
          <h2>📑 Étude Technique - CheffBuild Solar</h2>
          <button @click="afficherEtudeTechnique = false" class="btn-close">✖</button>
        </header>
        
        <div class="modal-tabs">
          <button :class="{ active: ongletActif === 'synthese' }" @click="ongletActif = 'synthese'">Synthèse</button>
          <button :class="{ active: ongletActif === 'strings' }" @click="ongletActif = 'strings'">Strings</button>
          <button :class="{ active: ongletActif === 'batterie' }" @click="ongletActif = 'batterie'">Batteries</button>
          <button :class="{ active: ongletActif === 'cablage' }" @click="ongletActif = 'cablage'">Câblage</button>
          <button :class="{ active: ongletActif === 'protections' }" @click="ongletActif = 'protections'">Protections</button>
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
                <tr><td>Autonomie</td><td>{{ paramSys.joursAutonomie }} j</td></tr>
                <tr><td>DoD</td><td>{{ paramSys.profondeurDecharge }} %</td></tr>
                <tr><td>Tension</td><td>{{ paramSite.tensionSysteme }} V</td></tr>
                <tr><td>Capacité</td><td>{{ dimensionnementBatterie.capaciteKwh }} kWh ({{ dimensionnementBatterie.capaciteAh }} Ah)</td></tr>
              </table>
            </div>
          </div>
          <div v-if="ongletActif === 'cablage'">
            <div class="tech-section">
              <h3>Câblage</h3>
              <table class="tech-table">
                <tr><td>Longueur DC</td><td>{{ paramSite.longueurCableDC }} m</td></tr>
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

    <!-- ================= MODÈLE PDF CACHÉ ================= -->
    <div id="modele-pdf" class="pdf-container">
      <header class="pdf-header">
        <h1>CheffBuild Solar</h1>
        <p>Devis estimatif détaillé</p>
        <p class="pdf-date">Émis le : {{ new Date().toLocaleDateString('fr-FR') }}</p>
      </header>

      <div class="pdf-section">
        <h2>1. Informations du projet</h2>
        <table class="pdf-info-table">
          <tr><td><strong>Type de système :</strong></td><td>{{ systemeSelectionne }}</td></tr>
          <tr v-if="systemeSelectionne === 'hybride'"><td><strong>Priorité :</strong></td><td>{{ prioriteSysteme }}</td></tr>
          <tr><td><strong>Énergie journalière :</strong></td><td>{{ bilan.consoJourWh }} Wh/jour</td></tr>
          <tr><td><strong>Tension bus DC :</strong></td><td>{{ paramSite.tensionSysteme }} V</td></tr>
        </table>
      </div>

      <div class="pdf-section">
        <h2>2. Nomenclature et Chiffrage</h2>
        <table class="pdf-table">
          <thead><tr><th>Désignation</th><th>Qté</th><th>Prix Unitaire</th><th>Total</th></tr></thead>
          <tbody>
            <tr>
              <td>Panneaux solaires {{ paramSys.puissancePanneau }} Wc</td>
              <td style="text-align:center;">{{ dimensionnementPV?.nombrePanneaux }}</td>
              <td style="text-align:right;">{{ formatFCFA(prixPanneau) }}</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.panneaux || 0) }}</td>
            </tr>
            <tr>
              <td>Stockage batteries ({{ dimensionnementBatterie?.capaciteKwh }} kWh)</td>
              <td style="text-align:center;">1</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.batteries || 0) }}</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.batteries || 0) }}</td>
            </tr>
            <tr>
              <td>Onduleur hybride {{ dimensionnementOnduleur?.puissanceRequiseKVA }} kVA</td>
              <td style="text-align:center;">1</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.onduleur || 0) }}</td>
              <td style="text-align:right;">{{ formatFCFA(budget?.onduleur || 0) }}</td>
            </tr>
            <tr v-for="(mat, index) in materiels" :key="index">
              <td>{{ mat.nom || 'Désignation à préciser' }}</td>
              <td style="text-align:center;">{{ mat.quantite }}</td>
              <td style="text-align:right;">{{ formatFCFA(mat.prixUnitaire) }}</td>
              <td style="text-align:right;">{{ formatFCFA(mat.prixUnitaire * mat.quantite) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="pdf-total">
              <td colspan="3"><strong>MONTANT TOTAL ESTIMÉ (FCFA)</strong></td>
              <td style="text-align:right;"><strong>{{ formatFCFA(budget?.total || 0) }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="pdf-section">
        <h2>3. Réserves</h2>
        <p class="pdf-note">Cette estimation est une pré-étude non contractuelle. Les quantités et les prix sont donnés à titre indicatif et doivent être validés sur site.</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- Styles globaux --- */
.app-container { max-width: 1000px; margin: 0 auto; padding: 2rem; font-family: system-ui, -apple-system, sans-serif; color: #333; min-height: 100vh; }

/* --- Page d'accueil --- */
.hero { text-align: center; padding: 3rem 1rem; background: #0A2540; color: white; border-radius: 12px; margin-bottom: 3rem; }
.hero h1 { color: #00C896; font-size: 2.5rem; margin-bottom: 1rem; }
.hero p { font-size: 1.2rem; color: #cbd5e1; }
.grille-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
.carte-option { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
.carte-option:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); border-color: #0066FF; }
.icone { font-size: 3rem; margin-bottom: 1rem; }
.carte-option h3 { font-size: 1.1rem; color: #0A2540; margin-bottom: 0.5rem; }
.carte-option p { color: #666; font-size: 0.9rem; flex-grow: 1; margin-bottom: 1rem; }
.btn-choisir { background: #0066FF; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer; }
.carte-option:hover .btn-choisir { background: #004ccc; }

/* --- Stepper --- */
.stepper { display: flex; flex-direction: column; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
.btn-retour { align-self: flex-start; background: none; border: 1px solid #ccc; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-bottom: 1rem; }
.steps-container { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.step-item { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; opacity: 0.5; }
.step-item.active { opacity: 1; font-weight: bold; color: #0066FF; }
.step-item.done { opacity: 1; color: #00C896; }
.step-circle { width: 30px; height: 30px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; }
.step-item.active .step-circle { background: #0066FF; color: white; }
.step-item.done .step-circle { background: #00C896; color: white; }

/* --- Cartes --- */
.card { background: white; border-radius: 8px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee; }
.card h2 { margin-top: 0; font-size: 1.4rem; border-bottom: 2px solid #0066FF; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: #0A2540; }
.help-text { font-size: 0.95rem; color: #666; margin-bottom: 1.5rem; font-style: italic; }

/* --- Formulaires & Tableaux --- */
.form-group { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
.select-input { padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; }
.table-responsive { overflow-x: auto; }
.tableau-equipements { width: 100%; border-collapse: collapse; margin-bottom: 1rem; min-width: 700px; }
.tableau-equipements th { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 2px solid #ddd; font-size: 0.9rem; color: #555; }
.tableau-equipements td { padding: 0.5rem; border-bottom: 1px solid #eee; }
.tableau-equipements input { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
.text-right { text-align: right; font-weight: bold; font-size: 0.9rem; white-space: nowrap; }
.btn-ajouter { background: #ecf0f1; border: 1px dashed #bdc3c7; color: #2c3e50; padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 0.5rem; transition: background 0.2s; }
.btn-ajouter:hover { background: #e0e6ed; }
.btn-suppr { background: #ffebee; color: #c0392b; border: none; padding: 0.4rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-suppr:hover { background: #ffcdd2; }

/* --- Résultats & Encarts --- */
.total-encart { background: #e8f4fd; padding: 1rem; border-radius: 6px; margin-top: 1rem; border: 1px solid #bce0fd; }
.total-encart p { margin: 0.5rem 0; }
.grid-params { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
@media (max-width: 768px) { .grid-params { grid-template-columns: 1fr; } }

.resultats-dimensionnement { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.res-box { flex: 1; background: #f8f9fa; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-width: 150px; }
.res-box span { font-size: 0.9rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 0.5rem; }
.res-box strong { font-size: 1.8rem; color: #2980b9; }
.res-box small { color: #94a3b8; margin-top: 0.5rem; }

/* --- Résumé & Budget --- */
.recapitulatif { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
@media (max-width: 768px) { .recapitulatif { grid-template-columns: 1fr; } }
.bloc-recap { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border: 1px solid #eee; }
.bloc-recap h3 { margin-top: 0; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
.bloc-recap p { margin: 0.5rem 0; font-size: 0.95rem; }
.budget-final { background: #f0fdf4; border-color: #bbf7d0; }
.ligne-budget { display: flex; justify-content: space-between; margin-bottom: 0.7rem; font-size: 0.95rem; }
.total-budget { display: flex; justify-content: space-between; margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed #22c55e; font-size: 1.3rem; font-weight: bold; color: #166534; }

.actions-finales { text-align: center; margin-top: 2rem; }
.btn-telecharger { background: #27ae60; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 6px rgba(39, 174, 96, 0.3); }
.btn-telecharger:hover { background: #219150; transform: translateY(-2px); }

/* --- Navigation Bas de Page --- */
.navigation-bas { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee; }
.btn-nav { padding: 0.8rem 1.5rem; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.2s; border: none; }
.btn-prev { background: #ecf0f1; color: #2c3e50; }
.btn-prev:hover { background: #bdc3c7; }
.btn-next { background: #2980b9; color: white; }
.btn-next:hover { background: #1c5980; }

/* --- Alertes --- */
.alertes-container { margin-bottom: 1.5rem; }
.alerte { padding: 1rem; border-radius: 6px; margin-bottom: 0.5rem; font-weight: 500; }
.alerte.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.alerte.warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.alerte.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

/* --- Modale Technique --- */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-contenu { background: white; border-radius: 12px; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden;}
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #eee; background: #0A2540; color: white; }
.modal-header h2 { margin: 0; font-size: 1.25rem; }
.btn-close { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
.modal-tabs { display: flex; border-bottom: 1px solid #eee; overflow-x: auto; }
.modal-tabs button { padding: 1rem 1.5rem; background: none; border: none; cursor: pointer; font-weight: 600; color: #666; border-bottom: 3px solid transparent; white-space: nowrap; }
.modal-tabs button.active { color: #0066FF; border-bottom-color: #0066FF; background-color: #f8f9fa; }
.modal-body { padding: 1.5rem; overflow-y: auto; }
.tech-section { margin-bottom: 2rem; }
.tech-section h3 { color: #0066FF; font-size: 1.1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
.tech-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.tech-table td { padding: 0.5rem; border-bottom: 1px solid #f0f0f0; }
.tech-table td:first-child { font-weight: 600; color: #555; width: 50%; }
.btn-tech { background: #0A2540; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; margin-top: 1rem; cursor: pointer; font-weight: bold; width: 100%; }
.btn-tech:hover { background: #1e3a5f; }

/* --- Modèle PDF (Caché de l'écran) --- */
.pdf-container {
  display: none; /* Caché, il est extrait via JS pour l'impression */
}

/* --- Animations --- */
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>