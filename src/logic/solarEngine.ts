// ============================================================================
// FICHIER : src/logic/solarEngine.ts
// RÔLE : Moteur de calcul pur (indépendant de Vue.js)
// ============================================================================

// --- DÉFINITION DES TYPES ---
// Cela permet d'avoir un code robuste et d'éviter les erreurs de frappe.
export type Equipement = { 
  nom: string
  quantite: number
  puissance: number          // Puissance nominale en W
  puissanceDemarrage: number // Puissance au démarrage (pic) en W
  heures: number             // Utilisation en heures / jour
}

export type ParametresSite = {
  heuresEnsoleillement: number // Heures de soleil crête (h/j)
  tensionSysteme: number       // Tension du bus DC (12, 24 ou 48V)
  longueurCableDC: number      // Longueur des câbles panneaux->régulateur
  longueurCableAC: number      // Longueur des câbles onduleur->tableau
}

export type ParametresSysteme = {
  puissancePanneau: number   // Puissance unitaire d'un panneau (Wc)
  rendementSysteme: number   // Rendement global (pertes câbles, chaleur, etc.)
  joursAutonomie: number     // Nombre de jours sans soleil
  profondeurDecharge: number // DoD (80% pour Lithium, 50% pour Plomb)
  rendementBatterie: number  // Rendement de charge/décharge (95% Lithium)
}

// --- LE MOTEUR ---
export const SolarEngine = {
  
  // A. BILAN ENERGETIQUE
  // Calcule ce que l'utilisateur consomme, et surtout, le PIC de puissance.
  calculerBilan(equipements: Equipement[]) {
    let consoJourWh = 0
    let puissanceMaxSimultaneeW = 0
    let puissanceDemarrageMaxW = 0

    equipements.forEach(eq => {
      if (eq.puissance > 0 && eq.heures > 0) {
        // Énergie totale (Wh) = Puissance * Quantité * Heures
        consoJourWh += (eq.puissance * eq.quantite * eq.heures)
        
        // Puissance si tout s'allume en même temps
        puissanceMaxSimultaneeW += (eq.puissance * eq.quantite)
        
        // Le pic de démarrage détermine la taille de l'onduleur
        const demarrageTotal = eq.puissanceDemarrage * eq.quantite
        if (demarrageTotal > puissanceDemarrageMaxW) {
          puissanceDemarrageMaxW = demarrageTotal
        }
      }
    })

    return {
      consoJourWh,
      puissanceMaxSimultaneeW,
      // On garde la valeur la plus élevée des deux
      puissanceDemarrageMaxW: Math.max(puissanceDemarrageMaxW, puissanceMaxSimultaneeW)
    }
  },

  // B. DIMENSIONNEMENT PHOTOVOLTAÏQUE (Panneaux)
  calculerPV(consoJourWh: number, paramsSite: ParametresSite, paramsSys: ParametresSysteme) {
    if (consoJourWh === 0) return null
    
    // Formule : P = E_jour / (Ensoleillement * Rendement)
    const puissanceRequiseW = consoJourWh / (paramsSite.heuresEnsoleillement * (paramsSys.rendementSysteme / 100))
    
    // On arrondit au panneau supérieur
    const nombrePanneaux = Math.ceil(puissanceRequiseW / paramsSys.puissancePanneau)
    
    return {
      puissanceRequiseW: Math.round(puissanceRequiseW),
      nombrePanneaux,
      // Puissance crête réelle installée
      puissanceCreteKw: ((nombrePanneaux * paramsSys.puissancePanneau) / 1000).toFixed(2)
    }
  },

  // C. DIMENSIONNEMENT BATTERIES
  calculerBatterie(consoJourWh: number, paramsSite: ParametresSite, paramsSys: ParametresSysteme) {
    if (consoJourWh === 0) return null
    
    // Formule Pro : (Conso * Autonomie) / (Profondeur de décharge * Rendement batterie)
    const capaciteRequiseWh = (consoJourWh * paramsSys.joursAutonomie) / 
                              ((paramsSys.profondeurDecharge / 100) * (paramsSys.rendementBatterie / 100))
    
    const capaciteKwh = capaciteRequiseWh / 1000
    const capaciteAh = capaciteRequiseWh / paramsSite.tensionSysteme
    
    return {
      capaciteKwh: capaciteKwh.toFixed(1),
      capaciteAh: Math.round(capaciteAh)
    }
  },

  // D. DIMENSIONNEMENT ONDULEUR
  calculerOnduleur(puissanceDemarrageMaxW: number) {
    if (puissanceDemarrageMaxW === 0) return null
    
    // L'onduleur doit pouvoir encaisser le pic de démarrage + une marge de 20%
    const puissanceOnduleurRequiseVA = puissanceDemarrageMaxW * 1.2 
    
    return {
      puissanceRequiseVA: Math.round(puissanceOnduleurRequiseVA),
      puissanceRequiseKVA: (puissanceOnduleurRequiseVA / 1000).toFixed(1)
    }
  },

  // E. CALCUL DU CÂBLAGE
  // Formule : Section = (rho * 2 * Longueur * Courant) / Chute de tension max
  calculerSectionCable(longueurM: number, courantA: number, tensionV: number, chuteMaxPct: number = 3) {
    if (courantA === 0 || longueurM === 0) return { sectionMm2: 0, chuteTension: 0 }
    
    const rhoCuivre = 0.01724 // Résistivité du cuivre en Ohm.mm²/m
    const chuteTensionMaxV = tensionV * (chuteMaxPct / 100) // Ex: 3% de 48V = 1.44V
    
    // Section théorique minimale
    const sectionTheorique = (rhoCuivre * 2 * longueurM * courantA) / chuteTensionMaxV
    
    // Sections normalisées du commerce (mm²)
    const sectionsStandard = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
    // On choisit la première section supérieure ou égale à la section théorique
    const sectionRetenue = sectionsStandard.find(s => s >= sectionTheorique) || sectionsStandard[sectionsStandard.length - 1]
    
    // On vérifie la chute de tension réelle avec la section normalisée
    const chuteReelle = (rhoCuivre * 2 * longueurM * courantA) / sectionRetenue

    return {
      sectionMm2: sectionRetenue,
      chuteTension: chuteReelle.toFixed(2)
    }
  },

  // F. MOTEUR D'ALERTES ET DE SÉCURITÉ
  verifierInstallation(pv: any, bat: any, onduleur: any, site: ParametresSite) {
    const alertes: { type: 'danger'|'warning', msg: string }[] = []
    if (!pv || !bat || !onduleur) return alertes

    // Règle 1 : Un onduleur puissant nécessite une tension de bus élevée
    if (site.tensionSysteme < 48 && parseInt(onduleur.puissanceRequiseKVA) > 3) {
      alertes.push({ 
        type: 'danger', 
        msg: "Système en 12V ou 24V inadapté pour un onduleur > 3kVA. Risque de courants excessifs. Passez en 48V." 
      })
    }

    // Règle 2 : Le courant de charge ne doit pas dépasser les limites du BMS
    const courantChargeMax = (pv.nombrePanneaux * 550) / site.tensionSysteme 
    if (courantChargeMax > 100) {
      alertes.push({ 
        type: 'warning', 
        msg: `Courant de charge élevé (${Math.round(courantChargeMax)}A). Vérifiez les limites de votre BMS de batterie.` 
      })
    }

    return alertes
  }
}