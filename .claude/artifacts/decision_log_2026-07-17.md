# Decision Log — 2026-07-17 Design Discussion

<!--
Narrative record, not an ADR: chronological question → alternatives → conclusion
for the design discussion that produced ADR-5. Each thread below closes into
exactly one owning ADR; the ADR carries the normative schema/contract text, this
log carries the "why we ended up there" reasoning and the path not taken. Never
append to decision_log_2026-07-16.md — that log is frozen; this is a new, dated
record for a later discussion.
-->

## Metadata

**Date:** 2026-07-17
**Participants:** Michael Herwig (owner) + Claude design swarm
**Scope:** Enumeration surface for the wire tree, `superseded_by` root field,
surface-role consistency across the index's growing set of top-level paths, site
framework reaffirmation, and the desc-in-artifact-vs-in-index question.

## Context

This session picked up after the site-redesign handover
([`handover_site_redesign.md`](./handover_site_redesign.md), delivered to a Designer
instance) and Phases 0–3 of `plan_index_v1` landing live on `index.ocx.sh`. While
reviewing what the redesigned site would actually need to render, the owner asked a
question that turned out to expose a real gap in the wire contract itself, not just a
site-layer concern: could a client, a future corporate index, or a marketplace
enumerate the full package set at all, given `/p/**` is sparse by design and requires
already knowing a name to resolve anything? Everything else in this log follows from,
or was resolved alongside, that question — plus two smaller threads it surfaced along
the way (a structured "superseded by" pointer, and where package description content
should live). The branch for this work is `feat/enumeration-index`.

## 1. The wire tree is unenumerable — `/data/catalog/packages.json` is the wrong tool

**Question raised.** Reviewing the site's data needs surfaced three candidate gaps at
once: a disclaimer banner, a "use X instead" link on deprecated packages, and
keywords. Underneath all three sat the same harder question: today, nothing in the
wire contract lets any consumer discover the full package set — a client must already
know a name to resolve it. The existing full listing,
`/data/catalog/packages.json`, was floated as a possible answer.

**Alternatives weighed.** Reuse `/data/catalog/packages.json` (already exists,
already lists every package, no new surface needed) versus building a dedicated wire
surface for enumeration.

**Conclusion.** `/data/catalog/packages.json` is explicitly non-contract and
metadata-heavy — title, description, keywords, tag count, CAS URLs, one row per
package — the wrong tool for a machine consumer that only wants "does this exist, has
it changed." The gap is real, and it resolves the deferred `all.json` item named in
`adr_public_index_registry_indirection.md`'s Deferred list and `product-context.md`'s
Non-Goals. Of the three candidate gaps raised, two turned out to need zero new wire
work: `upstream.disclaimer` already exists and already renders the amber banner
as-is, and `status: deprecated` + `deprecated_message` already exist for the
deprecation reason. Keywords traced to an artifact-side gap (publisher tooling not
yet emitting `sh.ocx.keywords`), not an index-repo decision. Only "link to a
structured successor" was a genuine gap — carried forward to thread 5.

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).

## 2. Prior-art research: enumeration is solved, in two very different ways

**Question raised.** Given the gap was real, what does the wider packaging ecosystem
do for full-catalog listing?

**Alternatives weighed.** The research surveyed crates.io (no enumeration surface at
all — a names-file was floated during the RFC 2789 discussion, never shipped),
PyPI's `/simple/` (a single flat, name-only file, proven at ~800,000 projects), Helm's
`index.yaml` (metadata inlined per entry, grew unbounded, model abandoned), OCI's
`_catalog` endpoint (paginated, and already established in this repo's own founding
research as commonly disabled on the registries this project depends on), and
npm/Go's change-feed models (incremental, server-dependent, not a snapshot).

**Conclusion.** A name-only flat file is proven at ecosystem scale; the one hard
lesson is Helm's — metadata inlined into a listing is what kills it, not the number
of names. This settled the shape's floor: never put per-package metadata into the
new surface. It did not yet settle whether the surface should carry anything beyond
bare names — that question opened immediately after (thread 3).

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).
**Research:** [`research_index_enumeration_prior_art.md`](./research_index_enumeration_prior_art.md).

