import type { CatalogPackage } from '../composables/useCatalog'

// Pure filter over catalog packages — shared by the catalog page's inline
// filter (WP-C) and the future ⌘K command palette (WP-E's Packages result
// group). Facets combine with AND; multiple values within one facet
// (multiple platform chips, multiple keyword chips) combine with OR.

export interface PackageFilter {
  /** Matched case-insensitively against name/title/description/keywords. */
  query?: string
  /** OS strings (`linux`/`darwin`/`windows`) — package matches if it ships ANY of these. */
  platforms?: string[]
  /** Package matches if it carries ANY of these keywords. */
  keywords?: string[]
  /** When true, only `status === 'deprecated'` packages match. */
  deprecatedOnly?: boolean
}

export function filterPackages(packages: CatalogPackage[], filter: PackageFilter): CatalogPackage[] {
  const query = filter.query?.trim().toLowerCase()

  return packages.filter((pkg) => {
    if (query) {
      const haystack = `${pkg.name} ${pkg.title} ${pkg.description} ${pkg.keywords.join(' ')}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }

    if (filter.platforms?.length) {
      const pkgOses = new Set(pkg.platforms.map(p => p.split('/')[0]))
      if (!filter.platforms.some(os => pkgOses.has(os))) return false
    }

    if (filter.keywords?.length) {
      if (!filter.keywords.some(kw => pkg.keywords.includes(kw))) return false
    }

    if (filter.deprecatedOnly && pkg.status !== 'deprecated') return false

    return true
  })
}
