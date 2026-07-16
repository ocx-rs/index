
# Research: Python Stack + Design Patterns for the OCX Announce/Reconcile Bot

## Metadata

**Date:** 2026-07-16
**Domain:** packaging | ci-cd | security
**Triggered by:** repo bootstrap — designing the announce/reconcile bot (Python, security-critical, 100% test coverage gate, `task verify`) that lives in a non-Python-primary repo
**Expires:** re-verify uv/ruff/ty version claims if not implemented within ~6 months; ty status especially (beta as of 2026-07-16)

## Direct Answer

Real uv-managed package (src layout), not loose scripts or a PEP 723 single-file
script — the 100% coverage gate needs a pytest home. Toolchain: **uv + ruff (with
`S`/bandit explicitly opted in) + pyright --strict** as the CI gate; `ty` stays
editor-only until it ships a stable/strict release. Two justified third-party deps:
**httpx** (HTTPS to GHCR + GitHub API, timeouts mandatory) and **jsonschema**
(matches the repo's own `schema/entry.schema.json` contract — hand-rolling would
duplicate the schema in two places). Architecture: **functional core / imperative
shell** with `Protocol`-typed I/O ports — this, not mocking frameworks, is what
makes 100% branch coverage tractable.

## Technology Landscape

### Trending (gaining momentum)

| Tool/Pattern | Adoption Signal | Key Benefit | Relevance to OCX |
|---|---|---|---|
| uv (project mode, `uv.lock` hashes by default) | Astral's stated 2026 default stack; replaces pip/poetry/pipx/pyenv | Deterministic installs, hash-verified by default in project mode | CI reproducibility for the bot without extra hash flags |
| Ruff `S` (bandit) rule group | Ships in ruff core, opt-in `select` | Catches missing timeouts, unsafe subprocess/URL-open at lint time, not runtime | Directly gates the "security-critical" requirement |
| Functional core / imperative shell | Long-standing pattern, current renewed interest (2026 HN threads) | Pure logic = exhaustively unit-testable; I/O isolated at edges | Path to 100% branch coverage without mock hell |

### Established (proven, widely accepted)

| Tool/Pattern | Status | Notes |
|---|---|---|
| ruff (lint+format) | De facto standard, replaces flake8/black/isort/pylint | Already the pick in quality-python.md |
| pyright | Production type-check default | Plugin ecosystem (Pydantic/Django stubs) `ty` still lacks |
| `jsonschema` (python-jsonschema) | Reference JSON Schema implementation | Correct tool when a JSON Schema file is the source of truth (G-01) |
| httpx | Requests-successor, Encode-maintained, small stable dep chain | Handles OCI bearer-token flow + GitHub REST cleanly; sync+async |
| Protocol-typed dependency injection | Standard Python typing-spec pattern | Already codified in quality-python.md |

### Emerging (early but promising)

| Tool/Pattern | Signal | Worth Watching Because |
|---|---|---|
| Astral `ty` | Beta (0.0.60 as of 2026-07-16), targets stable 2026 | 10-60x faster than pyright; no stable API/strict mode yet — not CI-gate-ready |
| OIDC Trusted Publishing for announce credential | crates.io/npm/PyPI already live (per `research_index_announce_bots.md`) | Would remove the bot's long-lived PAT entirely — v2, not this research's scope |

### Declining (losing mindshare)

| Tool/Pattern | Signal | Avoid Because |
|---|---|---|
| Loose top-level `.github/scripts/*.py` with no pyproject.toml | Common in older repos, poor test/lint ergonomics | No coverage gate possible, no lockfile, no reproducibility |
| Bandit as a standalone tool | Superseded by Ruff's `S` group for the common-case checks | Extra tool/process for rules Ruff already implements in the same pass |
| mypy as first choice for new projects | Still fine, but pyright/ty both faster and better-typed-stdlib-aware | quality-python.md already made this call |

## Design Patterns Worth Considering

