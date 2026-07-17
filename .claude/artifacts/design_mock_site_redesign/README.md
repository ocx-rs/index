# Design Mock — Site Redesign

**Provenance:** returned by a Claude Designer-instance handover, 2026-07-17.
Brief sent as [`../handover_site_redesign.md`](../handover_site_redesign.md)
(PR #18); this directory is the Designer's response, committed here as the
design authority for `site/`'s visual/UX re-implementation
(`plan_site_redesign`).

## Contents

- `OCX Index Redesign.dc.html` — the design mock itself: a single static
  HTML file, nine labeled sections (`id="1a"`–`id="1i"`):
  - `1a`/`1b` — catalog root (`/`), light + dark, populated / filters active
  - `1c`/`1d` — package detail page, light + dark (deprecated package, tag
    context menu)
  - `1e` — states: loading, empty catalog, no search match
  - `1f` — docs skin (`/docs/reference/wire-format`), VitePress-compatible
  - `1g` — mobile (≤640px): catalog + detail
  - `1h` — foundations (color tokens, type scale, spacing)
  - `1i` — component inventory
- `ocx-logo.svg` — wordmark/logo asset referenced by the mock.

## Design direction (summary — the mock itself is authoritative)

Cool slate neutrals, coral `#ff6047` as the only interactive color, IBM Plex
Sans + IBM Plex Mono (self-hosted), light + dark palettes. The catalog root
(`/`) is the primary surface — no hero, no marketing chrome. Mono type is
the voice of the product: identifiers, versions, commands, labels.

## Status

The re-implementation against this mock landed as `plan_site_redesign`
Waves 1–2 (PRs #21–#26): blank custom VitePress theme, catalog UI, detail
UI, docs skin, local `site:serve`/`demo:seed` review tooling. See
[`../adr_catalog_docs_colocation.md`](../adr_catalog_docs_colocation.md)
Amendment A1 for the data-layer consequence (dynamic routes replacing
bot-generated wrapper pages) this redesign exposed, and
[`site/README.md`](../../../site/README.md) for the landed theme structure.
