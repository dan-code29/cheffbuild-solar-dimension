<script setup lang="ts">
import { ref, computed } from 'vue'

// --- Navigation Globale ---
const pageActuelle = ref<'accueil' | 'configurateur'>('accueil')

const optionsSystemes = [
  { id: 'equipements', titre: 'Quelques équipements solaires', description: 'Alimentez uniquement des appareils spécifiques.', icone: '🔌', usage: 'Idéal petit budget / coupures ciblées' },
  { id: 'hybride', titre: 'Système hybride', description: 'Solaire + réseau + batterie.', icone: '🔄', usage: 'Idéal maison moderne avec coupures' },
  { id: 'personnalise', titre: 'Configurer tout moi-même', description: 'Saisie libre de vos besoins.', icone: '🛠️', usage: 'Mode expert / technicien' }
]

const systemeSelectionne = ref<string | null>(null)
const etapeActuelle = ref<number>(1)
const totalEtapes = 5
const nomsEtapes = ["Contexte & Site", "Bilan Énergétique", "Dimensionnement", "Matériel & Câblage", "Résumé & Devis"]

const choisirSysteme = (id: string) => {
  systemeSelectionne.value = id
  pageActuelle.value = 'configurateur'
  etapeActuelle.value = 1
}
const revenirAccueil = () => { pageActuelle.value = 'accueil'; systemeSelectionne.value = null }
const etapeSuivante = () => { if (etapeActuelle.value < totalEtapes) etapeActuelle.value++ }
const etapePrecedente = () => { if (etapeActuelle.value > 1) etapeActuelle.value-- }
const allerAEtape = (num: number) => { etapeActuelle.value = num }

// ==========================================
// ÉTAPE 1 : CONTEXTE & SITE
// ==========================================
const typeToiture = ref('tole')
const heuresEnsoleillement = ref<number>(5)
const tensionSysteme = ref<number>(48) // Bus DC

// ==========================================
// ÉTAPE 2 : BILAN ENERGETIQUE (AMÉLIORÉ)
// ==========================================
type Equipement = { 
  nom: string, 
  quantite: number, 
  puissance: number, // W
  puissanceDemarrage: number, // W (ex: 3x la puissance pour un frigo)
  heures: number 
}

const equipements = ref<Equipement[]>([
  { nom: 'Ampoules LED', quantite: 6, puissance: 10, puissanceDemarrage: 10, heures: 5 },
  { nom: 'Réfrigérateur', quantite: 1, puissance: 150, puissanceDemarrage: 450, heures: 8 }, // Pic x3
  { nom: 'Téléviseur', quantite: 1, puissance: 100, puissanceDemarrage: 100, heures: 4 }
])

const ajouterEquipement = () => equipements.value.push({ nom: '', quantite: 1, puissance: 0, puissanceDemarrage: 0, heures: 0 })
const supprimerEquipement = (index: number) => equipements.value.splice(index, 1)

// Calculs de puissance
const bilanEnergetique = computed(() => {
  let consoJourWh = 0
  let puissanceMaxSimultaneeW = 0
  let puissanceDemarrageMaxW = 0

  equipements.value.forEach(eq => {
    if (eq.puissance > 0 && eq.heures > 0) {
      // Consommation (Wh)
      consoJourWh += (eq.puissance * eq.quantite * eq.heures)
      
      // Puissance nominale totale si tout allume en meme temps (approximation)
      puissanceMaxSimultaneeW += (eq.puissance * eq.quantite)
      
      // Puissance de démarrage (le pic le plus élevé détermine l'onduleur)
      const demarrageTotal = eq.puissanceDemarrage * eq.quantite
      if (demarrageTotal > puissanceDemarrageMaxW) {
        puissanceDemarrageMaxW = demarrageTotal
      }
    }
  })

  return {
    consoJourWh,
    puissanceMaxSimultaneeW,
    puissanceDemarrageMaxW: Math.max(puissanceDemarrageMaxW, puissanceMaxSimultaneeW) // Le plus grand des deux
  }
})

