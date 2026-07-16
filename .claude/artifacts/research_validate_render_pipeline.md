# Research: Validation + Render Pipeline Tooling (validate.yml / render-deploy.yml)

## Metadata

**Date:** 2026-07-16
**Domain:** ci-cd | packaging | security
**Triggered by:** repo bootstrap — design `validate.yml`/`render-deploy.yml` + `task verify`
before entry schema v1 + 42 seed entries land
**Expires:** 2027-01 (re-verify Cloudflare Pages behavior + check-jsonschema/jsonschema
release notes; both move fast)

## Direct Answer

1. **Schema tooling.** JSON Schema **draft 2020-12** is still the latest released draft
   in 2026 — a successor is in IETF Internet-Draft status only (`draft-ietf-jsonschema-json-schema-02`,
   expires 2027-01), not shippable yet ([json-schema.org/specification-links](https://json-schema.org/specification-links),
   [json-schema.org blog](https://json-schema.org/blog/posts/stable-json-schema)). Pin it
   explicitly via `"$schema": "https://json-schema.org/draft/2020-12/schema"` in both
   `schema/entry.schema.json` and `schema/config.schema.json` — don't rely on library
   defaults, which track "latest" and can silently shift on upgrade
   ([python-jsonschema validators docs](https://python-jsonschema.readthedocs.io/en/stable/api/jsonschema/validators/)).
   For a repo whose only toolchain is uv/Python + Taskfile: **`check-jsonschema`**
   (`pip`/`uvx`/`uv tool run check-jsonschema`) — pure-Python, built by the
   `python-jsonschema` org on top of the `jsonschema` library, actively released
   (0.37.4, 2026-06-29, Python ≥3.10), ships pre-commit hooks and CI-friendly output
   ([GitHub](https://github.com/python-jsonschema/check-jsonschema),
   [PyPI](https://pypi.org/project/check-jsonschema/)). Reject the two alternatives:
   `ajv-cli` is Node — a second toolchain the repo doesn't otherwise need, and is
   effectively unmaintained (no releases in 12mo, last commit 3 years ago per
   maintainers' own issue thread, [ajv-cli#241](https://github.com/ajv-validator/ajv-cli/issues/241));
   `sourcemeta/jsonschema` (C++/CMake binary, [repo](https://github.com/sourcemeta/jsonschema))
   is a capable emerging CLI (fmt/lint/bundle/test) but is a third binary dependency —
   not worth an innovation token here. Schemas live at the already-fixed
   `schema/entry.schema.json` + `schema/config.schema.json` (design spec §2f layout, not
   re-litigable) — docs should `include`/embed that file by reference (mkdocs snippet
   include), never copy-paste its contents, per DRY.

2. **Beyond-schema checks.** JSON Schema can't express: path↔name consistency (G-02),
   repository host allowlist (G-03), or the registry-manifest ownership probe (G-15) —
   these need a small custom Python script (e.g. `scripts/validate_entries.py`) run via
   `uv run` after `check-jsonschema` passes. Prior art for this exact split (schema +
   custom cross-file/registry checks) is Bazel Central Registry's `bcr_validation.py`,
   which layers "verify module version matches metadata.json", "verify source archive
   URL is stable", "verify integrity values" on top of basic schema shape
   ([BCR docs](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md),
   [bcr_presubmit.py](https://github.com/bazelbuild/continuous-integration/blob/master/buildkite/bazel-central-registry/bcr_presubmit.py)).
   For golden/snapshot testing of the validator and renderer: start with plain `pytest`
   + checked-in fixture files (`tests/fixtures/p/...` in, expected `public/...` out,
   compared with a plain string-equality assert) — no new dependency, trivially readable.
   Reach for `syrupy` (zero-dep pytest snapshot plugin, [docs](https://syrupy-project.github.io/syrupy/))
   only if the fixture count/complexity grows past what hand-rolled comparison can carry;
   don't add it on day one for ~42 entries.

3. **Render step.** Keep it boring: `p/<ns>/<pkg>.json` (source) → `public/p/<ns>/<pkg>.json`
   (copy/normalize) + generated `public/config.json`. Every package-index prior art
   examined keeps the **pointer/data repo's CI scoped to machine-readable output only**
   and treats any human-browsable catalog as a *separate* system: crates.io's sparse
   index has no HTML catalog at all (crates.io the website is a distinct app reading
   Postgres); the Bazel Central Registry repo is pure data, `registry.bazel.build` is a
   separate site; OpenTofu's `opentofu/registry` data repo is consumed by a separate
   Next.js/Go app at `registry.opentofu.org`
   ([opentofu/registry](https://github.com/opentofu/registry),
   [provider mirror protocol](https://opentofu.org/docs/internals/provider-network-mirror-protocol/));
   winget-pkgs ships no catalog UI from its own CI at all
   ([winget-pkgs schema docs](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.9.0/README.md)).
   **Recommendation: skip the catalog page in v1** — this matches the GAP already
   flagged in the handover, and keeps `render-deploy.yml` scoped to the one-way-door wire
   contract only. If/when built, it's a few dozen lines with stdlib `string.Template` or
   f-strings (42–300 flat records need no templating engine); only reach for Jinja2 if
   the readthedocs-style docs site already pulls it in as a dependency (then it's a
   zero-marginal-cost reuse, not a new tool).

4. **Cloudflare Pages specifics (confirmed against current docs).** Pages "always sends
   `Etag` headers for `200 OK` responses" and serves `304` on a matching
   `If-None-Match`; default `Cache-Control` for normal assets is
   **`public, max-age=0, must-revalidate`** — i.e. conditional-GET revalidation is
   already the *default* behavior, with no `_headers` file needed for `*.json`
   ([Serving Pages docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)).
   This is exactly why the repo's existing "never add a Cloudflare zone Cache Rule for
   `*.json`" invariant matters: a zone-level Cache Rule is the one mechanism that can
   override this sane Pages default and serve stale bytes without origin revalidation —
   docs don't specify strong-vs-weak ETag explicitly, but Cloudflare's general ETag
   behavior can convert strong to weak in some paths
   ([Cloudflare ETag reference](https://developers.cloudflare.com/cache/reference/etag-headers/)),
   which is irrelevant here since `If-None-Match` semantics work either way for this
   use case. `_headers` file: max 100 rules, 2000 chars/line, and **does not apply to
   Pages Functions responses** (n/a here, no Functions in this repo)
   ([Headers docs](https://developers.cloudflare.com/pages/configuration/headers/)).
   Limits at 42→few-hundred files are non-issues: 20,000 files (Free) / 100,000 (Paid)
   per deployment, 25 MiB max file size
   ([Limits docs](https://developers.cloudflare.com/pages/platform/limits/)). Uploads are
   incremental/deduplicated by content hash — unchanged files aren't re-uploaded, only
   changed ones — but every deploy still publishes a complete, addressable file set.

5. **Atomicity.** Cloudflare's own docs explicitly call preview deployments "atomic and
   may always be visited" ([Preview deployments docs](https://developers.cloudflare.com/pages/configuration/preview-deployments/));
   for production, the Rollbacks doc's language — "your project's production deployment
   will change **instantly**" — describes the same pointer-swap mechanism: each `wrangler
   pages deploy` invocation uploads one complete asset manifest and creates one
   deployment record; promoting to production flips which deployment is live, it does not
   patch files in place ([Rollbacks docs](https://developers.cloudflare.com/pages/configuration/rollbacks/)).
   Cloudflare's docs never use the literal word "atomic" for the production case, so
   treat that framing as strongly-implied-by-mechanism rather than a directly-quoted
   guarantee — but the existing `deploy.yml`'s single `pages deploy public
   --project-name=ocx-index` step already deploys `config.json` and every `p/*.json`
   pointer file together in one deployment, so "client sees mismatched generations" is
   not reachable through this pipeline regardless.

6. **validate.yml / render-deploy.yml shape** — see Design Patterns below.

## Technology Landscape

### Established (proven, widely accepted)
| Tool/Pattern | Status | Notes |
|---|---|---|
| JSON Schema draft 2020-12 | Standard | Current released draft; next draft is IETF-track only, not final ([spec links](https://json-schema.org/specification-links)) |
| `check-jsonschema` | Mature, active | Python-native, wraps `jsonschema`, GH Actions/pre-commit built in ([repo](https://github.com/python-jsonschema/check-jsonschema)) |
| Schema-validate-then-custom-script split | Mature | BCR's exact pattern: schema for shape, script for cross-file/registry truth ([BCR](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md)) |
| Pointer-repo ≠ catalog-UI separation | Mature, near-universal | crates.io, BCR, OpenTofu, winget-pkgs all split data repo from browsable site |

### Declining (avoid investing)
| Tool/Pattern | Signal | Avoid Because |
|---|---|---|
| `ajv-cli` | No releases 12mo, last commit 3yr | Effectively unmaintained per maintainers ([issue #241](https://github.com/ajv-validator/ajv-cli/issues/241)); also a second (Node) toolchain this repo doesn't need |

### Emerging (early but promising, not recommended here)
| Tool/Pattern | Signal | Worth Watching Because |
|---|---|---|
| `sourcemeta/jsonschema` CLI | Active repo, C++/CMake, fmt/lint/bundle/test | Genuinely more capable single-binary JSON Schema tool ([repo](https://github.com/sourcemeta/jsonschema)) — reconsider only if the repo later needs schema bundling/linting beyond instance validation |

## Design Patterns Worth Considering

- **Unprivileged/privileged split for PR validation (G-16)** — `validate.yml` runs on
  `pull_request` (default `permissions: contents: read`, no secrets, safe to execute
  PR-authored code since GitHub strips secrets for this trigger); a separate job (or
  workflow) handles labeling/gating using only base-branch code, never
  `pull_request_target` on PR-head content. Matches this repo's existing security
  invariant verbatim.
- **Concrete shape:**
  - `validate.yml` (`on: pull_request`, `permissions: contents: read`):
    1. checkout PR head (unprivileged, no secrets)
    2. `astral-sh/setup-uv` (pinned by SHA)
    3. `uv run check-jsonschema --schemafile schema/entry.schema.json p/**/*.json` +
       same for `schema/config.schema.json` against `public/config.json` — schema gate
       first, cheapest fail-fast check
    4. `uv run scripts/validate_entries.py` — G-02 (name↔path), G-03 (repository
       allowlist regex), G-15 (fetch physical manifest, compare embedded canonical
       identifier to entry `name`) — anonymous public GHCR reads, no secrets needed
    5. Exit non-zero blocks merge (required status check)
  - `render-deploy.yml` (`on: push` to `main`, `permissions: contents: read`, keeps
    `concurrency: deploy-pages` from today's `deploy.yml`):
    1. checkout `main` (trusted)
    2. `uv run scripts/render.py` → writes `public/p/**/*.json` + `public/config.json`
       into the workspace (not committed — see open question below)
    3. `uv run check-jsonschema` again against the **rendered** output — cheap,
       catches renderer bugs before they ship (belt-and-suspenders on top of step 3
       of `validate.yml`, which only checked the source)
    4. Existing wrangler steps unchanged: ensure Pages project (idempotent,
       `continue-on-error`), `pages deploy public --project-name=ocx-index`, then
       domain/DNS self-activation block — this ordering already guarantees one
       deployment carries the full, consistent file set (see Q5 above)
- **Fail-fast ordering** — schema validation before custom Python checks before network
  calls (G-15's manifest fetch) — cheapest/fastest checks first, consistent with
  standard CI cost-ordering practice.

## Key Findings

1. Draft 2020-12 is current; a successor exists only as an IETF Internet-Draft
   (expires 2027-01), not yet usable — [json-schema.org/blog/posts/stable-json-schema](https://json-schema.org/blog/posts/stable-json-schema).
2. `check-jsonschema` 0.37.4 (2026-06-29) is the actively maintained Python-native pick
   that fits a uv-only toolchain with zero new runtimes — [PyPI](https://pypi.org/project/check-jsonschema/).
3. `ajv-cli` is effectively abandoned (no release in 12 months) per its own maintainers
   — [ajv-cli#241](https://github.com/ajv-validator/ajv-cli/issues/241).
4. Cloudflare Pages' *default* `Cache-Control` (`public, max-age=0, must-revalidate`)
   already implements the freshness contract this repo needs — no `_headers` file
   required for `*.json`; the danger is exclusively a zone-level Cache Rule overriding
   it — [Serving Pages docs](https://developers.cloudflare.com/pages/configuration/serving-pages/).
5. Every comparable package-index project (crates.io, BCR, OpenTofu registry,
   winget-pkgs) keeps the pointer-data repo's CI scoped to machine-readable output and
   builds any human catalog as a separate system — supports deferring the catalog page.
6. `schema/entry.schema.json` + `schema/config.schema.json` are already a fixed layout
   point from the inherited design spec §2f — not open for re-derivation.

## Recommendation

Adopt `check-jsonschema` (via `uv run`/`uvx`) as the sole schema-validation tool, pin
`$schema` to draft 2020-12 explicitly in both schema files, and layer a small custom
`scripts/validate_entries.py` for the checks JSON Schema structurally cannot express
(G-02/G-03/G-15) — this is the two-layer pattern BCR already proved out. Keep
`render-deploy.yml` scoped to the wire contract (`p/` → `public/p/` + `config.json`)
and explicitly defer the human-readable catalog page — every comparable ecosystem
treats that as a separate system, and building it now would be scope creep against the
GAP already flagged in the handover. Rely on Cloudflare Pages' default headers for the
freshness contract; do not add a `_headers` file for `*.json` unless a concrete need
appears (it would only add a rule to maintain, not change behavior). Treat rendered
`public/` output as a CI build artifact rather than something to hand-maintain — the
render step should be the only thing that writes it.

## Sources

| Source | Type | Date | Relevance |
|---|---|---|---|
| [json-schema.org/specification-links](https://json-schema.org/specification-links) | Spec | 2026 | Draft 2020-12 current, successor status |
| [json-schema.org blog: Stable Spec](https://json-schema.org/blog/posts/stable-json-schema) | Blog | 2026 | Next-draft IETF status |
| [check-jsonschema GitHub](https://github.com/python-jsonschema/check-jsonschema) | Repo | 2026 | Tool selection |
| [check-jsonschema usage docs](https://check-jsonschema.readthedocs.io/en/latest/usage.html) | Docs | current | CLI usage |
| [check-jsonschema PyPI](https://pypi.org/project/check-jsonschema/) | Registry | 2026-06-29 | Release currency, Python req |
| [python-jsonschema validators API](https://python-jsonschema.readthedocs.io/en/stable/api/jsonschema/validators/) | Docs | current | `$schema`-based validator selection |
| [ajv-cli issue #241](https://github.com/ajv-validator/ajv-cli/issues/241) | Repo | 2026 | Maintenance status |
| [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema) | Repo | 2026 | Emerging alternative |
| [BCR docs/README.md](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md) | Repo docs | current | Custom-validator prior art |
| [bcr_presubmit.py](https://github.com/bazelbuild/continuous-integration/blob/master/buildkite/bazel-central-registry/bcr_presubmit.py) | Repo | current | Cross-file validation pattern |
| [opentofu/registry](https://github.com/opentofu/registry) | Repo | 2026 | Data-repo/site split prior art |
| [OpenTofu provider mirror protocol](https://opentofu.org/docs/internals/provider-network-mirror-protocol/) | Docs | 2026 | Static-JSON-hosting pattern |
| [winget-pkgs schema docs](https://github.com/microsoft/winget-pkgs/blob/master/doc/manifest/schema/1.9.0/README.md) | Repo docs | current | Manifest schema/CI prior art |
| [Cloudflare Pages: Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) | Docs | current | ETag, Cache-Control defaults |
| [Cloudflare Pages: Limits](https://developers.cloudflare.com/pages/platform/limits/) | Docs | current | File count/size limits |
| [Cloudflare Pages: Headers](https://developers.cloudflare.com/pages/configuration/headers/) | Docs | current | `_headers` syntax/limits |
| [Cloudflare Pages: Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/) | Docs | current | Production deploy-swap language |
| [Cloudflare Pages: Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) | Docs | current | Explicit "atomic" language |
| [Cloudflare: ETag reference](https://developers.cloudflare.com/cache/reference/etag-headers/) | Docs | current | Strong vs weak ETag behavior |
| [syrupy](https://syrupy-project.github.io/syrupy/) | Repo/Docs | 2026 | Snapshot testing option (deferred) |
