<script setup lang="ts">
import { computed } from 'vue'
import { OS_GLYPHS, osRank } from '../../utils/osGlyphs'
import type { PlatformEntry } from '../../composables/useObservation'

// Presentational only — glyph + label + arch chips from one observation
// object's `platforms[]`. DetailPage/MetaRail own the hover-driven fetch
// (`useObservation`); this component just renders whatever it's handed.
const props = defineProps<{
  platforms: PlatformEntry[]
}>()

interface PlatformGroup {
  os: string
  label: string
  arches: string[]
}

const groups = computed<PlatformGroup[]>(() => {
  const byOs = new Map<string, string[]>()
  for (const entry of props.platforms) {
    const os = entry.platform.os
    const arch = entry.platform.architecture
    const arches = byOs.get(os) ?? []
    if (!arches.includes(arch)) arches.push(arch)
    byOs.set(os, arches)
  }
  return [...byOs.entries()]
    .map(([os, arches]) => ({ os, label: OS_GLYPHS[os]?.label ?? os, arches: [...arches].sort() }))
    .sort((a, b) => osRank(a.os) - osRank(b.os) || a.os.localeCompare(b.os))
})
</script>

<template>
  <div v-if="groups.length" class="platform-matrix">
    <div v-for="group in groups" :key="group.os" class="platform-row">
      <span class="platform-glyph">
        <svg v-if="OS_GLYPHS[group.os]" width="16" height="16" :viewBox="OS_GLYPHS[group.os].viewBox" aria-hidden="true">
          <path v-for="(d, i) in OS_GLYPHS[group.os].paths || []" :key="`p${i}`" :d="d" fill="currentColor" />
          <rect v-for="(r, i) in OS_GLYPHS[group.os].rects || []" :key="`r${i}`" :x="r.x" :y="r.y" :width="r.w" :height="r.h" fill="currentColor" />
        </svg>
      </span>
      <span class="platform-label">{{ group.label }}</span>
      <span class="platform-arches">
        <span v-for="arch in group.arches" :key="arch" class="platform-arch">{{ arch }}</span>
      </span>
    </div>
  </div>
  <p v-else class="platform-empty">Hover a version to preview its platforms.</p>
</template>

<style scoped>
.platform-matrix {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.platform-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.platform-glyph {
  color: var(--c-text-2);
  display: inline-flex;
  width: 18px;
  justify-content: center;
  flex-shrink: 0;
}

.platform-label {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--c-text-1);
  width: 70px;
  flex-shrink: 0;
}

.platform-arches {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.platform-arch {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: 500;
  color: var(--c-text-2);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
  padding: 2px 7px;
}

.platform-empty {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--c-text-3);
  margin: 0;
}
</style>
