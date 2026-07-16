# CLAUDE.md

Guide Claude Code in this repo.

## ⛔ MODEL POLICY — NON-NEGOTIABLE

Applies to EVERY subagent spawn (Agent tool, Workflow `agent()`, swarm skills).
Always set `model` explicitly — never rely on inherit (a Fable main loop would
silently spawn Fable workers).

| Task | Model |
|---|---|
| Implementation, research, review, docs, tests, exploration — **the default** | **Sonnet 5** (`sonnet`) |
| Genuinely hard problems where Sonnet demonstrably falls short | Opus (`opus`) — rare, justify in the spawn prompt |
| Synthesizing multiple agent results into architecture conclusions | Fable — main loop only, (near-)NEVER as a subagent |

**Never** spawn Fable subagents for review, research, or implementation.
Parallelize Sonnet workers aggressively instead of escalating model tier.

## What This Repo Is

Source of truth for the **OCX public package index** at `https://index.ocx.sh` —
static sparse HTTP index (crates.io model) rendered to Cloudflare Pages. Pointer
files map logical names (`ocx.sh/cmake`) to physical OCI registries
(`ghcr.io/ocx-contrib/cmake`). No server, no database.

Identity + wire contract: [product-context.md](./.claude/rules/product-context.md).
Inherited design + history: [handover_from_ocx.md](./.claude/artifacts/handover_from_ocx.md).

## Current State

Bootstrap phase. Live: placeholder `public/config.json` + `index.html`, deploy
workflow with self-activating custom domains (`index.ocx.sh` canonical,
`index.ocx.rs` legacy bootstrap — detach at ocx.rs disposal). Everything else
(entry schema, validate/render/announce/reconcile CI, 42 seed entries) is design
work ahead — start from the handover, run research → design → plan here.

## Rule Catalog

@.claude/rules.md

## Layout

| Path | Purpose |
|---|---|
| `public/` | Deployed verbatim to Pages (until render CI replaces this) |
| `.github/workflows/deploy.yml` | Pages deploy + domain/DNS self-activation |
| `.claude/artifacts/` | Handover, ADR, design spec, research (ported from ocx) |
| `.claude/state/plans/` | Plans (gitignored) — Plan Status Protocol applies |

## Workflow

- **Branch + PR + merge** — never commit on `main`. Pushing feature branches and
  merging PRs in THIS repo is the normal flow (unlike ocx-sh/ocx, where pushes are
  human-gated).
- Commits: [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `ci:`, `chore:`, `docs:`). No `Co-Authored-By` trailers.
- Planning: research → ADR/design → plan → execute. Skills: `/swarm-plan`,
  `/swarm-execute`, `/swarm-review`. Artifacts → `.claude/artifacts/`
  (`research_*.md`, `adr_*.md`, `design_spec_*.md`); templates →
  `.claude/templates/artifacts/`.

## Security Invariants (CI)

- `permissions:` default-deny on every workflow; SHA-pinned actions
- Privileged/unprivileged split — never execute PR-head code under
  `pull_request_target`
- Any `client_payload` field validated (regex, no path traversal) via env-var
  indirection — never `run:` interpolation
- **Cache Rule**: never enable Cloudflare caching for `*.json` on the index zone

## Wire Contract = One-Way Door

Published URL shapes (`/config.json`, `/p/<ns>/<pkg>.json`) + JSON field semantics
must stay backward compatible once ocx clients bake the endpoint. Additive changes
only; `format_version` gates breaking evolution.