// ==========================================
// ÉTAPE 3 : DIMENSIONNEMENT (SÉPARÉ)
// ==========================================
const puissancePanneau = ref<number>(550)
const rendementSysteme = ref<number>(75) // % (câbles, température, MPPT)
const joursAutonomie = ref<number>(1)
const profondeurDecharge = ref<number>(80) // %
const rendementBatterie = ref<number>(95) // %

// A. Calcul PV
const dimensionnementPV = computed(() => {
  if (bilanEnergetique.value.consoJourWh === 0) return null
  const puissanceRequiseW = bilanEnergetique.value.consoJourWh / (heuresEnsoleillement.value * (rendementSysteme.value / 100))
  const nombrePanneaux = Math.ceil(puissanceRequiseW / puissancePanneau.value)
  return {
    puissanceRequiseW: puissanceRequiseW.toFixed(0),
    nombrePanneaux,
    puissanceCreteKw: ((nombrePanneaux * puissancePanneau.value) / 1000).toFixed(2)
  }
})

// B. Calcul Batteries (Formule pro)
const dimensionnementBatterie = computed(() => {
  if (bilanEnergetique.value.consoJourWh === 0) return null
  // Formule : (Conso * Jours) / (DoD * Rendement Batterie)
  const capaciteRequiseWh = (bilanEnergetique.value.consoJourWh * joursAutonomie.value) / ((profondeurDecharge.value / 100) * (rendementBatterie.value / 100))
  const capaciteKwh = capaciteRequiseWh / 1000
  const capaciteAh = capaciteRequiseWh / tensionSysteme.value
  return {
    capaciteKwh: capaciteKwh.toFixed(1),
    capaciteAh: capaciteAh.toFixed(0)
  }
})

// C. Calcul Onduleur
const dimensionnementOnduleur = computed(() => {
  if (bilanEnergetique.value.puissanceMaxSimultaneeW === 0) return null
  // L'onduleur doit pouvoir supporter la puissance de démarrage, avec une petite marge de 20%
  const puissanceOnduleurRequiseVA = bilanEnergetique.value.puissanceDemarrageMaxW * 1.2
  return {
    puissanceRequiseVA: puissanceOnduleurRequiseVA.toFixed(0),
    puissanceRequiseKVA: (puissanceOnduleurRequiseVA / 1000).toFixed(1)
  }
})

// ==========================================
// ÉTAPE 4 : MATERIEL ANNEXE & BUDGET
// ==========================================
type Materiel = { nom: string, quantite: number, prixUnitaire: number }
const materiels = ref<Materiel[]>([
  { nom: 'Régulateur MPPT', quantite: 1, prixUnitaire: 150000 },
  { nom: 'Rails de fixation', quantite: 1, prixUnitaire: 50000 },
  { nom: 'Câbles DC & AC (mètres)', quantite: 20, prixUnitaire: 2000 },
  { nom: 'Coffret de protection AC/DC', quantite: 1, prixUnitaire: 75000 }
])

const ajouterMateriel = () => materiels.value.push({ nom: '', quantite: 1, prixUnitaire: 0 })
const supprimerMateriel = (index: number) => materiels.value.splice(index, 1)

const prixPanneau = ref<number>(100000)
const prixBatterieKwh = ref<number>(200000)
const prixOnduleurBase = ref<number>(350000) // Prix de base, sera ajusté selon la puissance

const budget = computed(() => {
  if (!dimensionnementPV.value || !dimensionnementBatterie.value || !dimensionnementOnduleur.value) return null

  const coutPanneaux = dimensionnementPV.value.nombrePanneaux * prixPanneau.value
  const coutBatteries = Math.ceil(parseFloat(dimensionnementBatterie.value.capaciteKwh) * 10) / 10 * prixBatterieKwh.value
  
  // Le prix de l'onduleur augmente avec la puissance requise (approximation)
  const puissanceKVA = parseFloat(dimensionnementOnduleur.value.puissanceRequiseKVA)
  const coutOnduleur = Math.max(prixOnduleurBase.value, puissanceKVA * 100000)

  let coutMaterielsAnnexes = 0
  materiels.value.forEach(mat => { coutMaterielsAnnexes += (mat.quantite * mat.prixUnitaire) })

  return {
    panneaux: coutPanneaux,
    batteries: coutBatteries,
    onduleur: coutOnduleur,
    materiels: coutMaterielsAnnexes,
    total: coutPanneaux + coutBatteries + coutOnduleur + coutMaterielsAnnexes
  }
})

