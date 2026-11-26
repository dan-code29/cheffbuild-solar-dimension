<script setup lang="ts">
import { ref, computed } from 'vue'

// --- Navigation ---
const pageActuelle = ref<'accueil' | 'configurateur'>('accueil')
const systemeSelectionne = ref<string | null>(null)

const optionsSystemes = [
  { id: 'complet', titre: 'Installation solaire complète (100 %)', description: 'Toute la maison est alimentée par le solaire.', icone: '🏠' },
  { id: 'equipements', titre: 'Quelques équipements solaires', description: 'Alimentez uniquement des appareils spécifiques.', icone: '🔌' },
  { id: 'hybride', titre: 'Système hybride', description: 'Solaire + réseau électrique classique + batterie.', icone: '🔄' },
  { id: 'personnalise', titre: 'Configurer tout moi-même', description: 'Saisie libre de vos besoins.', icone: '🛠️' }
]

const choisirSysteme = (id: string) => {
  systemeSelectionne.value = id
  pageActuelle.value = 'configurateur'
}

const revenirAccueil = () => {
  pageActuelle.value = 'accueil'
  systemeSelectionne.value = null
}

// --- 1. Gestion des Équipements ---
// Type pour nos équipements
type Equipement = {
  nom: string
  puissance: number // en W
  heures: number // par jour
}

// Liste de base avec quelques appareils courants pour aider l'utilisateur
const equipements = ref<Equipement[]>([
  { nom: 'Réfrigérateur', puissance: 150, heures: 8 },
  { nom: 'Téléviseur', puissance: 100, heures: 4 }
])

// Ajouter un équipement
const ajouterEquipement = () => {
  equipements.value.push({ nom: '', puissance: 0, heures: 0 })
}

// Supprimer un équipement
const supprimerEquipement = (index: number) => {
  equipements.value.splice(index, 1)
}

// --- 2. Paramètres du système ---
const heuresEnsoleillement = ref<number>(5) // h/j
const puissancePanneau = ref<number>(550) // Wc
const rendementSysteme = ref<number>(75) // % (pertes de câblage, chaleur, onduleur)
const joursAutonomie = ref<number>(1) // Jours sans soleil
const profondeurDecharge = ref<number>(80) // % (80% pour Lithium)

// --- 3. Prix unitaires (estimations) ---
const prixPanneau = ref<number>(150) // € par panneau
const prixBatterieKwh = ref<number>(300) // € par kWh de batterie
const prixOnduleurPose = ref<number>(900) // € (forfait onduleur + câbles + pose)

// --- 4. Calculs globaux ---
const calculs = computed(() => {
  // A. Consommation journalière totale
  let consommationJournaliere = 0
  equipements.value.forEach(eq => {
    if (eq.puissance > 0 && eq.heures > 0) {
      consommationJournaliere += (eq.puissance * eq.heures)
    }
  })

  if (consommationJournaliere === 0) return null

  // B. Dimensionnement des panneaux
  // Formule : Conso / (ensoleillement * rendement)
  const puissanceRequiseW = consommationJournaliere / (heuresEnsoleillement.value * (rendementSysteme.value / 100))
  const puissanceRequiseKw = puissanceRequiseW / 1000
  const nombrePanneaux = Math.ceil(puissanceRequiseW / puissancePanneau.value)
  
  // La puissance crête réelle est basée sur le nombre de panneaux arrondi
  const puissanceCreteReelleKw = (nombrePanneaux * puissancePanneau.value) / 1000

  // C. Dimensionnement des batteries (en Wh puis kWh)
  // Formule : (Conso * jours autonomie) / profondeur de décharge
  const capaciteBatterieWh = (consommationJournaliere * joursAutonomie.value) / (profondeurDecharge.value / 100)
  const capaciteBatterieKwh = capaciteBatterieWh / 1000
  
  // D. Estimation budgétaire
  const coutPanneaux = nombrePanneaux * prixPanneau.value
  // On arrondit la capacité batterie à 0.1 kWh près pour le prix
  const coutBatteries = Math.ceil(capaciteBatterieKwh * 10) / 10 * prixBatterieKwh.value
  const coutTotal = coutPanneaux + coutBatteries + prixOnduleurPose.value

  return {
    consommationJournaliere: consommationJournaliere.toFixed(0), // Wh
    puissanceRequiseKw: puissanceRequiseKw.toFixed(2),
    nombrePanneaux,
    puissanceCreteReelleKw: puissanceCreteReelleKw.toFixed(2),
    capaciteBatterieKwh: capaciteBatterieKwh.toFixed(1),
    couts: {
      panneaux: coutPanneaux,
      batteries: coutBatteries,
      onduleurPose: prixOnduleurPose.value,
      total: coutTotal
    }
  }
})
</script>