## 3. From name array to digest map: enumeration becomes a snapshot manifest

**Question raised.** A bare name list only answers "what packages exist," not "did
anything change" — a consumer would still have to poll every root individually to
detect drift. Could the enumeration surface answer both questions from one
conditional GET?

**Alternatives weighed.** A flat name array (the shape thread 2 first landed on)
versus a map from each package's bare id to the current content digest of its root.

**Conclusion.** Digest map chosen, citing two independently convergent precedents:
TUF's snapshot role — a root metadata file listing every delegated targets file by
version and content hash, the exact mechanism PEP 458 runs at PyPI's ~800,000-project
scale across 16,384 hash bins — and RPM's `repomd.xml`, a tiny root file carrying
checksums of every sub-index. Both give the same Merkle-style upward propagation: one
conditional GET at the root answers "has anything changed anywhere," and a `200`
response's digest diff gives the exact set of added, updated, and deleted packages
without a separate change-feed mechanism. This was decided immediately rather than
deferred, because array-to-map is itself a breaking shape change and `/c/index.json`
is a brand-new surface — the one-way door is at the door on day one, with no "ship
the simple version, upgrade for free later" option available the way it would be for
an already-shipped field.

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).

## 4. Discriminated union (inline list vs. sharded pointer list) proposed, rejected

**Question raised.** Should the enumeration file's shape itself switch — serialized
inline while the catalog is small, behind a sharded pointer map once it grows —
conditioned on package count, deferring the sharding decision to whichever shape
scale eventually demands?

**Alternatives weighed.** A size-conditional discriminated union versus a single
fixed shape (the digest map from thread 3, always) with sharding reserved as an
explicitly-not-built future evolution.

**Conclusion.** Rejected. No precedent exists anywhere in the research for a listing
that switches shape conditionally on scale: TUF and `repomd.xml` are always-pointer;
PyPI and Homebrew are always-inline; no surveyed system straddles both. A conditional
shape would commit every future client to carrying two parsing code paths for one
wire surface, each exercised only some of the time — the same dual-mechanism risk
class flagged during the discussion by analogy to OCI's own Referrers API
tag-fallback mechanism, a real precedent for the general failure class rather than a
literal match. Sharding stays reserved: a recursive `indices` pointer map (the same
digest principle one level deeper, precedented by PEP 458's hash-bin delegation) or
crates.io-style prefix shards under `/c/`, gated by `format_version` or additive
sibling paths — not a second mechanism built in from day one.

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).

## 5. `superseded_by`: from a free-text convention to a structured field

**Question raised.** Thread 1 established that `status: deprecated` +
`deprecated_message` already give a human-readable deprecation reason — but a package
naming its actual replacement (e.g., "use `mozilla/sccache` instead") had no
machine-readable form an `ocx` client could act on at install time. Should that stay
a documented convention of writing the successor's name inside `deprecated_message`,
or become its own field?

**Alternatives weighed.** Leave it as free text inside `deprecated_message` (no wire
change at all) versus a new, dedicated root field.

**Conclusion.** New field, `superseded_by` — optional, omitted when unset (mirroring
`upstream`'s existing precedent for a non-universal additive field, deliberately not
required-nullable like the original field cohort), whose value is the bare
`<namespace>/<package>` id, reusing the same package-id shape and parser
`adr_namespace_policy.md` already defines rather than a second hand-rolled regex.
Deliberately independent of `status` — a package may name a successor while still
`active`, or be `deprecated`/`yanked` with none at all — and deliberately unchecked
for existence, since a dangling or not-yet-claimed successor gets exactly the same
free-text-pointer treatment `deprecated_message` already receives. Self-reference (a
package naming itself) is a hard validation error.

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).

## 6. Surface-role consistency: naming what each top-level path is for

**Question raised.** With a fourth wire shape landing alongside an already-existing
non-contract catalog view-model and a set of human-facing site pages, does the
index's growing collection of top-level paths still read as one coherent contract, or
has the boundary between wire contract and site-only data drifted into something
implicit and easy to blur by accident in a future PR?

