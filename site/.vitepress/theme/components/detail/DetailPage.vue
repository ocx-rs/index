<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { usePackageRoot } from '../../composables/usePackageRoot'

const { params } = useData()
const ns = computed(() => (params.value?.ns as string | undefined) ?? '')
const pkg = computed(() => (params.value?.pkg as string | undefined) ?? '')

const { root, loading, error, notFound } = usePackageRoot(ns, pkg)

const qualifiedName = computed(() => `${ns.value}/${pkg.value}`)
const tags = computed(() => (root.value ? Object.keys(root.value.tags) : []))
</script>

<template>
  <!-- ponytail: Wave-1 stub, replaced by WP-C/D/E -->
  <main class="detail-page">
    <p v-if="loading" class="detail-status">Loading…</p>
    <p v-else-if="notFound" class="detail-status">Package not found: {{ qualifiedName }}</p>
    <p v-else-if="error" class="detail-status">Failed to load: {{ error }}</p>
    <template v-else-if="root">
      <h1 class="detail-name">{{ root.name }}</h1>
      <ul class="detail-tags">
        <li v-for="tag in tags" :key="tag">{{ tag }}</li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.detail-page {
  flex: 1;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 48px 24px;
}

.detail-status {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--c-text-3);
}

.detail-name {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--c-text-1);
  margin: 0 0 16px;
}

.detail-tags {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--c-text-2);
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
