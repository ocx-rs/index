import { onMounted, ref } from 'vue'

// Shape of `/data/catalog/catalog.json` per the plan's frozen "Site fetch
// layer" contract — NOT the wire contract (that's `/config.json` +
// `/p/**`, see `usePackageRoot`/`useObservation`). Render-pipeline-owned,
// camelCase, free to evolve between deploys.

export interface CatalogPackage {
  namespace: string
  package: string
  name: string
  status: 'active' | 'deprecated' | 'yanked'
  deprecatedMessage: string | null
  supersededBy: string | null
  title: string
  description: string
  keywords: string[]
  latestVersion: string | null
  tagCount: number
  /** `os/arch` strings, e.g. `linux/amd64` — union across all non-yanked tags. */
  platforms: string[]
  logoUrl: string | null
  readmeUrl: string | null
}

export interface CatalogData {
  generated: string | null
  packages: CatalogPackage[]
}

const EMPTY_CATALOG: CatalogData = { generated: null, packages: [] }

/**
 * Fetches `/data/catalog/catalog.json`. A 404 (render pipeline hasn't run
 * yet, or a fresh deploy before the first run) and any other fetch failure
 * both degrade to the same empty catalog — this composable never throws to
 * the render tree.
 */
export function useCatalog() {
  const catalog = ref<CatalogData>(EMPTY_CATALOG)
  const loading = ref(true)

  onMounted(async () => {
    try {
      const resp = await fetch('/data/catalog/catalog.json')
      if (resp.status === 404) {
        catalog.value = EMPTY_CATALOG
        return
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      catalog.value = await resp.json()
    } catch {
      catalog.value = EMPTY_CATALOG
    } finally {
      loading.value = false
    }
  })

  return { catalog, loading }
}
