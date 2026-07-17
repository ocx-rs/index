<script setup lang="ts">
import { useData } from 'vitepress'
import SiteHeader from './components/layout/SiteHeader.vue'
import CatalogPage from './components/catalog/CatalogPage.vue'
import DetailPage from './components/detail/DetailPage.vue'
import DocLayout from './components/docs/DocLayout.vue'
import NotFound from './NotFound.vue'

// Plain v-if dispatch, no global component registration (blank theme —
// see index.mts). SiteHeader always renders, including on the 404 page.
const { page, frontmatter } = useData()
</script>

<template>
  <div class="theme-shell">
    <SiteHeader />
    <NotFound v-if="page.isNotFound" />
    <CatalogPage v-else-if="frontmatter.layout === 'catalog'" />
    <DetailPage v-else-if="frontmatter.layout === 'detail'" />
    <DocLayout v-else />
  </div>
</template>

<style scoped>
.theme-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
