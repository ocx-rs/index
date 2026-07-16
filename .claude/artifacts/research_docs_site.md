# Research: docs_site — readthedocs-style docs for ocx-sh/index

## Metadata

**Date:** 2026-07-16
**Domain:** packaging | ci-cd | web
**Triggered by:** need to document entry schema v1, wire format, namespace policy, and
announce-a-package how-to as first-class versioned docs, without touching the frozen
`index.ocx.sh` JSON wire contract
**Expires:** 2027-01 (re-verify Zensical maturity + Cloudflare Pages/Workers convergence)

## Direct Answer

Use **mdBook**, source in `docs/src/` structured by Diátaxis, deployed to a **second
Cloudflare Pages project** (`ocx-docs` → `docs.ocx.sh`) via a new `docs-deploy.yml`
that clones the self-activating-domain pattern already proven in `deploy.yml`.
Publish the JSON Schema by linking to its canonical GitHub location — never duplicate
it into `docs/`. Keep `.claude/artifacts/*` (ADRs, design specs, research) internal
and unbuilt; `docs/` is the public, versioned, normative surface.

## Technology Landscape

### Trending (gaining momentum)

| Tool/Pattern | Adoption Signal | Key Benefit | Relevance to OCX |
|---|---|---|---|
| Astro Starlight | ~8.4k GH stars, climbing fast, replacing Docusaurus as the default dev-forum recommendation ([docsio.co](https://docsio.co/blog/starlight-docs), [github.com/withastro/starlight](https://github.com/withastro/starlight)) | Islands architecture, near-zero shipped JS | Real option but spends a JS/Astro toolchain token this repo doesn't have; skip for v1 |
| Cloudflare Workers + static assets | Cloudflare's stated 2026 default for **greenfield** static sites; Pages "not deprecated" but features ship to Workers first ([mecanik.dev](https://mecanik.dev/en/posts/cloudflare-pages-vs-workers-which-to-use-in-2026/), [developers.cloudflare.com/workers/static-assets](https://developers.cloudflare.com/workers/static-assets/)) | Unified deploy substrate, full platform access | Note for future greenfield CF deploys; for docs, staying on Pages reuses the proven `deploy.yml` domain-activation pattern verbatim — consistency beats novelty here |
| Zensical (Material for MkDocs successor) | 5.2k stars, ~8 months old (announced 2025-11-05), rewritten from scratch, module system for 3rd parties still opening up ([squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/), [github.com/zensical/zensical](https://github.com/zensical/zensical)) | MkDocs-Material-compatible, modern rebuild | Too early to bet a spec-governance repo on; revisit in 2027 |

### Established (proven, widely accepted)

| Tool/Pattern | Status | Notes |
|---|---|---|
| mdBook | Mature, 20.1k GH stars, `rust-lang` org, active 0.5.0 release cycle in 2026 ([github.com/rust-lang/mdBook](https://github.com/rust-lang/mdBook), [rust-lang.github.io/mdBook](https://rust-lang.github.io/mdBook/)) | Single static binary, zero language toolchain added to repo; builds The Rust Book + rustc-dev-guide; built-in client-side search, no server |
| Diátaxis (tutorials/how-to/reference/explanation) | Industry-standard IA framework, tool-agnostic ([diataxis.fr](https://diataxis.fr/)) | Directly maps onto this repo's content: wire-format spec = reference, announce-a-package = how-to, governance rationale = explanation |
| RFC 2119 + RFC 8174 (BCP 14) keyword boilerplate | Standard for every normative packaging spec studied (PyPA Simple API, IETF) ([datatracker.ietf.org/doc/html/rfc2119](https://datatracker.ietf.org/doc/html/rfc2119), [datatracker.ietf.org/doc/rfc8174](https://datatracker.ietf.org/doc/rfc8174/)) | RFC 8174 closed the "only ALL-CAPS counts" ambiguity gap in RFC 2119; cite both together as BCP 14 |
| Sphinx + MyST / readthedocs.org classic | Still fully supported, free Community plan for OSS, versioned URLs + PR previews out of the box ([about.readthedocs.com/tools/mkdocs](https://about.readthedocs.com/tools/mkdocs/)) | Heavier Python toolchain + third-party hosting account outside the Cloudflare-only infra this repo already automates; no technical blocker, just an extra vendor for no extra capability we need |

### Emerging (early but promising)

| Tool/Pattern | Signal | Worth Watching Because |
|---|---|---|
| Zensical | See Trending row above | If it reaches parity + stabilizes API by 2027, it's the natural MkDocs-Material replacement for teams already on Python |
| mdbook 0.5 native versioning discussions | mdBook itself still has no first-class multi-version story (community relies on per-tag builds into subdirs) | If `format_version` ever bumps to 2, may need to graduate to Docusaurus-style `versioned_docs/` or the per-tag-build trick used by rust-lang edition guides |

### Declining (losing mindshare)

| Tool/Pattern | Signal | Avoid Because |
|---|---|---|
| MkDocs Material (as an *actively developed* choice) | Entered maintenance mode 2025-11-11 (v9.7.0 final feature release); bug/security fixes only for ≥12 months, sponsorware discontinued ([duerrenberger.dev](https://duerrenberger.dev/blog/2025/11/06/material-for-mkdocs-is-no-more-long-live-zensical/), [docsio.co/blog/mkdocs-material](https://docsio.co/blog/mkdocs-material)) | Still usable and stable, but picking it new in 2026 means either riding a frozen feature set or betting on the unproven successor (Zensical) — worse risk profile than mdBook for a repo starting from zero |
| Plain unrendered `docs/*.md` browsed only via GitHub | No dedicated site, no search, no custom domain | GitHub natively renders Mermaid + tables today, so it's a legitimate zero-effort fallback (OCI distribution-spec uses exactly this: `spec.md` in-repo, no doc site) — but the task explicitly asks for "first-class, versioned docs" at a hosted URL, which this doesn't deliver |

## Design Patterns Worth Considering

- **Spec repo with prose-only doc site, no built app** — OCI distribution-spec keeps `spec.md` + `content-negotiation.md` as plain GitHub-rendered markdown, one-sentence-per-line for clean diffs, `RELEASES.md` for version history, no dedicated static site at all. [github.com/opencontainers/distribution-spec](https://github.com/opencontainers/distribution-spec). Validates that a spec-heavy repo doesn't *need* a fancy generator — but OCX explicitly wants a hosted, browsable, versioned surface, so this repo should still build a site; the pattern to borrow is the one-sentence-per-line diff discipline for the wire-format page.
- **Chronological "History" section keyed to the actual spec** — PyPA's Simple Repository API ends with a `History` section listing each behavioral change tied to the PEP that introduced it (Sept 2015 → Jun 2026). [packaging.python.org/en/latest/specifications/simple-repository-api](https://packaging.python.org/en/latest/specifications/simple-repository-api/). OCX equivalent: a `changelog.md` keyed to `format_version` bumps, each entry linking the governance PR that changed it — lighter-weight than full Keep a Changelog (Added/Changed/Deprecated/Removed/Fixed/Security categories, semver) since only additive `format_version` events matter here. [keepachangelog.com/en/1.1.0](https://keepachangelog.com/en/1.1.0/)
- **Interactive contribution script + presubmit bot** — BCR's `bazel run //tools:add_module` + `bazel-io` bot auto-pinging maintainers is the pattern this repo's `announce.yml`/`validate.yml` already mirrors at the CI level (G-04/G-08); document it in `how-to/announce-a-package.md` the same way BCR's `docs/README.md` documents theirs. [github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md)
- **Index-shape doc that mirrors the actual directory layout** — Cargo's `registry-index.html` documents `config.json` + the `/1/`, `/2/`, `/ab/cd/` sharding rule + the sparse-protocol ETag/caching semantics in one reference page. [doc.rust-lang.org/cargo/reference/registry-index.html](https://doc.rust-lang.org/cargo/reference/registry-index.html). Direct template for `reference/wire-format.md` here — this repo's `/p/<namespace>/<package>.json` shape is the same lineage.

## Key Findings

1. mdBook is a single statically-linked binary (no Python/Node toolchain added to a repo that currently ships neither) and is already the doc tool of the Rust project this index's model (crates.io/Cargo sparse index) descends from — strongest boring-tech + thematic fit. [github.com/rust-lang/mdBook](https://github.com/rust-lang/mdBook)
2. MkDocs Material — the default pick most comparison articles still lead with — entered maintenance mode 2025-11-11; picking it new in mid-2026 means adopting a feature-frozen tool or betting on 8-month-old Zensical. [duerrenberger.dev/blog/2025/11/06/material-for-mkdocs-is-no-more-long-live-zensical](https://duerrenberger.dev/blog/2025/11/06/material-for-mkdocs-is-no-more-long-live-zensical/)
3. Cloudflare now steers **new** static sites toward Workers + static assets, not Pages, but this repo already has a working, self-activating custom-domain Pages deploy pattern (`deploy.yml`) worth reusing verbatim for a second project rather than introducing a second CF product for one extra property. [developers.cloudflare.com/workers/static-assets](https://developers.cloudflare.com/workers/static-assets/)
4. Every normative spec exemplar studied (PyPA Simple API) uses the RFC 2119 + RFC 8174 (BCP 14) boilerplate verbatim at the top of the normative section — OCX's `wire-format.md` and `entry-schema.md` should do the same. [datatracker.ietf.org/doc/rfc8174](https://datatracker.ietf.org/doc/rfc8174/)
5. Cargo's registry-index reference page and PyPA's spec index both keep the JSON Schema/field table **in prose next to a link to the canonical machine-readable file**, never duplicated inline as a second copy that can drift. [packaging.python.org/en/latest/specifications](https://packaging.python.org/en/latest/specifications/)
6. Read the Docs remains a legitimate free option with native MkDocs support, versioned URLs, and PR previews, but it's a third-party account/vendor outside the Cloudflare-only infra this repo already automates for zero added capability the repo needs. [about.readthedocs.com/tools/mkdocs](https://about.readthedocs.com/tools/mkdocs/)

## Recommendation

**Tooling:** mdBook. Zero new language toolchain (download one binary in CI, same
posture as `task`/`jq` already in this repo), native search, `mdbook-mermaid`
preprocessor covers diagrams, and it's literally the tool the upstream ecosystem
(crates.io/Cargo) this index borrows its whole model from already uses for its own
docs — the closest thing to "boring + on-brand" available. Passed over MkDocs
Material (maintenance mode, Nov 2025) and Zensical (too new, 8 months old) as
higher-risk; passed over Docusaurus/Starlight/Sphinx as unnecessary toolchain spend
for a repo shipping zero JS/Python tooling today (the Python announce bot, once it
lands, still doesn't make a JS-based generator "free" — it's an unrelated stack).

**Hosting:** second Cloudflare Pages project (`ocx-docs`), custom domain `docs.ocx.sh`,
deployed by a new `docs-deploy.yml` that copies the exact self-activating-domain
mechanism already proven in `.github/workflows/deploy.yml`. Completely separate Pages
project/zone record from `ocx-index` — zero shared cache surface, so the "never cache
`*.json`" invariant on the index zone is structurally unaffected by whatever caching
policy the docs site uses (docs *should* be normally CDN-cached; that's fine, it's not
the JSON index).

**Structure (Diátaxis):**
```
docs/
├── book.toml
└── src/
    ├── SUMMARY.md
    ├── index.md                          # landing page
    ├── tutorials/
    │   └── query-the-index-with-curl.md  # first successful pointer-file fetch
    ├── how-to/
    │   ├── announce-a-package.md         # flagship how-to (repository_dispatch flow)
    │   ├── register-a-namespace.md
    │   ├── yank-a-version.md
    │   └── ops/                          # runbooks live here, not a 5th Diátaxis quadrant
    │       ├── rotate-announce-pat.md
    │       └── run-reconcile-dry-run.md
    ├── reference/
    │   ├── wire-format.md                # normative, RFC 2119/8174 boilerplate
    │   ├── entry-schema.md               # field table, links schema/entry.schema.json
    │   ├── governance-contracts.md       # G-01..G-18 as a reference table
    │   └── changelog.md                  # format_version history, PyPA-"History"-style
    └── explanation/
        ├── why-a-sparse-index.md
        ├── logical-vs-physical-plane.md
        └── namespace-ownership-model.md
```

**Internal vs public split:** `.claude/artifacts/*` (ADRs, design spec, research,
handover) stays exactly where it is — git-browsable only, not part of the mdBook
build, audience = maintainers/agents doing design work. `docs/` is the sole public
surface built to `docs.ocx.sh`; it may *link out* to an ADR on GitHub for "why we
chose X" but must never duplicate normative content from `.claude/artifacts` (single
source of truth, DRY). `schema/entry.schema.json` stays canonical at repo root;
`reference/entry-schema.md` renders a table and links the raw GitHub file — no copy.

**Versioning (deliberately deferred complexity):** mdBook has no native
`versioned_docs/` equivalent (unlike Docusaurus). Don't build one yet — the wire
contract is additive-only by design (`format_version` gates breaks), so "current docs
describe the current format_version, plus one changelog page recording history" is
sufficient for v1. Revisit multi-version site builds (per-tag mdBook builds into
subdirectories, the technique rust-lang uses for edition guides) only if/when
`format_version` actually bumps to 2 and old-client docs need preserving — YAGNI until
then.

## Sources

| Source | Type | Date | Relevance |
|---|---|---|---|
| [rust-lang/mdBook](https://github.com/rust-lang/mdBook) | Repo | 2026 (0.5.0 cycle active) | mdBook maturity, stars, maintainer org |
| [rust-lang.github.io/mdBook](https://rust-lang.github.io/mdBook/) | Docs | current | mdBook feature set, CI integration |
| [Material for MkDocs — Zensical announcement](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/) | Blog | 2025-11-05 | Maintenance-mode transition, successor project |
| [duerrenberger.dev — Material for MkDocs is no more](https://duerrenberger.dev/blog/2025/11/06/material-for-mkdocs-is-no-more-long-live-zensical/) | Blog | 2025-11-06 | Independent confirmation + community reaction |
| [zensical/zensical](https://github.com/zensical/zensical) | Repo | 2026 | Star count, maturity signal |
| [Astro Starlight](https://github.com/withastro/starlight) | Repo | 2026 | Trending alternative, adoption trajectory |
| [Docusaurus versioning docs](https://docusaurus.io/docs/versioning) | Docs | current | `versioned_docs/` mechanism, contrast with mdBook |
| [Diátaxis](https://diataxis.fr/) | Framework site | current | IA framework applied to docs/ tree |
| [Cargo — registry-index reference](https://doc.rust-lang.org/cargo/reference/registry-index.html) | Docs | current | Exemplar: sparse-index reference page structure |
| [PyPA — Specifications index](https://packaging.python.org/en/latest/specifications/) | Docs | current | Exemplar: spec categorization |
| [PyPA — Simple Repository API spec](https://packaging.python.org/en/latest/specifications/simple-repository-api/) | Docs | current | RFC 2119 usage, "History" changelog pattern |
| [OCI distribution-spec](https://github.com/opencontainers/distribution-spec) | Repo | current | Exemplar: plain-markdown spec repo, no site |
| [Bazel Central Registry docs/README](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md) | Repo | current | Exemplar: contribution/how-to + governance doc |
| [OpenTofu — Publishing Modules](https://opentofu.org/docs/language/modules/develop/publish/) | Docs | current | Exemplar: registry publish how-to |
| [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) | RFC | 1997 | Requirement-level keywords |
| [RFC 8174](https://datatracker.ietf.org/doc/rfc8174/) | RFC | 2017 | Capitalization clarification, BCP 14 pairing |
| [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) | Convention site | current | Changelog format convention (adapted, not adopted verbatim) |
| [Read the Docs — MkDocs deployment](https://about.readthedocs.com/tools/mkdocs/) | Docs | current | Alternative hosting evaluated and passed over |
| [Cloudflare Pages — custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/) | Docs | current | Second-project/custom-domain mechanics reused from existing deploy.yml |
| [Cloudflare Workers — static assets](https://developers.cloudflare.com/workers/static-assets/) | Docs | current | 2026 platform direction, noted but not adopted for consistency reasons |
