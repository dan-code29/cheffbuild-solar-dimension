// src/logic/solarEngine.ts
export type Equipement = { nom: string, quantite: number, puissance: number, puissanceDemarrage: number, heures: number }
export type ParametresSite = { heuresEnsoleillement: number, tensionSysteme: number, longueurCableDC: number, longueurCableAC: number }
export type ParametresSysteme = { puissancePanneau: number, rendementSysteme: number, joursAutonomie: number, profondeurDecharge: number, rendementBatterie: number }

export const SolarEngine = {
  calculerBilan(equipements: Equipement[]) {
    let consoJourWh = 0, puissanceMaxSimultaneeW = 0, puissanceDemarrageMaxW = 0
    equipements.forEach(eq => {
      if (eq.puissance > 0 && eq.heures > 0) {
        consoJourWh += (eq.puissance * eq.quantite * eq.heures)
        puissanceMaxSimultaneeW += (eq.puissance * eq.quantite)
        const demarrageTotal = eq.puissanceDemarrage * eq.quantite
        if (demarrageTotal > puissanceDemarrageMaxW) puissanceDemarrageMaxW = demarrageTotal
      }
    })
    return { consoJourWh, puissanceMaxSimultaneeW, puissanceDemarrageMaxW: Math.max(puissanceDemarrageMaxW, puissanceMaxSimultaneeW) }
  },

  calculerPV(consoJourWh: number, paramsSite: ParametresSite, paramsSys: ParametresSysteme) {
    if (consoJourWh === 0) return null
    const puissanceRequiseW = consoJourWh / (paramsSite.heuresEnsoleillement * (paramsSys.rendementSysteme / 100))
    const nombrePanneaux = Math.ceil(puissanceRequiseW / paramsSys.puissancePanneau)
    return { puissanceRequiseW: Math.round(puissanceRequiseW), nombrePanneaux, puissanceCreteKw: ((nombrePanneaux * paramsSys.puissancePanneau) / 1000).toFixed(2) }
  },

  calculerBatterie(
    consoJourWh: number,
    paramsSite: ParametresSite,
    paramsSys: ParametresSysteme,
    tensionBatterieV: number,
    capaciteBatterieAh: number
  ) {
    if (consoJourWh === 0) return null
    const capaciteRequiseWh = (consoJourWh * paramsSys.joursAutonomie) / ((paramsSys.profondeurDecharge / 100) * (paramsSys.rendementBatterie / 100))
    const capaciteAh = Math.round(capaciteRequiseWh / paramsSite.tensionSysteme)
    const configurationCompatible = tensionBatterieV > 0
      && capaciteBatterieAh > 0
      && paramsSite.tensionSysteme % tensionBatterieV === 0
    const batteriesEnSerie = configurationCompatible ? paramsSite.tensionSysteme / tensionBatterieV : null
    const chainesParalleles = configurationCompatible ? Math.ceil(capaciteAh / capaciteBatterieAh) : null
    const nombreBatteries = batteriesEnSerie !== null && chainesParalleles !== null
      ? batteriesEnSerie * chainesParalleles
      : null
    return {
      capaciteKwh: (capaciteRequiseWh / 1000).toFixed(1),
      capaciteAh,
      tensionBatterieV,
      capaciteBatterieAh,
      batteriesEnSerie,
      chainesParalleles,
      nombreBatteries
    }
  },

  calculerOnduleur(puissanceDemarrageMaxW: number) {
    if (puissanceDemarrageMaxW === 0) return null
    const puissanceOnduleurRequiseVA = puissanceDemarrageMaxW * 1.2 
    return { puissanceRequiseVA: Math.round(puissanceOnduleurRequiseVA), puissanceRequiseKVA: (puissanceOnduleurRequiseVA / 1000).toFixed(1) }
  },

  calculerSectionCable(longueurM: number, courantA: number, tensionV: number, chuteMaxPct: number = 3) {
    if (courantA === 0 || longueurM === 0) return { sectionMm2: 0, chuteTension: 0 }
    const rhoCuivre = 0.01724, chuteTensionMaxV = tensionV * (chuteMaxPct / 100)
    const sectionTheorique = (rhoCuivre * 2 * longueurM * courantA) / chuteTensionMaxV
    const sectionsStandard = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
    const sectionRetenue = sectionsStandard.find(s => s >= sectionTheorique) || 120
    return { sectionMm2: sectionRetenue, chuteTension: ((rhoCuivre * 2 * longueurM * courantA) / sectionRetenue).toFixed(2) }
  },

  calculerCableAC(puissanceOnduleurVA: number, tensionAC: number, longueurM: number) {
    if (puissanceOnduleurVA === 0 || longueurM === 0) return { sectionMm2: 0, courantA: 0, chuteTension: 0 }
    const courantA = puissanceOnduleurVA / tensionAC, rhoCuivre = 0.01724, chuteTensionMaxV = tensionAC * 0.03
    const sectionTheorique = (rhoCuivre * 2 * longueurM * courantA) / chuteTensionMaxV
    const sectionsStandard = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]
    const sectionRetenue = sectionsStandard.find(s => s >= sectionTheorique) || 50
    return { courantA: courantA.toFixed(1), sectionMm2: sectionRetenue, chuteTension: ((rhoCuivre * 2 * longueurM * courantA) / sectionRetenue).toFixed(2) }
  },

  calculerProtections(puissanceOnduleurVA: number, tensionAC: number, courantPV: number) {
    const courantAC = puissanceOnduleurVA / tensionAC
    const calibresAC = [16, 20, 25, 32, 40, 50, 63]
    const disjoncteurAC = calibresAC.find(c => c >= courantAC * 1.25) || 63
    const calibresDC = [10, 15, 20, 25, 30, 40, 50, 63]
    const fusibleDC = calibresDC.find(c => c >= courantPV * 1.25) || 63
    return { disjoncteurAC: disjoncteurAC + ' A', fusibleDC: fusibleDC + ' A' }
  },

  calculerStrings(nombrePanneaux: number, tensionSysteme: number) {
    const vocPanneau = 49.5, vmpPanneau = 41.5, iscPanneau = 14, tensionMaxMPPT = 150 
    const maxSerie = Math.floor(tensionMaxMPPT / vocPanneau)
    let panneauxParSerie = Math.floor((tensionSysteme * 2) / vmpPanneau)
    if (panneauxParSerie > maxSerie) panneauxParSerie = maxSerie
    if (panneauxParSerie < 1) panneauxParSerie = 1
    const nombreChaines = Math.ceil(nombrePanneaux / panneauxParSerie)
    return { panneauxParSerie, nombreChaines, tensionVocString: (panneauxParSerie * vocPanneau).toFixed(1), courantTotal: (nombreChaines * iscPanneau).toFixed(1), avertissement: panneauxParSerie * vocPanneau > tensionMaxMPPT ? "Danger : Voc dépasse la limite MPPT" : null }
  },

  verifierInstallation(pv: any, bat: any, onduleur: any, site: ParametresSite) {
    const alertes: { type: 'danger'|'warning', msg: string }[] = []
    if (!pv || !bat || !onduleur) return alertes
    if (site.tensionSysteme < 48 && parseInt(onduleur.puissanceRequiseKVA) > 3) alertes.push({ type: 'danger', msg: "Système 12/24V inadapté pour > 3kVA." })
    return alertes
  },

  verifierGroupe(onduleurKVA: number, groupeKVA: number) {
    const alertes: { type: 'danger'|'warning', msg: string }[] = []
    if (!onduleurKVA || !groupeKVA) return alertes
    if (groupeKVA < onduleurKVA * 1.25) alertes.push({ type: 'warning', msg: `Groupe (${groupeKVA} kVA) sous-dimensionné pour l'onduleur (${onduleurKVA} kVA). Recommandé : min ${(onduleurKVA * 1.25).toFixed(1)} kVA.` })
    return alertes
  }
}