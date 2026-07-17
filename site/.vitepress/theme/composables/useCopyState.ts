import { ref } from 'vue'
import { useClipboard } from '@vueuse/core'

/**
 * Clipboard copy + timed "copied" flag reset — the boilerplate duplicated
 * across `CopySnippet.vue`/`TagBadge.vue` today, factored out for every
 * WP-C/D copy affordance (`InstallRow.vue` and beyond) to share.
 *
 * `timeoutMs` defaults to 1500 (the existing `CopySnippet.vue` convention;
 * design mock: "green check 1.5s").
 */
export function useCopyState(timeoutMs = 1500) {
  const { copy } = useClipboard()
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function copyText(text: string) {
    await copy(text)
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, timeoutMs)
  }

  return { copied, copyText }
}
