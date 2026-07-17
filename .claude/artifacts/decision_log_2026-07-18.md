# Decision Log — 2026-07-17/18 Announce-Revamp Discussion

<!--
Narrative record, not an ADR: chronological question → alternatives → conclusion
for the design discussion that produced ADR-6. Each thread below closes into
ADR-6 (adr_fork_pr_announce.md), which carries the normative contract text; this
log carries the "why we ended up there" reasoning and the path not taken. Never
append to decision_log_2026-07-16.md or decision_log_2026-07-17.md — those logs are
frozen; this is a new, dated record for a later discussion.
-->

## Metadata

**Date:** 2026-07-17/18
**Participants:** Michael Herwig (owner) + Claude design swarm
**Scope:** Announce transport (the `repository_dispatch` PAT dead end), owner-curated
tag sets, verify-only reconcile, byte-exact wire discipline, two-lane governance with a
maintainers YAML, the threat-model reframe, spam posture, and the reference-tool /
ocx#216 relationship.
**Plan:** `plan_announce_revamp` (`.claude/state/plans/plan_announce_revamp.md`,
gitignored — named here, not linked); subplan of `plan_index_v1`.

## Context

Phases 0–3 of `plan_index_v1` are live on `index.ocx.sh`, and the announce lane —
designed as a `repository_dispatch` doorbell fired from publisher CI (D4 of
[`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md),
given CI mechanics by BD-4/BD-6 of
[`adr_index_bot_and_workflow_security.md`](./adr_index_bot_and_workflow_security.md))
— was the next thing to build. Reviewing the credential it needs surfaced the question
that reframed the whole lane: who can actually fire that doorbell? Everything below
follows from the answer. The branch for this work is `docs/adr-fork-pr-announce` (Phase
1); implementation rides `plan_announce_revamp` Phases 2–7.

## 1. The `repository_dispatch` doorbell needs a credential no third party can mint

**Question raised.** The doorbell fires `repository_dispatch` against `ocx-sh/index`.
GitHub requires a token scoped to the target repo for that call — it is never anonymous
([research §6](./research_index_announce_bots.md)). BD-6 resolved that token as a
per-publisher fine-grained PAT (G-17). But a fine-grained PAT scoped to `ocx-sh/index`
can only be minted by an account with collaborator access to `ocx-sh/index`. So how does
a third party — one of the intended "thousands of contributors" — mint one at all?

**Alternatives weighed.** Keep the PAT doorbell; move to a GitHub App issuing
short-lived installation tokens; an issue-ops / `repository_dispatch` relay where a
privileged workflow parses a structured issue and dispatches internally; or move
announce onto an ordinary **fork pull request** under the contributor's own identity.

**Conclusion.** The credential requirement is a structural ceiling, not a hardening
detail — the PAT and the GitHub App both keep an index-side credential the index must
provision per publisher; the relay removes the credential but replaces it with a
privileged workflow parsing attacker-controlled issue bodies (a worse injection surface)
and a bespoke issue state machine. The fork PR removes the credential *and* stays on
GitHub-native primitives every publisher already understands — the ordinary open-source
contribution flow. This is exactly the BCR / OpenTofu / winget model the announce-bots
research already documented and recommended not redesigning; only the *transport* was
pointed at the wrong GitHub primitive.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-1).

## 2. Owner-curated tag sets: `tags` becomes "every announced tag"

**Question raised.** Once the publisher opens the PR carrying the claimed data, who
decides which tags a package advertises? The prior model had the bot regenerate `tags`
as *every* tag observed on the physical registry. Does the fork-PR publisher still get
the whole observed set, or do they choose?

**Alternatives weighed.** Keep observe-everything (the bot enumerates the registry and
writes all tags) versus owner curation (the owner announces the tags they choose; the
announce PR is the sole authority that adds or removes a tag).

**Conclusion.** Owner curation. The owner announces a curated set; the bot verifies that
set against registry truth rather than enumerating to populate it. This is a provenance
change only — the `tags` map shape, the observation-object layout, and the D5
verifiability chain are byte-identical, and a resolving client (which asks "does tag *X*
resolve, and to what") never depended on the set being *complete*. Completeness was an
internal reconcile property, never a client guarantee. Curation also finally separates
two operations the observe-everything model conflated: **delete** (owner drops a tag; the
row disappears) versus **yank** (owner marks a still-present row `yanked` — a
migration-grace marker that survives, keeps resolving for pinned consumers, and is exempt
from reconcile's registry-existence check).

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-2);
amends [`adr_locked_observation_index_format.md`](./adr_locked_observation_index_format.md)
D2's `tags` provenance rows.

## 3. Verify-only reconcile: the write path is removed

**Question raised.** If the owner curates the tag set, what may the nightly reconcile
cron do? It previously regenerated every entry from registry truth and opened a drift PR.

**Alternatives weighed.** Keep regenerate-and-write reconcile versus a verify-only
reconcile that checks committed claims and flags inconsistencies without writing.

**Conclusion.** Verify-only. Once the owner curates, reconcile *cannot* be the authority
that regenerates the set — regenerating from observation would silently overwrite the
owner's curation with "whatever the registry currently has," re-conflating the two
authorities curation just separated. Reconcile narrows to: for every committed claim,
does the tag still resolve and does the digest still match? Inconsistencies (vanished
non-yanked tag, moved digest under a pinned tag, dangling CAS reference) go to an anomaly
issue (exit `65`, reusing existing machinery), never auto-healed. Its integrity value is
fully retained; only the write leg is removed. G-18's `RECONCILE_DRY_RUN` gate collapses
into "always dry" and is retired.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-3).

## 4. Byte-exact wire discipline: the root serializer becomes a published spec

**Question raised.** A fork PR claims file bytes the index will serve verbatim. CAS
objects are already content-addressed (self-certifying by path). But the package root has
no digest in its own path — how does CI make "what the publisher claimed" and "what the
index serves" the same bytes, without trusting the claim?

**Alternatives weighed.** Trust the claimed root bytes as-is (rejected — untrusted
input); re-render the root bot-side and ignore the claim (rejected — then the PR is not
really the payload, and the publisher can't reproduce what will be served); or make the
canonical serializer a published spec and enforce it by parse-then-re-serialize
byte-comparison.

**Conclusion.** The canonical root serializer becomes a **client-facing spec** (the same
status `bot/CONTRACTS.md` §1's canonical JSON already has for CAS digest inputs). CI
parses the claimed root, re-serializes canonically, and byte-compares; a non-canonical
root fails. CAS objects keep their existing hash-to-path self-check, now load-bearing for
untrusted input. One serializer, one code path, exercised by both the reference publisher
tool (producer) and the CI check (verifier).

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-4).

## 5. Two governance lanes; owners-membership and a maintainers YAML

**Question raised.** With anyone able to open a PR, what distinguishes a PR that may
auto-merge from one that needs a human — and who reviews the ones that do?

**Alternatives weighed.** Keep D5's "green refresh auto-merges" as-is (rejected — under
an open fork lane, "green refresh" alone would let a non-owner auto-merge a change to a
package they don't own) versus gating auto-merge on an authorization signal already in
the root.

**Conclusion.** Two lanes decided by the privileged governance job (GitHub API only,
never PR-head content). **Machine lane** (auto-merge eligible): a tag content refresh
and/or owner-authored tag add/remove, authored by an owner (`github_id` ∈ committed
`owners[]`), touching no G-05 key, not a new package — **G-19**. Owner-authored
add/remove is machine lane because, under curation, it *is* the owner exercising their
authority. **Human lane**: new packages (G-04, unchanged), G-05 key changes, or
non-owner authors. Human-lane PRs get reviewers assigned from a committed `maintainers.yml`
(list of `{github, github_id}`) plus an idempotent review-request comment — **G-20**.
`owners[]` and `maintainers.yml` are the same "trust cached as in-repo data" pattern at
two levels (package owners, index maintainers), the BCR/winget label-as-trust-cache
precedent read straight from committed data.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md)
(FP-5/FP-6, G-19/G-20); reinterprets D5 and amends ADR-4 BD-5.

## 6. Threat-model reframe: no standing index-side secret in the announce path

**Question raised.** The doorbell's threat model was "untrusted trigger input plus a
write credential in the same execution surface." What is the fork-PR lane's?

**Alternatives weighed.** None seriously reopened — the reframe fell out of thread 1's
decision. The question was whether removing the PAT introduced any *new* secret exposure.

**Conclusion.** It removes a whole credential class. There is no long-lived,
publisher-held, or namespace-scoped secret anywhere in the announce path. The publisher
holds nothing on the index. The only credential is the ambient per-run `GITHUB_TOKEN` in
the privileged governance job, which never checks out PR-head content and acts only
through the GitHub API. The load-bearing invariants are BD-5's, restated: untrusted
PR-head content runs only in the zero-secret verification job; the credentialed job never
touches PR head; auto-merge is armed only after the unprivileged verification is green.
The split is not new — the fork-PR lane is precisely the scenario BD-5 was written to
defend; its importance is what changed.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-7);
reaffirms ADR-4 BD-5.

## 7. Spam posture: label and stale-close, nothing heavier in v1

**Question raised.** An open PR lane means anyone can open a PR. What stops spam?

**Alternatives weighed.** A CAPTCHA / allowlist / first-contributor approval wall now,
versus minimal triage now with heavier controls held in reserve.

**Conclusion.** v1 posture is minimal: failed-check fork PRs are labeled and stale-closed
on the ordinary schedule — standard open-source triage, no bespoke machinery. GitHub's
secondary rate limits already throttle PR storms, and the verification gate means a spam
PR can never merge anything; the worst case is triage noise, not a bad publish. Heavier
controls (fork-run approval gating, allowlist) are additive if real abuse appears — not
built ahead of evidence.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-8).

## 8. `indexbot announce` repurposed as reference tool; Rust client is ocx#216

**Question raised.** The old `indexbot announce` was a dispatch target. With the doorbell
gone, is it deleted?

**Alternatives weighed.** Delete it versus repurpose it as the Python reference publisher
tool that drives the E2E and defines the contract the Rust client ports.

**Conclusion.** Repurpose. `indexbot announce` becomes the reference publisher: curate a
tag set (`--tags`/`--tags-file`), observe only the curated tags, build the canonical root
+ CAS bytes, write locally (`--out`) or as a fork PR (`--fork <owner/repo>`). Only the
doorbell-specific pieces are retired (the `PACKAGE_ID` trigger path, the `client_payload`
validator, the dispatch caller). Being the *reference* is load-bearing: it is the
executable definition of the canonical serializer (thread 4) and the fork-PR flow. The
Rust `ocx package announce` command is tracked cross-repo as
[ocx#216](https://github.com/ocx-sh/ocx/issues/216) — it ports this contract, it does not
define it, and it is verified against `indexbot announce` + the E2E harness.

**Owning ADR:** ADR-6, [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (FP-9).

## Resulting artifacts

- ADR-6 — [`adr_fork_pr_announce.md`](./adr_fork_pr_announce.md) (fork-PR announce
  transport, owner-curated tags, verify-only reconcile, byte-exact root discipline,
  two-lane governance + G-19/G-20, threat-model reframe, spam posture, reference tool +
  ocx#216; FP-1…FP-9)
- [`adr_public_index_registry_indirection.md`](./adr_public_index_registry_indirection.md)
  — D4 superseded, D5 reinterpreted (marked inline)
- [`adr_index_bot_and_workflow_security.md`](./adr_index_bot_and_workflow_security.md)
  — BD-4/5/6 amended, G-table delta (G-08/G-17 retired, G-11 partially superseded, G-12
  verify-only, G-18 always-dry, G-09 reinterpreted, G-19/G-20 added) in Amendment A1
- [`adr_locked_observation_index_format.md`](./adr_locked_observation_index_format.md)
  — `tags` provenance rows amended ("every observed tag" → "every announced tag"); wire
  shape unchanged
- [`product-context.md`](../rules/product-context.md), root `README.md` — provenance
  wording fixed
- E2E validation runs against a live GitHub + GHCR sandbox
  (`michael-herwig/ocx-index-e2e`, `ocx-contrib/ocx-index-e2e`,
  `michael-herwig/ocx-e2e-publisher`; pseudo package `e2e-lab/dummy`) — topology and
  scripts in `plan_announce_revamp` Phase 0/5, summarized in ADR-6's E2E section

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-07-18 | Michael + Claude | Initial record from the 2026-07-17/18 announce-revamp discussion (produced ADR-6) |