<template>
  <div class="app-container">
    
    <!-- ================= PAGE D'ACCUEIL ================= -->
    <div v-if="pageActuelle === 'accueil'" class="page-accueil">
      <header class="hero">
        <h1>☀️ Bienvenue sur CheffBuild Solar</h1>
        <p>Votre assistant pour dimensionner, chiffrer et préparer votre projet solaire.</p>
      </header>
      <main>
        <h2 class="titre-section">Quel type de système souhaitez-vous installer ?</h2>
        <div class="grille-options">
          <div v-for="option in optionsSystemes" :key="option.id" class="carte-option" @click="choisirSysteme(option.id)">
            <div class="icone">{{ option.icone }}</div>
            <h3>{{ option.titre }}</h3>
            <p>{{ option.description }}</p>
            <button class="btn-choisir">Choisir ce système</button>
          </div>
        </div>
      </main>
    </div>

    <!-- ================= PAGE CONFIGURATEUR ================= -->
    <div v-else-if="pageActuelle === 'configurateur'" class="page-configurateur">
      <nav class="breadcrumb">
        <button @click="revenirAccueil" class="btn-retour">← Retour</button>
        <span class="badge-systeme">Système : {{ systemeSelectionne }}</span>
      </nav>

      <!-- MODULE 1 : BILAN ENERGETIQUE -->
      <section class="card">
        <h2>1. Bilan de vos équipements</h2>
        <p class="help-text">Ajoutez les appareils que vous souhaitez alimenter. Pour le frigo, mettez environ 8h à 10h (temps de fonctionnement du compresseur).</p>
        
        <table class="tableau-equipements">
          <thead>
            <tr>
              <th>Équipement</th>
              <th>Puissance (W)</th>
              <th>Durée (h/jour)</th>
              <th>Total (Wh/j)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(eq, index) in equipements" :key="index">
              <td><input type="text" v-model="eq.nom" placeholder="Ex: Frigo" /></td>
              <td><input type="number" v-model.number="eq.puissance" min="0" step="10" /></td>
              <td><input type="number" v-model.number="eq.heures" min="0" max="24" step="1" /></td>
              <td class="text-right">{{ (eq.puissance * eq.heures) }} Wh</td>
              <td><button @click="supprimerEquipement(index)" class="btn-suppr" title="Supprimer">✖</button></td>
            </tr>
          </tbody>
        </table>
        <button @click="ajouterEquipement" class="btn-ajouter">+ Ajouter un équipement</button>
      </section>

      <!-- MODULE 2 : PARAMETRES SYSTEME -->
      <section class="card">
        <h2>2. Paramètres du système</h2>
        <div class="grid-params">
          <div class="form-group">
            <label>Ensoleillement (h/j) : {{ heuresEnsoleillement }}h</label>
            <input type="range" v-model.number="heuresEnsoleillement" min="2" max="8" step="0.5" />
          </div>
          <div class="form-group">
            <label>Autonomie souhaitée : {{ joursAutonomie }} jour(s)</label>
            <input type="range" v-model.number="joursAutonomie" min="0" max="5" step="0.5" />
          </div>
          <div class="form-group">
            <label>Puissance panneau (Wc) : {{ puissancePanneau }} Wc</label>
            <input type="range" v-model.number="puissancePanneau" min="300" max="700" step="10" />
          </div>
          <div class="form-group">
            <label>Rendement du système : {{ rendementSysteme }} %</label>
            <input type="range" v-model.number="rendementSysteme" min="50" max="100" step="1" />
          </div>
        </div>
      </section>

      <!-- MODULE 3 : PRIX ET RESULTATS -->
      <div class="grid-resultats" v-if="calculs">
        
        <!-- Résultats Techniques -->
        <section class="card result-card">
          <h2>📊 Vos résultats</h2>
          
          <div class="result-item">
            <span>Consommation totale :</span>
            <strong>{{ calculs.consommationJournaliere }} Wh/jour</strong>
          </div>
          <hr class="separateur" />
          
          <div class="result-bloc">
            <span class="label">Panneaux requis</span>
            <span class="value">{{ calculs.nombrePanneaux }} <small>panneaux</small></span>
            <span class="subtext">Puissance crête : {{ calculs.puissanceCreteReelleKw }} kWc</span>
          </div>

          <div class="result-bloc">
            <span class="label">Capacité Batterie</span>
            <span class="value">{{ calculs.capaciteBatterieKwh }} <small>kWh</small></span>
            <span class="subtext">Décharge max : {{ profondeurDecharge }}%</span>
          </div>
        </section>

        <!-- Estimation Financière -->
        <section class="card budget-card">
          <h2>💰 Estimation budgétaire</h2>
          
          <div class="input-prix">
            <label>Prix / panneau :</label>
            <div><input type="number" v-model.number="prixPanneau" /> €</div>
          </div>
          <div class="input-prix">
            <label>Prix / kWh batterie :</label>
            <div><input type="number" v-model.number="prixBatterieKwh" /> €</div>
          </div>
          <div class="input-prix">
            <label>Onduleur, pose & coffrets :</label>
            <div><input type="number" v-model.number="prixOnduleurPose" /> €</div>
          </div>

          <hr class="separateur" />

          <div class="ligne-budget">
            <span>Panneaux ({{ calculs.nombrePanneaux }} x {{ prixPanneau }}€)</span>
            <strong>{{ calculs.couts.panneaux }} €</strong>
          </div>
          <div class="ligne-budget">
            <span>Batteries ({{ calculs.capaciteBatterieKwh }} kWh x {{ prixBatterieKwh }}€)</span>
            <strong>{{ calculs.couts.batteries }} €</strong>
          </div>
          <div class="ligne-budget">
            <span>Onduleur, câbles, pose</span>
            <strong>{{ calculs.couts.onduleurPose }} €</strong>
          </div>

          <div class="total-budget">
            <span>BUDGET TOTAL ESTIMÉ</span>
            <strong>{{ calculs.couts.total }} €</strong>
          </div>
        </section>
      </div>
      
      <div v-else class="card empty-card">
        <p>Veuillez ajouter au moins un équipement avec une puissance supérieure à 0 pour voir le dimensionnement.</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* --- Styles globaux --- */
