<script setup lang="ts">
import { Content } from 'vitepress'
</script>

<template>
  <!-- ponytail: Wave-1 stub, replaced by WP-C/D/E -->
  <main class="docs-page">
    <div class="docs-prose">
      <Content />
    </div>
  </main>
</template>

<style scoped>
.docs-page {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 40px 24px 64px;
}

.docs-prose {
  width: 100%;
  max-width: 720px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--c-text-2);
}

.docs-prose :deep(h1),
.docs-prose :deep(h2),
.docs-prose :deep(h3) {
  color: var(--c-text-1);
  line-height: 1.3;
}

.docs-prose :deep(h1) {
  font-size: var(--text-2xl);
  font-weight: 700;
}

.docs-prose :deep(h2) {
  font-size: var(--text-xl);
  font-weight: 600;
  margin-top: 2em;
}

.docs-prose :deep(h3) {
  font-size: var(--text-lg);
  font-weight: 600;
}

.docs-prose :deep(a) {
  color: var(--c-accent);
}

.docs-prose :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--c-surface-2);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
}

.docs-prose :deep(pre) {
  background: #14181f;
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  overflow-x: auto;
}

.docs-prose :deep(pre code) {
  background: none;
  padding: 0;
}

.docs-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.docs-prose :deep(th),
.docs-prose :deep(td) {
  border: 1px solid var(--c-line);
  padding: 8px 12px;
  text-align: left;
}
</style>