**Alternatives weighed.** Leave the boundary implicit — as it already mostly was,
scattered across `product-context.md` and `adr_catalog_docs_colocation.md` — versus
writing an explicit role for every top-level surface into the ADR introducing the
newest one.

**Conclusion.** An explicit table: `/config.json` and `/p/**` resolve; `/c/**`
enumerates; `/data/catalog/**` is the site's own non-contract view-model; site pages
are the UI consuming all three. The one principle worth enforcing going forward: site
detail pages must render from wire shapes only, never a site-private per-package
shape — recorded as non-normative guidance pointing at the separate site-redesign
effort (`handover_site_redesign.md`), not something this discussion's ADR itself
implements.

**Owning ADR:** ADR-5, [`adr_enumeration_index.md`](./adr_enumeration_index.md).

## 7. Site framework: VitePress reaffirmed, redesign stays a separate track

**Question raised.** Does landing new wire surfaces and a new governance field change
anything about the already-decided site stack?

**Alternatives weighed.** None were seriously reopened — the question was whether the
accumulating discussion (desc/index split, enumeration, surface roles) implied
revisiting `adr_catalog_docs_colocation.md`'s VitePress choice.

**Conclusion.** No. VitePress stands unchanged; the render pipeline's wrapper-page
contract (`render-deploy.yml` + `taskfile.yml`) is untouched by anything decided in
this session. The site's actual visual and UX redesign remains entirely out of scope
here — it is the separate handover already delivered to a Designer instance
(`handover_site_redesign.md`), tracked under `plan_index_v1`'s own status, not
reopened by this discussion.

**Owning ADR:** [`adr_catalog_docs_colocation.md`](./adr_catalog_docs_colocation.md) (reaffirmed, unchanged).

## 8. `desc` in the artifact vs. `desc` in the index: which owns what

**Question raised.** With the index about to own more lifecycle data
(`superseded_by`, joining `status`/`deprecated_message`/`upstream`), should package
description content (title, description, keywords, readme, logo) move into the index
too, for consistency, instead of staying split across the `__ocx.desc` artifact on
the physical registry?

**Alternatives weighed.** Consolidate everything into the index (one place to look
for all package data) versus keep the existing split between artifact-owned
description and index-owned governance.

**Conclusion.** Keep the split, and name the rule that decides every future field
going forward: the **artifact self-describes WHAT it is** — title, description,
keywords, readme, logo — publisher-owned, identical truth for any index that observes
the same repository, including a future corporate index (no collection problem,
since bot observation *is* the collection). The **index owns TRUST and LIFECYCLE** —
owners, status, deprecation, `superseded_by`, disclaimer, yanks — necessarily
per-index, since a corporate index may deprecate a package the public one keeps, and
an abandoned upstream project cannot republish its own description to mark itself
deprecated; the index must be able to say that unilaterally. Precedent cited: OCI's
own `org.opencontainers.image.*` annotations are artifact self-description read
directly by registries like GHCR and Docker Hub; crates.io's manifest metadata
travels with the package while the registry itself separately owns ownership and
yank.

**Owning ADR:** [`adr_locked_observation_index_format.md`](./adr_locked_observation_index_format.md)
D6 (reaffirmed, unchanged) — recorded here as the clarifying rule behind ADR-5's D7
(`superseded_by`) and D8 (surface-role table), not a revision to ADR-1.

## Resulting artifacts

- ADR-5 — [`adr_enumeration_index.md`](./adr_enumeration_index.md) (fourth frozen
  wire shape `/c/index.json`, digest-map shape, reserved sharding, `superseded_by`
  root field, surface-role table)
- Research — [`research_index_enumeration_prior_art.md`](./research_index_enumeration_prior_art.md)
  (crates.io, PyPI, Helm, OCI `_catalog`, npm/Go change-feeds, TUF/PEP 458, RPM
  `repomd.xml`)
- `adr_catalog_docs_colocation.md` — reaffirmed unchanged (thread 7)
- `adr_locked_observation_index_format.md` — reaffirmed unchanged, D6 clarified in
  narrative only (thread 8)

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-07-17 | Michael + Claude | Initial record from design discussion (2026-07-17) |
