<script setup lang="ts">
import { computed } from 'vue'
import type { Equipement } from '../stores/projectStore'

const props = defineProps<{
  mode: 'unifilaire' | 'multifilaire'
  panneaux: number
  puissancePanneau: number
  strings: string
  tensionDC: number
  sectionDC: number
  fusibleDC: string
  capaciteBatterie: string
  onduleur: string
  disjoncteurAC: string
  tensionAC: number
  sectionAC: number
  equipements: Equipement[]
  groupeActif: boolean
  puissanceGroupe: number
}>()

const hauteurSchema = computed(() => Math.max(490, 450 + props.equipements.length * 34))
const hauteurTableau = computed(() => Math.max(80, 48 + props.equipements.length * 34))
</script>

<template>
  <div class="schema-electrique">
    <svg
      :viewBox="`0 0 1100 ${hauteurSchema}`"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="`Schéma électrique ${mode}`"
      style="display:block;width:100%;min-width:800px;height:auto;background:#fff;border:1px solid #dbe3ec;border-radius:8px"
    >
      <text x="30" y="30" fill="#334155" font-size="16" font-weight="700">
        {{ mode === 'unifilaire' ? 'Schéma unifilaire' : 'Schéma multifilaire' }}
      </text>
      <text x="1070" y="30" text-anchor="end" fill="#64748b" font-size="12">
        Conducteurs DC en bleu · AC en orange · Batterie en vert
      </text>

      <g v-if="mode === 'unifilaire'" fill="none" stroke-width="3">
        <path d="M185 105H240M395 105H450M527 145V230M605 270H660M815 270H870" stroke="#2563eb" />
        <path d="M395 270H450" stroke="#16a34a" />
      </g>
      <g v-else fill="none" stroke-width="2">
        <path d="M185 101H240M185 109H240M395 101H450M395 109H450M523 145V230M531 145V230" stroke="#2563eb" />
        <path d="M395 266H450M395 274H450" stroke="#16a34a" />
        <path d="M605 264H660M605 270H660M605 276H660M815 264H870M815 270H870M815 276H870" stroke="#ea580c" />
        <text x="205" y="94" fill="#2563eb" font-size="10">+/−</text>
        <text x="410" y="94" fill="#2563eb" font-size="10">+/−</text>
        <text x="410" y="290" fill="#16a34a" font-size="10">+/− batterie</text>
        <text x="620" y="258" fill="#ea580c" font-size="10">L / N / PE</text>
        <text x="830" y="258" fill="#ea580c" font-size="10">L / N / PE</text>
      </g>

      <g v-if="mode === 'unifilaire'" fill="none" stroke="#ea580c" stroke-width="3">
        <path d="M725 145V230" />
      </g>
      <g v-else fill="none" stroke="#ea580c" stroke-width="2">
        <path d="M721 145V230M729 145V230M737 145V230" />
      </g>
      <g v-if="mode === 'unifilaire'" fill="none" stroke="#ea580c" stroke-width="3">
        <path d="M725 310V350H870V310" />
      </g>
      <g v-else fill="none" stroke="#ea580c" stroke-width="2">
        <path d="M721 310V350H866V310M729 310V358H874V310M737 310V366H882V310" />
        <text x="765" y="380" fill="#ea580c" font-size="10">L / N / PE — 230 V AC</text>
      </g>

      <g v-for="node in [
        { x: 30, y: 65, w: 155, h: 80, title: 'Champ photovoltaïque', details: `${panneaux} × ${puissancePanneau} Wc`, extra: `${strings} · ${tensionDC} V DC`, color: '#2563eb' },
        { x: 240, y: 65, w: 155, h: 80, title: 'Protection DC', details: `Fusible ${fusibleDC}`, extra: `Câble ${sectionDC} mm²`, color: '#2563eb' },
        { x: 450, y: 65, w: 155, h: 80, title: 'Régulateur MPPT', details: 'Entrée panneaux PV', extra: 'Sortie vers bus DC', color: '#2563eb' },
        { x: 240, y: 230, w: 155, h: 80, title: 'Batteries', details: `${capaciteBatterie} kWh`, extra: `${tensionDC} V DC · protection DC`, color: '#16a34a' },
        { x: 450, y: 230, w: 155, h: 80, title: 'Onduleur hybride', details: `${onduleur} kVA`, extra: 'DC / AC · réseau en entrée', color: '#0f766e' },
        { x: 660, y: 230, w: 155, h: 80, title: 'Protection AC', details: `Disjoncteur ${disjoncteurAC}`, extra: `Câble ${sectionAC} mm²`, color: '#ea580c' }
      ]" :key="node.title">
        <rect :x="node.x" :y="node.y" :width="node.w" :height="node.h" rx="8" fill="#f8fafc" :stroke="node.color" stroke-width="2" />
        <text :x="node.x + node.w / 2" :y="node.y + 25" text-anchor="middle" fill="#0f172a" font-size="13" font-weight="700">{{ node.title }}</text>
        <text :x="node.x + node.w / 2" :y="node.y + 48" text-anchor="middle" fill="#334155" font-size="12">{{ node.details }}</text>
        <text :x="node.x + node.w / 2" :y="node.y + 66" text-anchor="middle" fill="#64748b" font-size="10">{{ node.extra }}</text>
      </g>

      <rect x="660" y="65" width="155" height="80" rx="8" fill="#fff7ed" stroke="#ea580c" stroke-width="2" />
      <text x="737" y="90" text-anchor="middle" fill="#0f172a" font-size="13" font-weight="700">Entrée réseau AC</text>
      <text x="737" y="113" text-anchor="middle" fill="#334155" font-size="12">{{ groupeActif ? `Réseau + groupe ${puissanceGroupe} kVA` : 'Réseau 230 V' }}</text>
      <text x="737" y="132" text-anchor="middle" fill="#64748b" font-size="10">Source de secours</text>

      <rect x="870" y="230" width="200" :height="hauteurTableau" rx="8" fill="#fff7ed" stroke="#ea580c" stroke-width="2" />
      <text x="970" y="253" text-anchor="middle" fill="#0f172a" font-size="13" font-weight="700">Tableau AC / charges</text>
      <g v-for="(equipement, index) in equipements" :key="`${index}-${equipement.nom}`">
        <line x1="890" :y1="270 + index * 34" x2="1050" :y2="270 + index * 34" stroke="#fed7aa" />
        <text x="890" :y="291 + index * 34" fill="#334155" font-size="11">{{ equipement.quantite }} × {{ equipement.nom || 'Équipement' }}</text>
        <text x="1050" :y="291 + index * 34" text-anchor="end" fill="#64748b" font-size="10">{{ equipement.puissance }} W</text>
      </g>
      <text v-if="equipements.length === 0" x="970" y="291" text-anchor="middle" fill="#64748b" font-size="11">Aucune charge définie</text>

      <text x="30" :y="hauteurSchema - 15" fill="#64748b" font-size="10">
        Schéma de principe — sections et calibres indicatifs, à valider selon les normes et conditions du site.
      </text>
    </svg>
  </div>
</template>

<style scoped>
.schema-electrique {
  overflow-x: auto;
  border-radius: 8px;
}
</style>
