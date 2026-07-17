# Research: Index Enumeration Surface Prior Art

## Metadata

**Date:** 2026-07-17
**Domain:** packaging
**Triggered by:** the 2026-07-17 design discussion identifying a real gap — the wire
tree (`/config.json`, `/p/**`) is deliberately sparse (RFC 2789 lineage per
[`research_sparse_index_formats.md`](./research_sparse_index_formats.md)) and
therefore **unenumerable**: a client that already knows a name can resolve it, but
nothing lets a client, mirror, or marketplace discover the full package set. The only
existing listing, `/data/catalog/packages.json`, is explicitly non-contract
([`product-context.md`](../rules/product-context.md)) and metadata-heavy — the wrong
tool for a machine consumer. This resolves the `all.json` search-snapshot item
deferred at the original design pass
([`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md),
Deferred / Out of Scope list) and `product-context.md`'s corresponding Non-Goals bullet.
**Expires:** 2027-01-17

## Direct Answer

Full-catalog enumeration is a solved problem, but the ecosystem has converged on two
very different answers depending on whether the listing carries metadata. Name-only
flat files scale to hundreds of thousands of entries with nothing more exotic than
conditional GET (PyPI's `/simple/`). The moment a listing carries per-entry metadata
instead of just names, it stops scaling an order of magnitude sooner and eventually
gets abandoned (Helm's `index.yaml`). A third, more recent pattern — a root file
carrying not names but **content digests** of sub-resources — gives the same flat
file a second property for free: one conditional GET on the root can answer "has
anything changed anywhere?" without touching any leaf resource. This is TUF's
snapshot role and RPM's `repomd.xml`, and it is the strongest available precedent for
`/c/index.json`'s chosen shape (digest map, not bare name list) — see
[`adr_enumeration_index.md`](./adr_enumeration_index.md), which this research backs.

No surveyed system switches shape conditionally on scale (inline list below a
threshold, pointer/sharded list above it) — every system studied picked one shape and
kept it forever; a conditional discriminated union has no precedent anywhere in this
survey.

## Key Findings

### 1. crates.io sparse index (RFC 2789) — enumeration deliberately never shipped

The [Cargo sparse-index RFC](https://rust-lang.github.io/rfcs/2789-sparse-index.html)
and its [reference documentation](https://doc.rust-lang.org/cargo/reference/registry-index.html)
define a per-crate, name-addressed file layout (`config.json` root; per-crate files
sharded by name length — 1/2-char names flat, 3-char names under one prefix
directory, 4+-char names under a two-level `<first-two>/<next-two>` prefix, e.g.
`cargo` → `ca/rg/cargo`) at roughly 300,000 crates today. **There is no enumeration
surface.** A names-file at the index root was floated during the RFC discussion but
never shipped; consumers that need the full crate list either clone the git-backed
index (the exact scaling failure sparse-index was designed to escape for per-crate
lookups) or pull periodic database dumps published out of band. This is a recognized,
long-standing gap in an otherwise fully-converged design — the closest thing to a
counter-example in this survey, and a caution that "sparse for lookups" does not
automatically imply "enumerable."

### 2. PyPI `/simple/` (PEP 503 / PEP 691) — flat name-only file proves the scale

PyPI's simple repository API — originally HTML
([PEP 503](https://peps.python.org/pep-0503/)), now with a JSON form
([PEP 691](https://peps.python.org/pep-0691/)) — serves a **single flat file listing
every project name** on the index, full enumeration, at roughly 800,000 projects
today. No pagination, no sharding, standard `ETag`/conditional-GET caching. This is
the single strongest scale proof in this survey for a flat, name-only enumeration
file: metadata about a project (versions, files, hashes) lives at a separate
per-project URL, exactly the pointer/payload split this repo's own `/p/**` roots
already apply one layer down. The lesson: name-only stays flat and fast far past any
scale this index plans for; it is metadata that would force a rethink.

### 3. Helm `index.yaml` — the failure mode this design must not repeat

[Helm's chart repository index](https://helm.sh/docs/topics/chart_repository/) takes
the opposite approach: one `index.yaml` file per repository, but **every** chart
version's full metadata (`Chart.yaml` fields, plus a `urls`/`created`/`digest` block)
inlined into that one file. At repository scale this becomes a single-digit-to-tens
of megabytes YAML document that every client must download and parse in full before
any operation, with client-side memory costs that scale the same way. The model did
not survive contact with real growth — large chart repositories moved off
`index.yaml`-style aggregation toward OCI-based chart storage (Helm 3.7+ supports
pushing/pulling charts as OCI artifacts directly), sidestepping the monolithic-index
problem rather than fixing it. The lesson carried into this ADR is specific and
narrow: **it is metadata inlined into a listing that kills it, not the number of
names** — the same lesson PyPI's `/simple/` demonstrates from the opposite direction.

### 4. OCI Distribution `_catalog` — paginated, and commonly disabled where it exists

The [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)
defines an optional `_catalog` endpoint for listing repositories on a registry, with
pagination (`n`/`last` query parameters). It is optional, not core to the spec, and —
as already established in this repo's own founding research
([`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md)
Context: "`_catalog` is a dead end... GHCR and Docker Hub do not implement it at all")
— routinely absent or disabled on exactly the public registries this project depends
on. It is not a usable enumeration surface for this index even in principle: it
enumerates physical repositories on one registry, not logical `<namespace>/<package>`
identities across the indirection layer this index exists to provide.

### 5. npm registry replication & the Go module index — change-feed, not a snapshot

npm's registry is itself a [CouchDB-derived database](https://github.com/npm/registry/blob/master/docs/REPLICATE.md)
and exposes a `_changes` feed: an append-only log of every package/version mutation,
consumed incrementally by mirrors and analytics tooling. The
[Go module proxy protocol](https://go.dev/ref/mod#module-proxy) similarly exposes
`index.golang.org`, a chronological feed of newly discovered module versions since a
given timestamp — not a full-catalog snapshot at all. Both are legitimate, proven
designs, but both require an always-on server maintaining feed state and offset
bookmarking on the client side — exactly the "zero production services" constraint
this project's founding ADR rejected a server-side facade over
([`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md)
D8's rejected `registry.k8s.io`-style option). A static-file-over-CDN index has no
place to run a change-feed server, and no consumer here needs incremental
change-since-timestamp semantics badly enough to justify standing one up.

### 6. TUF / PEP 458 snapshot role — the digest-manifest precedent

[The Update Framework (TUF)](https://theupdateframework.io/) defines a `snapshot`
metadata role: a signed root-level file listing every delegated `targets` metadata
file by name, version, and content hash. Consumers fetch the tiny `snapshot.json`
first; a single hash mismatch anywhere in the tree is detectable from that one file
alone, without walking every leaf. [PEP 458](https://peps.python.org/pep-0458/) adopts
this design to secure PyPI itself, delegating the ~800,000-project target set across
16,384 hash-prefix bins so no single delegated file grows unbounded. This is the
direct precedent for a **digest map** (not a bare name list) as the enumeration file's
shape: the root file's value is not just "here is the list" but "here is a fingerprint
of the list's current state, and of each entry inside it" — Merkle-style upward
propagation, one conditional GET at the root answering "has anything changed
anywhere?" A future hash-bin-style delegation (splitting `/c/index.json` into sharded
sibling files) is the same mechanism PEP 458 already proves at PyPI's own scale, should
this index ever need it.

### 7. RPM `repomd.xml` — pointer + checksum root file, same pattern in a different ecosystem

Yum/DNF repositories (generated by tools such as
[`createrepo_c`](https://github.com/rpm-software-management/createrepo_c)) publish a
tiny `repomd.xml` root listing each of the repository's real metadata files
(`primary.xml.gz`, `filelists.xml.gz`, …) alongside a checksum and revision timestamp
for each. A client polls only `repomd.xml`; a checksum mismatch on any listed entry is
the client's signal to re-fetch that one file. This is architecturally the same
pattern as TUF's snapshot role — a small pointer-and-checksum root over a set of
larger sub-resources — arrived at independently in a completely different packaging
ecosystem, reinforcing that "digest-manifest root over content-addressed leaves" is a
convergent design, not a TUF-specific one.

## Design Patterns Worth Considering

- **Name-only enumeration, metadata elsewhere** (PyPI `/simple/`) — proven to
  ~800,000 entries; the pattern this index's `/c/index.json` follows for its
  `packages` map, keeping `/p/**` roots and `/data/catalog/**` as the only places
  metadata lives.
- **Digest-manifest root over content-addressed leaves** (TUF snapshot role, RPM
  `repomd.xml`) — a root file's entries are content digests of sub-resources, not
  just names or raw pointers; gives a single conditional GET Merkle-style
  "did-anything-change" power over an entire tree. Directly applicable one layer up
  from this index's existing root+CAS split
  ([`adr_locked_observation_index_format.md`](./adr_locked_observation_index_format.md)
  D2).
- **Hash-bin / prefix-shard delegation** (PEP 458, crates.io's own per-crate path
  sharding) — the documented, precedented upgrade path if a flat enumeration file
  ever needs splitting; not needed at any package count this project currently plans
  for.
- **What NOT to do**: inline per-entry metadata into an enumeration listing (Helm
  `index.yaml`'s abandoned model); build a change-feed server for a static,
  CDN-hosted index (npm/Go proxy's server-dependent model); switch enumeration shape
  conditionally on scale (no precedent found anywhere in this survey for such a
  discriminated union — every system studied commits to one shape permanently).

## Recommendation

Ship a flat, name-only-to-digest **map**, not a bare name array, from day one:
`{"format_version": 1, "packages": {"<namespace>/<package>": "sha256:<hex>", ...}}`.
The name-only-vs-metadata line (Finding 2 vs Finding 3) is the one lesson to treat as
non-negotiable — never let per-package title/description/keywords/CAS-URL data leak
into this file; that data already has a home in `/p/**` roots and, for the site's own
non-contract view, `/data/catalog/packages.json`. The digest-map upgrade over a bare
name array is cheap (near-zero render cost, since the render pipeline already
produces every root's exact bytes) and buys real properties a bare list cannot: an
ETag-plus-digest-diff sync protocol, byte-verifiable snapshots, and a ready-made
foundation for this project's own deferred signing ADR (sign one root file, the whole
tree becomes tamper-evident via the digest chain — the same shape PEP 458 gives
PyPI). Do not build sharding now; reserve it as a documented, precedented future
evolution (hash-bin delegation or crates.io-style prefix shards), gated by
`format_version` or additive sibling paths, triggered only if this file's own size
ever approaches the scale where PyPI needed 16,384 bins — several orders of magnitude
past this project's current package count. Full decision record:
[`adr_enumeration_index.md`](./adr_enumeration_index.md).

## Sources

| Source | Type | Date | Relevance |
|--------|------|------|-----------|
| [RFC 2789: Sparse registry index](https://rust-lang.github.io/rfcs/2789-sparse-index.html) | RFC | — | crates.io sparse-index design; enumeration gap acknowledged in discussion, never shipped |
| [Cargo Registry Index reference](https://doc.rust-lang.org/cargo/reference/registry-index.html) | Docs | — | Path-sharding scheme by name length |
| [PEP 503 — Simple Repository API](https://peps.python.org/pep-0503/) | PEP | 2015 | Original HTML `/simple/` enumeration format |
| [PEP 691 — JSON-based Simple API for Python Package Indexes](https://peps.python.org/pep-0691/) | PEP | 2022 | JSON form of the flat, name-only enumeration file |
| [Helm chart repository guide](https://helm.sh/docs/topics/chart_repository/) | Docs | — | `index.yaml` monolithic-metadata shape and its scaling ceiling |
| [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md) | Spec | — | `_catalog` endpoint definition, pagination, optional status |
| [npm registry replication docs](https://github.com/npm/registry/blob/master/docs/REPLICATE.md) | Docs | — | CouchDB `_changes` feed, change-feed enumeration model |
| [Go modules reference — module proxy protocol](https://go.dev/ref/mod#module-proxy) | Docs | — | `index.golang.org` incremental discovery feed |
| [The Update Framework (TUF)](https://theupdateframework.io/) | Spec | — | `snapshot` role — digest manifest of every delegated metadata file |
| [PEP 458 — Secure PyPI downloads with signed repository metadata](https://peps.python.org/pep-0458/) | PEP | 2019 | TUF applied to PyPI at ~800k-project / 16,384-bin scale |
| [createrepo_c](https://github.com/rpm-software-management/createrepo_c) | Tool/Docs | — | Generates `repomd.xml`, the RPM pointer+checksum root pattern |
| [`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md) | Internal ADR | 2026-07-11 | Original `all.json` deferral; `_catalog` rejection precedent |
| [`research_sparse_index_formats.md`](./research_sparse_index_formats.md) | Internal research | 2026-07-12 | This index's own sparse-lookup design precedent (crates.io, BCR, Homebrew, winget) |
