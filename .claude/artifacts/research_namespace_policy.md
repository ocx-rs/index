# Research: Namespace Governance & Naming Rules for the OCX Public Index

## Metadata

**Date:** 2026-07-16
**Domain:** packaging
**Triggered by:** entry schema v1 design — owner direction that logical names are always two-level `<namespace>/<package>`, namespace = GitHub org/user ownership (D6)
**Expires:** 2027-01 (re-verify if GitHub username policy, OCI distribution-spec naming rules, or BCR/npm dispute policy pages change)

## Direct Answer

Every surveyed registry (BCR, OpenTofu, npm, Go vanity, Homebrew) gates the *first claim*
of a namespace with human review, not automation — OCX's existing G-04 (new-namespace
PR = mandatory human review) already matches this norm, so no new CI machinery is needed
for claim-time verification. The one fully-automatable ownership check across all systems
studied is OCX's own already-designed D6/G-15 (physical registry manifest embeds the
logical `name`, checked in CI) — it proves *physical registry control*, not *real-world
org identity*, which matters directly for Q5 below. Naming charset: fold to the
intersection of GitHub-login rules and the OCI distribution-spec repository-name regex
(both ASCII-lowercase, hyphen/dot/underscore separated) — see §2. Squatting/dispute
policy: reuse npm/crates.io's minimal first-come-first-served + reviewer-discretion model
verbatim; no new workflow. The one genuine owner decision this research surfaces is §5:
whether the 42 seeds' logical namespace should be the upstream org or the OCX publisher.

## 1. Ownership Verification Prior Art