- **Functional core / imperative shell** — pure `regenerate_entry()`/`diff()` functions return data describing the target state; a thin shell applies it via injected ports. Used by: this pattern's namesake literature (functional-architecture.org), broadly cited for CI/automation testability. [Link](https://functional-architecture.org/functional_core_imperative_shell/)
- **Protocol-typed ports-and-adapters (lite)** — `RegistryPort`, `GitHubPort`, `ClockPort` as `Protocol`s; tests inject in-memory fakes, production wires real httpx-backed adapters. No ABC hierarchy needed for a single implementation each (YAGNI) — Protocol still buys the structural-typing seam. [Typing spec](https://typing.python.org/en/latest/spec/protocol.html)
- **Idempotency as a first-class test, not an afterthought** — assert `diff(compute(inputs), compute(inputs)) == empty` and "second run of the same trigger is a no-op." [Link](https://www.commandinline.com/shell-script-idempotency-safe-rerun-patterns/)
- **Exit-code contract** — distinct codes for no-op-success / validation-failure / transient-retryable / anomaly-hard-stop, so `announce.yml`'s retry-with-backoff (G-10) and the reconcile anomaly rule (G-13) can branch on more than "0 or not."

## Key Findings

1. PEP 723 inline-metadata scripts fit standalone, no-test automation; a project with pytest + coverage needs a real `pyproject.toml` from the start — tooling (ruff/pyright/pytest) "expects a project." [pydevtools — What is PEP 723?](https://pydevtools.com/handbook/explanation/what-is-pep-723/)
2. `uv.lock` records SHA-256 hashes for every resolved distribution by default; `uv sync --locked` fails closed on a stale lockfile. `--require-hashes` / `UV_REQUIRE_HASHES` exist on the pip-compatible interface for exported requirements.txt workflows. [pydevtools — hash pinning](https://pydevtools.com/handbook/how-to/how-to-pin-dependencies-with-hashes-in-uv/), [astral-sh/uv#6701](https://github.com/astral-sh/uv/issues/6701)
3. Ruff's bandit-derived `S` group is opt-in (not in any default selection) — must be explicitly added via `select`/`extend-select`. [Ruff rules reference](https://docs.astral.sh/ruff/rules/)
4. `ty` is still beta (`0.0.x`, no stable API guarantee) per its own README as of today; no documented strict mode yet — keep pyright as the CI gate. [astral-sh/ty](https://github.com/astral-sh/ty), [Astral ty announcement](https://astral.sh/blog/ty)
5. `jsonschema` (python-jsonschema) is the JSON Schema reference implementation for Python; correct choice when a schema file (`schema/entry.schema.json`) is the contract's source of truth, vs Pydantic being the better fit for pure-internal-service validation. [python-jsonschema](https://github.com/python-jsonschema/jsonschema)
6. `check-jsonschema` (same maintainers) is CLI/pre-commit-only — good fit for the separate unprivileged `validate.yml` PR-gate job, not importable for in-bot use. [check-jsonschema](https://github.com/python-jsonschema/check-jsonschema)
7. httpx: ~15k GitHub stars, ~700M downloads/month, sync+async, small Encode-maintained dependency chain (httpcore/h11/certifi/idna/sniffio) — the justified HTTP dependency over stdlib `urllib.request`'s clunky API once bearer-token flows and retries are in play. [encode/httpx](https://github.com/encode/httpx), [stdlib-only alternative discussion](https://alexwlchan.net/2026/python-http-with-the-stdlib/)
8. respx is the standard httpx-mocking library for pytest, giving request-pattern-based fakes instead of raw monkeypatching — supports the functional-core/imperative-shell testing story at the shell boundary. [lundberg/respx](https://github.com/lundberg/respx)
9. GHCR's anonymous pull path still requires the standard OCI bearer-token exchange (401 + `WWW-Authenticate` → token endpoint → retry) even for public images — confirmed in this repo's own `research_ghcr_constraints.md`; this is 1-2 extra HTTP calls, not a reason to pull in a full OCI client library.
10. Idempotency-and-retry design for doorbell-triggered automation (check-before-act, compare-and-set, deterministic re-derivation) is the standard 2026 pattern for CI/agent tooling rerun-safety. [commandinline.com](https://www.commandinline.com/shell-script-idempotency-safe-rerun-patterns/)

## Recommendation

Build the bot as a normal uv package (`pyproject.toml`, `src/`, `tests/`) invoked via
`uv run` from `announce.yml`/`reconcile.yml`, gated by `task verify` running
`uv run ruff check`, `uv run pyright --strict`, and `uv run pytest --cov --cov-fail-under=100
--cov-branch`. Keep the dependency list to exactly two: **httpx** for all HTTPS
(GHCR bearer-token flow + GitHub REST), **jsonschema** for validating against the
committed `schema/entry.schema.json` — both are small, well-maintained, and each
replaces meaningfully more hand-rolled code than they cost in supply-chain surface.
Skip PyGithub/githubkit (SDK weight for a handful of REST calls), skip an OCI
client library (2-call bearer-token+manifest flow doesn't justify one), skip Bandit
standalone (Ruff's `S` group covers the same ground in one pass). Architect as
functional core (pure `regenerate_entry`/`diff`) plus a thin imperative shell behind
`Protocol` ports — this is the concrete mechanism that makes "100% branch coverage,
no mock hell" actually achievable, not just a target on paper.

## Sources

| Source | Type | Date | Relevance |
|---|---|---|---|
| [PEP 723 — Inline script metadata](https://peps.python.org/pep-0723/) | Spec | 2024 (accepted) | PEP 723 vs packaged-project boundary |
| [pydevtools — What is PEP 723?](https://pydevtools.com/handbook/explanation/what-is-pep-723/) | Blog | 2026 | When inline scripts stop being appropriate |
| [uv — Locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/) | Docs | current | `--locked`/`--frozen` semantics |
| [pydevtools — hash pinning in uv](https://pydevtools.com/handbook/how-to/how-to-pin-dependencies-with-hashes-in-uv/) | Blog | 2026 | Hash verification story |
| [astral-sh/uv#6701](https://github.com/astral-sh/uv/issues/6701) | GitHub Issue | open | `--require-hashes` edge case |
| [Ruff rules reference](https://docs.astral.sh/ruff/rules/) | Docs | current | `S`/`ANN`/`B`/`BLE`/`TRY` group definitions |
| [astral-sh/ty](https://github.com/astral-sh/ty) | GitHub repo | checked 2026-07-16 | Beta status, no stable API yet |
| [Astral — ty announcement](https://astral.sh/blog/ty) | Blog | 2026 | Design goals, roadmap to stable |
| [python-jsonschema/jsonschema](https://github.com/python-jsonschema/jsonschema) | GitHub repo | current | Reference JSON Schema validator |
| [python-jsonschema/check-jsonschema](https://github.com/python-jsonschema/check-jsonschema) | GitHub repo | current | CLI/pre-commit-only validator |
| [encode/httpx](https://github.com/encode/httpx) | GitHub repo | current | Adoption numbers, dependency chain |
| [alexwlchan — HTTP with the stdlib](https://alexwlchan.net/2026/python-http-with-the-stdlib/) | Blog | 2026 | stdlib urllib limits vs httpx |
| [lundberg/respx](https://github.com/lundberg/respx) | GitHub repo | current | httpx test-mocking pattern |
| [Functional Core, Imperative Shell](https://functional-architecture.org/functional_core_imperative_shell/) | Article | — | Core pattern for testability |
| [commandinline.com — shell script idempotency](https://www.commandinline.com/shell-script-idempotency-safe-rerun-patterns/) | Blog | 2026 | Rerun-safety design checklist |
| `.claude/artifacts/research_ghcr_constraints.md` (this repo) | Internal artifact | 2026-07-12 | GHCR bearer-token flow confirmation |
| `.claude/artifacts/research_index_announce_bots.md` (this repo) | Internal artifact | 2026-07-12 | Bot workflow-behavior precedent (not stack) |

## Proposed `.claude/rules/quality-python.md` Additions

Append as a new `## CI Bot / Security-Critical Automation` section (~28 lines,
keeps file at ~142/200). Phrased generically so the file stays project-independent:

```markdown
## CI Bot / Security-Critical Automation

Patterns for bots invoked from CI (GitHub Actions, cron) holding real credentials.

- **Functional core / imperative shell**: pure state-computation functions
  (`compute(inputs) -> TargetState`, `diff(current, target) -> Patch | None`)
  separated from I/O. The core is exhaustively unit-tested with plain values;
  the shell (network, filesystem, subprocess) is thin and covered via fakes.
  This — not a mocking framework — is what makes near-100% branch coverage
  achievable without mock hell.
- **`Protocol`-typed I/O ports** for every external system (registry, VCS API,
  filesystem) — production wires a real adapter, tests inject an in-memory
  fake. No ABC hierarchy for a single implementation (YAGNI); the Protocol
  boundary is what buys substitutability.
- **Idempotency is a required test, not a nice-to-have**: assert that running
  the same computation twice on unchanged inputs produces an empty diff /
  no-op. Rerun-safety for doorbell-triggered bots is a correctness property,
  test it directly.
- **Exit-code contract**: distinguish no-op-success, validation-failure,
  transient-retryable-failure, and hard-stop-anomaly with distinct non-zero
  codes — callers (retry logic, CI log triage) must not have to parse text
  to tell success-with-nothing-to-do from broken.
- **Ruff `S` (flake8-bandit) group is opt-in — enable it explicitly** for any
  credential-holding bot. At minimum: `S113` (HTTP call without timeout),
  `S310` (URL-open with unchecked scheme), `S603`/`S607` (subprocess call/
  partial-path). Ruff rule: `select = [..., "S"]`.
- **Type-check gate = pyright (`--strict`)**, not `ty` — `ty` is materially
  faster for editor feedback but remains beta with no stable API guarantee;
  revisit once it ships a stable release with strict mode.
```
