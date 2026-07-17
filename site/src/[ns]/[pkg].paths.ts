import { basename, resolve } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import { defineRoutes } from 'vitepress'

// cwd invariant: this loader runs inside VitePress's Node build/dev
// process, which is always invoked with `site/` as the working directory
// (`package.json`'s `dev`/`build` scripts run `vitepress dev`/`vitepress
// build` directly; `taskfile.yml`'s `site:build` task is `cd site && bun
// install && bun run build`). `resolve(process.cwd(), '..', 'p')` therefore
// resolves to the repo-root `p/` tree. If that invariant ever changes (e.g.
// VitePress invoked from the repo root instead), this silently discovers
// zero packages rather than failing the build — consistent with the
// empty-`p/`/missing-`/data/catalog` degrade-never-fail contract, but every
// detail page would then 404.
const P_DIR = resolve(process.cwd(), '..', 'p')

interface PackageParams {
  ns: string
  pkg: string
}

/** `{ns, pkg}` for every `p/<ns>/<pkg>.json` package root — mirrors the
 * bot's own `_package_roots` discovery (`cli/render.py`): a package id is
 * exactly a `.json` file one level under a namespace directory, which
 * excludes every CAS subtree entry (`p/<ns>/<pkg>/o/sha256/**`, always a
 * directory at this depth, never a file). */
function discoverPackages(): PackageParams[] {
  if (!existsSync(P_DIR)) return []

  const params: PackageParams[] = []
  for (const nsEntry of readdirSync(P_DIR, { withFileTypes: true })) {
    if (!nsEntry.isDirectory()) continue
    const nsDir = resolve(P_DIR, nsEntry.name)
    for (const pkgEntry of readdirSync(nsDir, { withFileTypes: true })) {
      if (pkgEntry.isFile() && pkgEntry.name.endsWith('.json')) {
        params.push({ ns: nsEntry.name, pkg: basename(pkgEntry.name, '.json') })
      }
    }
  }
  return params
}

export default defineRoutes({
  // Relative to this file's own directory (`site/src/[ns]/`) — VitePress
  // resolves `watch` against `path.dirname(pathsFile)`, so three levels up
  // reaches the repo root, then into `p/*/*.json` (every package root,
  // never a CAS object — those are 4+ segments deep).
  watch: '../../../p/*/*.json',
  paths: () => discoverPackages().map(params => ({ params })),
})
