// ============================================================================
// FICHIER : src/logic/solarEngine.ts
// RÔLE : Moteur de calcul pur
// ============================================================================

export type Equipement = { 
  nom: string
  quantite: number
  puissance: number
  puissanceDemarrage: number
  heures: number
}

export type ParametresSite = {
  heuresEnsoleillement: number
  tensionSysteme: number
  longueurCableDC: number
  longueurCableAC: number
}

export type ParametresSysteme = {
  puissancePanneau: number
  rendementSysteme: number
  joursAutonomie: number
  profondeurDecharge: number
  rendementBatterie: number
}

export const SolarEngine = {
  
  // A. BILAN ENERGETIQUE
  calculerBilan(equipements: Equipement[]) {
    let consoJourWh = 0
    let puissanceMaxSimultaneeW = 0
    let puissanceDemarrageMaxW = 0

    equipements.forEach(eq => {
      if (eq.puissance > 0 && eq.heures > 0) {
        consoJourWh += (eq.puissance * eq.quantite * eq.heures)
        puissanceMaxSimultaneeW += (eq.puissance * eq.quantite)
        const demarrageTotal = eq.puissanceDemarrage * eq.quantite
        if (demarrageTotal > puissanceDemarrageMaxW) {
          puissanceDemarrageMaxW = demarrageTotal
        }
      }
    })

    return {
      consoJourWh,
      puissanceMaxSimultaneeW,
      puissanceDemarrageMaxW: Math.max(puissanceDemarrageMaxW, puissanceMaxSimultaneeW)
    }
  },

  // B. DIMENSIONNEMENT PHOTOVOLTAÏQUE
  calculerPV(consoJourWh: number, paramsSite: ParametresSite, paramsSys: ParametresSysteme) {
    if (consoJourWh === 0) return null
    const puissanceRequiseW = consoJourWh / (paramsSite.heuresEnsoleillement * (paramsSys.rendementSysteme / 100))
    const nombrePanneaux = Math.ceil(puissanceRequiseW / paramsSys.puissancePanneau)
    
    return {
      puissanceRequiseW: Math.round(puissanceRequiseW),
      nombrePanneaux,
      puissanceCreteKw: ((nombrePanneaux * paramsSys.puissancePanneau) / 1000).toFixed(2)
    }
  },

  // C. DIMENSIONNEMENT BATTERIES
  calculerBatterie(consoJourWh: number, paramsSite: ParametresSite, paramsSys: ParametresSysteme) {
    if (consoJourWh === 0) return null
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
    const puissanceOnduleurRequiseVA = puissanceDemarrageMaxW * 1.2 
    
    return {
      puissanceRequiseVA: Math.round(puissanceOnduleurRequiseVA),
      puissanceRequiseKVA: (puissanceOnduleurRequiseVA / 1000).toFixed(1)
    }
  },

  // E. CALCUL DU CÂBLAGE DC
  calculerSectionCable(longueurM: number, courantA: number, tensionV: number, chuteMaxPct: number = 3) {
    if (courantA === 0 || longueurM === 0) return { sectionMm2: 0, chuteTension: 0 }
    const rhoCuivre = 0.01724 
    const chuteTensionMaxV = tensionV * (chuteMaxPct / 100) 
    const sectionTheorique = (rhoCuivre * 2 * longueurM * courantA) / chuteTensionMaxV
    const sectionsStandard = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
    const sectionRetenue = sectionsStandard.find(s => s >= sectionTheorique) || sectionsStandard[sectionsStandard.length - 1]
    const chuteReelle = (rhoCuivre * 2 * longueurM * courantA) / sectionRetenue

    return {
      sectionMm2: sectionRetenue,
      chuteTension: chuteReelle.toFixed(2)
    }
  },

  // F. CALCUL DU CÂBLAGE AC
  calculerCableAC(puissanceOnduleurVA: number, tensionAC: number, longueurM: number) {
    if (puissanceOnduleurVA === 0 || longueurM === 0) return { sectionMm2: 0, courantA: 0, chuteTension: 0 }
    const courantA = puissanceOnduleurVA / tensionAC
    const rhoCuivre = 0.01724 
    const chuteMaxPct = 3 
    const chuteTensionMaxV = tensionAC * (chuteMaxPct / 100)
    const sectionTheorique = (rhoCuivre * 2 * longueurM * courantA) / chuteTensionMaxV
    const sectionsStandard = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]
    const sectionRetenue = sectionsStandard.find(s => s >= sectionTheorique) || 50

    return {
      courantA: courantA.toFixed(1),
      sectionMm2: sectionRetenue,
      chuteTension: ((rhoCuivre * 2 * longueurM * courantA) / sectionRetenue).toFixed(2)
    }
  },

  // G. CALCUL DES PROTECTIONS
  calculerProtections(puissanceOnduleurVA: number, tensionAC: number, courantPV: number) {
    const courantAC = puissanceOnduleurVA / tensionAC
    const calibresAC = [16, 20, 25, 32, 40, 50, 63]
    const disjoncteurAC = calibresAC.find(c => c >= courantAC * 1.25) || 63

    const calibresDC = [10, 15, 20, 25, 30, 40, 50, 63]
    const fusibleDC = calibresDC.find(c => c >= courantPV * 1.25) || 63

    return {
      disjoncteurAC: disjoncteurAC + ' A',
      fusibleDC: fusibleDC + ' A'
    }
  },

  // H. CONFIGURATION DES STRINGS
  calculerStrings(nombrePanneaux: number, tensionSysteme: number) {
    const vocPanneau = 49.5
    const vmpPanneau = 41.5
    const iscPanneau = 14
    const tensionMaxMPPT = 150 
    
    const maxSerie = Math.floor(tensionMaxMPPT / vocPanneau)
    let panneauxParSerie = Math.floor((tensionSysteme * 2) / vmpPanneau)
    if (panneauxParSerie > maxSerie) panneauxParSerie = maxSerie
    if (panneauxParSerie < 1) panneauxParSerie = 1

    const nombreChaines = Math.ceil(nombrePanneaux / panneauxParSerie)

    return {
      panneauxParSerie,
      nombreChaines,
      tensionVocString: (panneauxParSerie * vocPanneau).toFixed(1),
      courantTotal: (nombreChaines * iscPanneau).toFixed(1),
      avertissement: panneauxParSerie * vocPanneau > tensionMaxMPPT ? "Danger : Voc dépasse la limite MPPT" : null
    }
  },

  // I. MOTEUR D'ALERTES ET DE SÉCURITÉ
  verifierInstallation(pv: any, bat: any, onduleur: any, site: ParametresSite) {
    const alertes: { type: 'danger'|'warning', msg: string }[] = []
    if (!pv || !bat || !onduleur) return alertes

    if (site.tensionSysteme < 48 && parseInt(onduleur.puissanceRequiseKVA) > 3) {
      alertes.push({ type: 'danger', msg: "Système en 12V/24V inadapté pour un onduleur > 3kVA. Passez en 48V." })
    }

    const courantChargeMax = (pv.nombrePanneaux * 550) / site.tensionSysteme 
    if (courantChargeMax > 100) {
      alertes.push({ type: 'warning', msg: `Courant de charge élevé (${Math.round(courantChargeMax)}A). Vérifiez les limites du BMS.` })
    }

    return alertes
  }
}