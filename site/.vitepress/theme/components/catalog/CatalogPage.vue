<script setup lang="ts">
import { useCatalog } from '../../composables/useCatalog'

const { catalog, loading } = useCatalog()
</script>

<template>
  <!-- ponytail: Wave-1 stub, replaced by WP-C/D/E -->
  <main class="catalog-page">
    <p v-if="loading" class="catalog-status">Loading…</p>
    <p v-else-if="catalog.packages.length === 0" class="catalog-status">No packages yet</p>
    <ul v-else class="catalog-list">
      <li v-for="pkg in catalog.packages" :key="pkg.name">
        <a :href="`/${pkg.name}`">{{ pkg.name }}</a>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.catalog-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
}

.catalog-status {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--c-text-3);
}

.catalog-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
