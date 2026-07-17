<script setup lang="ts">
import { useCopyState } from '../../composables/useCopyState'

const props = defineProps<{
  /** Bare `<ns>/<pkg>` — this component builds the full `ocx add
   * ocx.sh/<name>` command itself. Never pass `root.name` here (it already
   * carries the `ocx.sh/` prefix — see `usePackageRoot`'s CAS-gotcha
   * docblock for the same trap on CAS URLs). */
  name: string
}>()

const { copied, copyText } = useCopyState(1500)

const command = `ocx add ocx.sh/${props.name}`
</script>

<template>
  <button type="button" class="install-row" :class="{ copied }" @click="copyText(command)">
    <span class="install-prefix">$</span>
    <span class="install-cmd">{{ command }}</span>
    <svg
      v-if="!copied"
      class="install-icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
    <svg
      v-else
      class="install-icon install-icon-check"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </button>
</template>

<style scoped>
.install-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-md);
  padding: 6px 9px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: left;
}

.install-row:hover,
.install-row:focus-visible {
  border-color: var(--c-accent);
}

.install-prefix {
  color: var(--c-accent);
  font-weight: 600;
  font-size: var(--text-xs);
  flex-shrink: 0;
}

.install-cmd {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-xs);
  color: var(--c-text-1);
}

.install-icon {
  flex-shrink: 0;
  color: var(--c-text-3);
}

.install-row.copied {
  border-color: var(--c-ok);
}

.install-row.copied .install-cmd {
  color: var(--c-ok);
}

.install-icon-check {
  color: var(--c-ok);
}
</style>