.app-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
  min-height: 100vh;
}

/* --- Page d'accueil (Hero) --- */
.hero {
  text-align: center;
  padding: 3rem 1rem;
  background: linear-gradient(135deg, #fdfbf7 0%, #f8e8c8 100%);
  border-radius: 12px;
  margin-bottom: 3rem;
  border: 1px solid #f0d8b0;
}
.hero h1 { color: #d35400; font-size: 2.5rem; margin-bottom: 1rem; }
.hero p { font-size: 1.2rem; color: #555; max-width: 600px; margin: 0 auto; }
.titre-section { text-align: center; color: #2c3e50; margin-bottom: 2rem; }

/* --- Grille de sélection --- */
.grille-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
.carte-option { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
.carte-option:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); border-color: #f39c12; }
.icone { font-size: 3rem; margin-bottom: 1rem; }
.carte-option h3 { font-size: 1.1rem; color: #2c3e50; margin-bottom: 0.75rem; min-height: 2.5rem; }
.carte-option p { color: #666; font-size: 0.9rem; flex-grow: 1; margin-bottom: 1.5rem; }
.btn-choisir { background: #f39c12; color: white; border: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
.carte-option:hover .btn-choisir { background: #d35400; }

/* --- Page Configurateur --- */
.breadcrumb { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #eee; }
.btn-retour { background: none; border: 1px solid #ccc; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; color: #555; }
.btn-retour:hover { background: #f5f5f5; }
.badge-systeme { background: #e8f4fd; color: #2980b9; padding: 0.4rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; text-transform: capitalize; }

/* --- Cartes --- */
.card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee; }
.card h2 { margin-top: 0; font-size: 1.2rem; border-bottom: 2px solid #f39c12; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
.help-text { font-size: 0.9rem; color: #666; margin-bottom: 1rem; font-style: italic; }

/* --- Tableau des équipements --- */
.tableau-equipements { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
.tableau-equipements th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #ddd; font-size: 0.9rem; color: #555; }
.tableau-equipements td { padding: 0.5rem; border-bottom: 1px solid #eee; }
.tableau-equipements input { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.text-right { text-align: right; font-weight: bold; }
.btn-ajouter { background: #ecf0f1; border: 1px dashed #bdc3c7; color: #2c3e50; padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 0.5rem; }
.btn-ajouter:hover { background: #e0e6ed; }
.btn-suppr { background: #ffebee; color: #c0392b; border: none; padding: 0.4rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-suppr:hover { background: #ffcdd2; }

/* --- Paramètres (Sliders) --- */
.grid-params { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.form-group { display: flex; flex-direction: column; }
.form-group label { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: #2c3e50; }
input[type="range"] { width: 100%; accent-color: #f39c12; }

/* --- Résultats & Budget --- */
.grid-resultats { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 768px) { .grid-resultats, .grid-params { grid-template-columns: 1fr; } }

.result-card { background-color: #f8f9fa; border-color: #cbd5e1; }
.result-item { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 1.1rem; }
.separateur { border: 0; height: 1px; background: #ddd; margin: 1.5rem 0; }

.result-bloc { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
.result-bloc .label { font-weight: bold; color: #555; font-size: 0.9rem; }
.result-bloc .value { font-size: 2.5rem; font-weight: 900; color: #2980b9; line-height: 1; margin: 0.3rem 0; }
.result-bloc .value small { font-size: 1rem; color: #666; }
.result-bloc .subtext { font-size: 0.8rem; color: #7f8c8d; }

.budget-card { background-color: #f0fdf4; border-color: #bbf7d0; }
.input-prix { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; font-size: 0.9rem; }
.input-prix input { width: 80px; padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; text-align: right; }
.ligne-budget { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem; }
.total-budget { display: flex; justify-content: space-between; margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed #22c55e; font-size: 1.2rem; font-weight: bold; color: #166534; }

.empty-card { text-align: center; color: #95a5a6; font-style: italic; }
</style>