| System | Namespace bound to | Verification mechanism | CI-automatable? |
|---|---|---|---|
| [BCR](https://github.com/bazelbuild/bazel-central-registry/blob/main/metadata.schema.json) | Module is flat (no namespace); `maintainers[].github` + immutable `github_user_id` | Human PR review; `github_user_id` survives username churn ([bcr-policies.md](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/bcr-policies.md)) | No — review only |
| [OpenTofu registry](https://opentofu.org/docs/internals/module-registry-protocol/) | Namespace = GitHub org/user owning the source repo (repo-bound, `github.com/NAMESPACE/terraform-*`) | Submitter sets org membership **public** + files a GitHub issue; registry team verifies manually | Partially — public-membership flag is checkable via API but the review step isn't automated |
| [npm scopes](https://docs.npmjs.com/about-scopes/) | Scope = npm account/org name (npm's own identity, not GitHub) | Identity == account creation; no external verification needed | N/A — self-contained |
| [Go vanity imports](https://sagikazarmark.hu/blog/vanity-import-paths-in-go/) | Domain/HTTP control of the vanity host | `go` tool itself fetches `go-import` meta tag at resolve time, checks parent-path consistency | Yes, but decentralized — no registry, verified per-resolve not per-claim |
| [Homebrew taps](https://docs.brew.sh/Taps) | GitHub username/org that owns the `homebrew-*` repo | Ownership == GitHub repo ownership, enforced by GitHub itself | N/A — no separate registry |
| **OCX (designed)** | GH org/user (D6) | Physical manifest's embedded canonical identifier == entry `name` (G-15) | **Yes — already speced**, but proves registry control, not real-world identity |

GitHub's own automatable primitives — `GET /orgs/{org}/public_members/{username}`
([REST docs](https://docs.github.com/en/rest/orgs/members)) and OIDC `repository_owner`
claims ([OIDC reference](https://docs.github.com/en/actions/concepts/security/openid-connect))
— are not used by any surveyed system for namespace claims; OIDC-bound namespace claims
are a plausible v2 idea but match the ADR's own OIDC-deferred posture, not a v1 gap.

## 2. Naming Charset

- GitHub login: `^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$`, 1-39 chars,
  case-insensitive ([shinnn/github-username-regex](https://github.com/shinnn/github-username-regex)).
- OCI repository name (verified against [spec.md](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)):
  `[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*(\/[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*)*`, lowercase
  ASCII only, `registry/name` ≤255 chars advisory.
- **Proposed namespace regex:** `^[a-z0-9](?:-?[a-z0-9])*$`, ≤39 chars — lowercase-folded
  GitHub login pattern; folding is lossless (GitHub logins are already case-insensitive).
- **Proposed package regex:** reuse the OCI component regex verbatim, ≤100 chars (GitHub
  repo-name ceiling) — matches typical upstream repo names (`python-build-standalone`)
  with no lossy transform.
- ASCII-only, no Unicode in v1 (both source systems are ASCII-only; no IDN identity
  provider exists here to justify the homograph-risk surface).
- Case-fold at claim time: canonical lowercase form lives in the `p/` path and `name`
  field; the real GitHub display casing goes only in `owners[].github`.

## 3. Reserved Namespaces v1

GitHub does **not** formally reserve usernames as policy ("Account names may not be
reserved or inactively held for future use") but does remove squatted/inactive-hold
accounts on complaint ([GitHub Username Policy](https://docs.github.com/en/site-policy/other-site-policies/github-username-policy)).
That argues for a small, collision-driven list, not exhaustive trademark pre-blocking:

- **Control-path collisions:** `p`, `schema`, `state`, `config`, `api`, `docs`, `static`, `assets`
- **Own-brand protection:** `ocx`, `ocx-sh`, `ocx-contrib`, `ocx-rs`
- **Generic/ambiguous:** `admin`, `root`, `system`, `std`, `core`, `official`, `public`, `test`, `example`, `internal`

Checked as a denylist in `validate.yml` at first-claim time — small enough that no
external list (npm's informal reserved-words tooling, e.g.
[github-reserved-names](https://www.npmjs.com/package/github-reserved-names), isn't
canonical enough to import wholesale) needs importing.

## 4. Squatting, Dispute, Transfer, Rename

- **BCR lesson:** immutable `github_user_id` alongside the mutable `github` login exists
  specifically so a maintainer surviving a username change/takeover isn't orphaned
  ([metadata.schema.json](https://github.com/bazelbuild/bazel-central-registry/blob/main/metadata.schema.json)).
  OCX's schema already has `owners[].github_id` but it's optional — make it mandatory.
- **npm dispute policy:** first-come-first-served; squatting = "no genuine function";
  no automatic transfer, support-ticket + case-by-case judgment
  ([npm disputes](https://github.com/npm/policies/blob/master/archived/disputes.md)).
- **crates.io:** identical first-come-first-served + genuine-function test + "contact the
  current owner first" as documented norm ([crates.io policies](https://crates.io/policies)).
- **v1 proposal:** adopt this model verbatim — no new workflow, no reservation system.
  First-claim PRs are already human-reviewed (G-04); reviewers apply the genuine-function
  test at claim time. Transfers reuse the existing always-human-reviewed `owners` field
  path (G-05). No dedicated rename primitive — rename = `status: deprecated` +
  `deprecated_message` on the old entry, fresh claim on the new name (matches Go vanity
  and Homebrew, neither of which has a rename operation either).

## 5. Seed Namespace: Upstream Org vs Publisher (owner decision)

The 42 seeds are physically at `ghcr.io/ocx-contrib/<pkg>` today. Two options for the
*logical* namespace:

| | **A: upstream org** (`ocx.sh/kitware/cmake`) | **B: publisher** (`ocx.sh/ocx-contrib/cmake`) |
|---|---|---|
| Precedent | [winget](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) `Publisher.Package` = real vendor | [Homebrew third-party taps](https://docs.brew.sh/Taps), Debian pools, npm [@types/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| D6 honesty | **Broken** — ownership check (manifest identifier == name) is satisfied by ocx-contrib pushing, not by Kitware; namespace visually implies Kitware control it hasn't exercised | **True** — physical repo owner and logical namespace owner are the same identity |
| Trademark/impersonation risk | Real — unconsented use of a real org's identity, no verification exists (§1 finding: none of BCR/OpenTofu/npm automate this) | None — `ocx-contrib` is OCX's own namespace |
| Discoverability | Higher — users recognize the real maker | Lower — users must trust the curator |
| Future direct-publish path | Namespace collision if Kitware later wants `kitware/` for real (already claimed by the mirror) | Clean — Kitware claims `kitware/` fresh; old entry deprecates via existing mechanism |
| Why winget can do A safely | winget never re-hosts bytes, only points at vendor URLs | N/A |
| Why OCX re-publishes bytes | Same failure mode DefinitelyTyped's `@types` scope exists to avoid | Matches the pattern |

**Recommendation:** Option B (`ocx.sh/ocx-contrib/<pkg>`) — the only option consistent
with D6 as actually designed, zero new claim ceremony, no unconsented trademark exposure.
If the owner prefers Option A's discoverability, pair it with a Chainguard-style
disclaimer field/doc note ([Chainguard trademark policy](https://www.chainguard.dev/legal/chainguard-trademark-use-policy))
so the catalog never implies unearned upstream endorsement.

## 6. Namespace Policy v1 — Docs Skeleton

1. What a namespace is (always `<namespace>/<package>`, no bare names)
2. Charset + normalization (§2)
3. Reserved list (§3)
4. How to claim (PR, G-04 human review, genuine-function test)
5. Ownership proof (D6/G-15 — registry manifest identifier match)
6. `owners[]` + mandatory `github_id`
7. Dispute/squat policy (§4 — contact-owner-first, reviewer discretion)
8. Rename/deprecate mechanic (`status`/`deprecated_message`, no rename primitive)
9. Mirror/attribution disclosure note (only if Option A chosen — §5)

## Key Findings

See `key_findings` field — six findings, each cited inline above.

## Recommendation

Reuse existing G-04/G-05/D6/G-15 machinery for all claim/ownership/dispute concerns —
this research found no prior-art system that automates namespace-claim verification
beyond what OCX already designed. Spend new design effort only on: the charset regex
(§2), the small reserved list (§3), making `github_id` mandatory (§4), and — the one
real decision — upstream-org vs publisher namespacing for the seeds (§5), where this
research recommends Option B (publisher) but leaves the call to the owner.

## Sources

| Source | Type | Date checked | Relevance |
|---|---|---|---|
| [bazelbuild/bazel-central-registry metadata.schema.json](https://github.com/bazelbuild/bazel-central-registry/blob/main/metadata.schema.json) | Repo/schema | 2026-07-16 | BCR maintainer identity fields, github_user_id |
| [bazel-central-registry/docs/bcr-policies.md](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/bcr-policies.md) | Docs | 2026-07-16 | BCR review/governance process |
| [OpenTofu Module Registry Protocol](https://opentofu.org/docs/internals/module-registry-protocol/) | Docs | 2026-07-16 | Namespace = repo-owning GitHub org |
| [npm About scopes](https://docs.npmjs.com/about-scopes/) | Docs | 2026-07-16 | Scope-as-account-identity model |
| [npm disputes policy (archived)](https://github.com/npm/policies/blob/master/archived/disputes.md) | Docs | 2026-07-16 | Squat/dispute/transfer policy |
| [crates.io policies](https://crates.io/policies) | Docs | 2026-07-16 | First-come-first-served + squat test |
| [Go vanity import paths blog](https://sagikazarmark.hu/blog/vanity-import-paths-in-go/) | Blog | 2026-07-16 | Decentralized domain-control ownership |
| [Homebrew Taps docs](https://docs.brew.sh/Taps) | Docs | 2026-07-16 | Third-party tap namespace = GitHub owner |
| [OCI distribution-spec spec.md](https://github.com/opencontainers/distribution-spec/blob/main/spec.md) | Spec | 2026-07-16 | Repository name regex (verified verbatim) |
| [GitHub username policy](https://docs.github.com/en/site-policy/other-site-policies/github-username-policy) | Policy | 2026-07-16 | No formal reservation, squatting prohibited |
| [GitHub REST — org membership](https://docs.github.com/en/rest/orgs/members) | API docs | 2026-07-16 | Public-membership check automatability |
| [winget manifest docs](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) | Docs | 2026-07-16 | Publisher.Package identifier model |
| [Chainguard trademark use policy](https://www.chainguard.dev/legal/chainguard-trademark-use-policy) | Legal/policy | 2026-07-16 | Mirror-image disclaimer precedent |
| [DefinitelyTyped repo](https://github.com/DefinitelyTyped/DefinitelyTyped) | Repo | 2026-07-16 | @types curator-namespace precedent |
| `.claude/artifacts/adr_public_index_registry_indirection.md` (D6, D7) | Internal ADR | 2026-07-16 | Existing OCX ownership/naming decisions |