const formatFCFA = (valeur: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(valeur) + ' FCFA'
}

// ==========================================
// ÉTAPE 5 : EXPORT (TXT pour l'instant)
// ==========================================
const telechargerDevis = () => {
  if (!budget.value || !dimensionnementPV.value || !dimensionnementBatterie.value || !dimensionnementOnduleur.value) return

  let contenu = `====================================================\n`
  contenu += `      DEVIS ESTIMATIF PROFESSIONNEL - CHEFFBUILD SOLAR\n`
  contenu += `====================================================\n\n`
  
  contenu += `--- CONTEXTE ---\n`
  contenu += `Système : ${systemeSelectionne.value}\n`
  contenu += `Ensoleillement : ${heuresEnsoleillement.value} h/jour\n`
  contenu += `Tension DC : ${tensionSysteme.value} V\n\n`

  contenu += `--- BILAN DE PUISSANCE ---\n`
  contenu += `Énergie journalière : ${bilanEnergetique.value.consoJourWh} Wh/jour\n`
  contenu += `Puissance simultanée max : ${bilanEnergetique.value.puissanceMaxSimultaneeW} W\n`
  contenu += `Pic de démarrage max : ${bilanEnergetique.value.puissanceDemarrageMaxW} W\n\n`

  contenu += `--- DIMENSIONNEMENT ---\n`
  contenu += `PANNEAUX : ${dimensionnementPV.value.nombrePanneaux} x ${puissancePanneau.value}Wc (${dimensionnementPV.value.puissanceCreteKw} kWc)\n`
  contenu += `BATTERIES : ${dimensionnementBatterie.value.capaciteKwh} kWh (${dimensionnementBatterie.value.capaciteAh} Ah en ${tensionSysteme}V)\n`
  contenu += `ONDULEUR : ${dimensionnementOnduleur.value.puissanceRequiseKVA} kVA recommandé\n\n`

  contenu += `--- ESTIMATION FINANCIERE (FCFA) ---\n`
  contenu += `Panneaux : ${formatFCFA(budget.value.panneaux)}\n`
  contenu += `Batteries : ${formatFCFA(budget.value.batteries)}\n`
  contenu += `Onduleur : ${formatFCFA(budget.value.onduleur)}\n`
  contenu += `Matériel annexe : ${formatFCFA(budget.value.materiels)}\n`
  contenu += `----------------------------------------------------\n`
  contenu += `TOTAL ESTIMÉ : ${formatFCFA(budget.value.total)}\n`
  contenu += `====================================================\n`
  contenu += `NOTE : Ceci est une pré-étude. Les prix et dimensionnements doivent être validés par un installateur qualifié.\n`

  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Devis_CheffBuild_Solar.txt`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="app-container">
    
    <!-- ================= PAGE D'ACCUEIL ================= -->
    <div v-if="pageActuelle === 'accueil'" class="page-accueil">
      <header class="hero">
        <h1>☀️ Bienvenue sur CheffBuild Solar</h1>
        <p>Votre assistant professionnel pour dimensionner votre projet solaire.</p>
      </header>
      <main>
        <h2 class="titre-section">Quel type de système souhaitez-vous installer ?</h2>
        <div class="grille-options">
          <div v-for="option in optionsSystemes" :key="option.id" class="carte-option" @click="choisirSysteme(option.id)">
            <div class="icone">{{ option.icone }}</div>
            <h3>{{ option.titre }}</h3>
            <p>{{ option.description }}</p>
            <span class="badge-usage">{{ option.usage }}</span>
            <button class="btn-choisir">Choisir ce système</button>
          </div>
        </div>
      </main>
    </div>

    <!-- ================= PAGE CONFIGURATEUR (WIZARD) ================= -->
    <div v-else-if="pageActuelle === 'configurateur'" class="page-configurateur">
      
      <!-- En-tête / Stepper -->
      <nav class="stepper">
        <button @click="revenirAccueil" class="btn-retour">← Accueil</button>
        <div class="steps-container">
          <div 
            v-for="(nom, index) in nomsEtapes" 
            :key="index"
            class="step-item"
            :class="{ 'active': etapeActuelle === index + 1, 'done': etapeActuelle > index + 1 }"
            @click="allerAEtape(index + 1)"
          >
            <div class="step-circle">{{ index + 1 }}</div>
            <span class="step-label">{{ nom }}</span>
          </div>
        </div>
      </nav>

      <!-- CONTENU DES ETAPES -->
      <div class="etape-contenu">
        
        <!-- ÉTAPE 1 : CONTEXTE -->
        <section v-if="etapeActuelle === 1" class="card fade-in">
          <h2>Étape 1 : Contexte & Site</h2>
          <p class="help-text">Précisons l'environnement de votre installation.</p>
          
          <div class="form-group">
            <label>Ensoleillement moyen de votre région (heures/jour) : {{ heuresEnsoleillement }}h</label>
            <input type="range" v-model.number="heuresEnsoleillement" min="2" max="8" step="0.5" />
          </div>
          <div class="form-group">
            <label>Type de toiture :</label>
            <div class="radio-group">
              <label><input type="radio" value="tole" v-model="typeToiture" /> Tôle ondulée</label>
              <label><input type="radio" value="tuile" v-model="typeToiture" /> Tuiles</label>
              <label><input type="radio" value="dalle" v-model="typeToiture" /> Dalle béton</label>
            </div>
          </div>
          <div class="form-group">
            <label>Tension du système (Bus DC) :</label>
            <select v-model.number="tensionSysteme" class="select-input">
              <option :value="12">12 V (Petites installations)</option>
              <option :value="24">24 V (Intermédiaire)</option>
              <option :value="48">48 V (Recommandé pour l'autonomie)</option>
            </select>
          </div>
        </section>

        <!-- ÉTAPE 2 : BILAN ENERGETIQUE -->
        <section v-if="etapeActuelle === 2" class="card fade-in">
          <h2>Étape 2 : Bilan Énergétique</h2>
          <p class="help-text">Indiquez les appareils à alimenter. <strong>La puissance de démarrage</strong> est le pic de courant au démarrage (ex: pour un frigo, c'est environ 3 fois la puissance normale).</p>
          
          <div class="table-responsive">
            <table class="tableau-equipements">
              <thead>
                <tr>
                  <th>Équipement</th>
                  <th style="width: 60px;">Qté</th>
                  <th>Puissance (W)</th>
                  <th>Démarrage (W)</th>
                  <th>Durée (h/j)</th>
                  <th>Total (Wh/j)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(eq, index) in equipements" :key="index">
                  <td><input type="text" v-model="eq.nom" placeholder="Ex: Frigo" /></td>
                  <td><input type="number" v-model.number="eq.quantite" min="1" /></td>
                  <td><input type="number" v-model.number="eq.puissance" min="0" step="5" /></td>
                  <td><input type="number" v-model.number="eq.puissanceDemarrage" min="0" step="50" /></td>
                  <td><input type="number" v-model.number="eq.heures" min="0" max="24" step="1" /></td>
                  <td class="text-right">{{ (eq.puissance * eq.quantite * eq.heures) }} Wh</td>
                  <td><button @click="supprimerEquipement(index)" class="btn-suppr">✖</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button @click="ajouterEquipement" class="btn-ajouter">+ Ajouter un équipement</button>
          
          <div class="total-encart">
            <p>Consommation totale : <strong>{{ bilanEnergetique.consoJourWh }} Wh/jour</strong></p>
            <p>Puissance de pointe : <strong>{{ bilanEnergetique.puissanceDemarrageMaxW }} W</strong></p>
          </div>
        </section>

        <!-- ÉTAPE 3 : DIMENSIONNEMENT -->
        <section v-if="etapeActuelle === 3" class="card fade-in">
          <h2>Étape 3 : Dimensionnement</h2>
          
          <div class="grid-params">
            <div class="form-group">
              <label>Autonomie batterie : {{ joursAutonomie }} jour(s)</label>
              <input type="range" v-model.number="joursAutonomie" min="0" max="5" step="0.5" />
            </div>
            <div class="form-group">
              <label>Puissance d'un panneau : {{ puissancePanneau }} Wc</label>
              <input type="range" v-model.number="puissancePanneau" min="300" max="700" step="10" />
            </div>
          </div>

          <div class="resultats-dimensionnement" v-if="dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur">
            <div class="res-box">
              <span>Panneaux PV</span>
              <strong>{{ dimensionnementPV.nombrePanneaux }}</strong>
              <small>{{ dimensionnementPV.puissanceCreteKw }} kWc</small>
            </div>
            <div class="res-box">
              <span>Batteries</span>
              <strong>{{ dimensionnementBatterie.capaciteKwh }} kWh</strong>
              <small>{{ dimensionnementBatterie.capaciteAh }} Ah ({{ tensionSysteme }}V)</small>
            </div>
            <div class="res-box">
              <span>Onduleur</span>
              <strong>{{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA</strong>
              <small>Pour les pics de démarrage</small>
            </div>
          </div>
        </section>

        <!-- ÉTAPE 4 : MATERIEL & CABLAGE -->
        <section v-if="etapeActuelle === 4" class="card fade-in">
          <h2>Étape 4 : Matériel & Câblage</h2>
          <p class="help-text">Ajustez la liste des équipements annexes. (L'onduleur est déjà calculé à l'étape précédente).</p>
          
          <div class="table-responsive">
            <table class="tableau-equipements">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th style="width: 80px;">Qté</th>
                  <th>Prix unitaire (FCFA)</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
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
          <button @click="ajouterMateriel" class="btn-ajouter">+ Ajouter du matériel</button>
        </section>

        <!-- ÉTAPE 5 : RÉSUMÉ & DEVIS -->
        <section v-if="etapeActuelle === 5" class="card fade-in">
          <h2>Étape 5 : Résumé de votre projet</h2>
          
          <div v-if="budget && dimensionnementPV && dimensionnementBatterie && dimensionnementOnduleur" class="recapitulatif">
            <div class="bloc-recap">
              <h3>Bilan Énergétique</h3>
              <p><strong>Consommation :</strong> {{ bilanEnergetique.consoJourWh }} Wh/jour</p>
              <p><strong>Pic de démarrage :</strong> {{ bilanEnergetique.puissanceDemarrageMaxW }} W</p>
            </div>
            
            <div class="bloc-recap budget-final">
              <h3>Estimation Budgétaire</h3>
              <div class="ligne-budget"><span>Panneaux solaires :</span> <strong>{{ formatFCFA(budget.panneaux) }}</strong></div>
              <div class="ligne-budget"><span>Batteries :</span> <strong>{{ formatFCFA(budget.batteries) }}</strong></div>
              <div class="ligne-budget"><span>Onduleur ({{ dimensionnementOnduleur.puissanceRequiseKVA }} kVA) :</span> <strong>{{ formatFCFA(budget.onduleur) }}</strong></div>
              <div class="ligne-budget"><span>Matériel & Câblage :</span> <strong>{{ formatFCFA(budget.materiels) }}</strong></div>
              <div class="total-budget">
                <span>TOTAL ESTIMÉ</span>
                <strong>{{ formatFCFA(budget.total) }}</strong>
              </div>
            </div>
          </div>

          <div class="actions-finales">
            <button @click="telechargerDevis" class="btn-telecharger">📥 Télécharger l'estimation</button>
            <p class="note">Note : Ces calculs sont des pré-études. Une validation par un installateur est requise.</p>
          </div>
        </section>

      </div>

      <!-- BOUTONS DE NAVIGATION BAS DE PAGE -->
      <div class="navigation-bas">
        <button v-if="etapeActuelle > 1" @click="etapePrecedente" class="btn-nav btn-prev">← Précédent</button>
        <div v-else></div>
        
        <button v-if="etapeActuelle < totalEtapes" @click="etapeSuivante" class="btn-nav btn-next">Suivant →</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* --- Styles globaux --- */
.app-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
  min-height: 100vh;
}

/* --- Page d'accueil (Hero) --- */
.hero { text-align: center; padding: 3rem 1rem; background: linear-gradient(135deg, #fdfbf7 0%, #f8e8c8 100%); border-radius: 12px; margin-bottom: 3rem; border: 1px solid #f0d8b0; }
.hero h1 { color: #d35400; font-size: 2.5rem; margin-bottom: 1rem; }
.hero p { font-size: 1.2rem; color: #555; max-width: 600px; margin: 0 auto; }
.titre-section { text-align: center; color: #2c3e50; margin-bottom: 2rem; }

/* --- Grille de sélection --- */
.grille-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
.carte-option { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
.carte-option:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); border-color: #f39c12; }
.icone { font-size: 3rem; margin-bottom: 1rem; }
.carte-option h3 { font-size: 1.1rem; color: #2c3e50; margin-bottom: 0.5rem; min-height: 2.5rem; }
.carte-option p { color: #666; font-size: 0.9rem; flex-grow: 1; margin-bottom: 1rem; }
.badge-usage { display: inline-block; background: #f1f5f9; color: #475569; font-size: 0.8rem; padding: 0.3rem 0.6rem; border-radius: 12px; margin-bottom: 1rem; font-style: italic; }
.btn-choisir { background: #f39c12; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
.carte-option:hover .btn-choisir { background: #d35400; }

/* --- Stepper (Fil d'Ariane) --- */
.stepper { display: flex; flex-direction: column; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
.btn-retour { align-self: flex-start; background: none; border: 1px solid #ccc; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; color: #555; margin-bottom: 1rem; }
.steps-container { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.step-item { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; opacity: 0.5; transition: opacity 0.2s; }
.step-item.active { opacity: 1; font-weight: bold; color: #2980b9; }
.step-item.done { opacity: 1; color: #27ae60; }
.step-circle { width: 30px; height: 30px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.step-item.active .step-circle { background: #2980b9; color: white; }
.step-item.done .step-circle { background: #27ae60; color: white; }
.step-label { font-size: 0.9rem; }

/* --- Cartes --- */
.card { background: white; border-radius: 8px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee; }
.card h2 { margin-top: 0; font-size: 1.4rem; border-bottom: 2px solid #f39c12; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: #2c3e50; }
.help-text { font-size: 0.95rem; color: #666; margin-bottom: 1.5rem; font-style: italic; }

/* --- Formulaires --- */
.form-group { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
.form-group label { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem; color: #2c3e50; }
input[type="range"] { width: 100%; accent-color: #f39c12; height: 8px; }
.select-input { padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
.radio-group { display: flex; gap: 1.5rem; margin-top: 0.5rem; }
.radio-group label { font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }

/* --- Tableaux --- */
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
@media (max-width: 768px) { .grid-params { grid-template-columns: 1fr; } .radio-group { flex-direction: column; gap: 0.5rem; } }

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
.note { font-size: 0.85rem; color: #7f8c8d; margin-top: 1rem; }

/* --- Navigation Bas de Page --- */
.navigation-bas { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee; }
.btn-nav { padding: 0.8rem 1.5rem; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.2s; border: none; }
.btn-prev { background: #ecf0f1; color: #2c3e50; }
.btn-prev:hover { background: #bdc3c7; }
.btn-next { background: #2980b9; color: white; }
.btn-next:hover { background: #1c5980; }

/* --- Animations --- */
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>