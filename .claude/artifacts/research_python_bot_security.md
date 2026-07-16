## Research: Hardening the OCX Announce Bot (Python + GitHub Actions)

## Metadata

**Date:** 2026-07-16
**Domain:** security | ci-cd | packaging
**Triggered by:** design of `announce.yml`'s Python implementation — repository_dispatch-
triggered bot regenerating index entries from OCI registry truth, untrusted `client_payload`
**Expires:** 2026-10 (zizmor, `uv audit` are both <12mo old and moving fast; re-check tool
versions before implementation)

Scope note: transport/auth (PAT vs OIDC, doorbell pattern, merge policy) already covered in
`research_index_announce_bots.md` — not repeated here. This artifact covers only the bot's
own Python code and its runtime/CI hardening.

## Direct Answer

Threat-model the bot exactly like a `pull_request_target` workflow, because it has the same
shape: untrusted trigger input + write credentials in the same execution context. Layer
defenses: (1) length-capped, `re.fullmatch`-validated, env-var-indirected payload handling in
Python — never trust the payload for content, only as a lookup key (already G-08/D4's
design); (2) a fast static-analysis stack (ruff S-rules + bandit + semgrep) on the Python code;
(3) zizmor on the workflow YAML; (4) split privileged/unprivileged jobs with a dedicated
write-path Environment; (5) egress-pinning on the network+write job specifically; (6) locked,
audited, minimal Python dependencies. None of this is novel — it's the same checklist Trail of
Bits applied to Homebrew's CI in 2024, just current-generation tooling.

## Technology Landscape

### Trending (gaining momentum)
| Tool/Pattern | Adoption Signal | Key Benefit | Relevance to OCX |
|---|---|---|---|
| zizmor | 5.6k+ GH stars, 3.2M+ PyPI downloads, 500+ project trophy case (CPython, curl, PyPI, Rust, Sigstore) — [zizmor.sh](https://zizmor.sh/), [community roadmap discussion](https://github.com/orgs/community/discussions/190621) | Actions-specific static analysis (template injection, cache poisoning, impostor commits) SARIF-native | Blocking gate on `.github/workflows/**` |
| uv audit / `UV_MALWARE_CHECK` | Shipped by Astral June 2026, native to uv (no extra tool) — [astral.sh/blog/uv-audit](https://astral.sh/blog/uv-audit) | OSV-backed CVE + malware-advisory check, 4-10x faster than pip-audit on primed cache | Explicitly "preview... unstable" per Astral — not yet the blocking gate |
| dependency-review-action + uv ecosystem | GitHub-native, uv.lock support live since early 2026 — [dependency graph ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems) | PR-time diff-based new-vuln blocking, zero extra infra | Free gate on lockfile-changing PRs |

### Established (proven, widely accepted)
| Tool/Pattern | Status | Notes |
|---|---|---|
| ruff (incl. S-rules / flake8-bandit) | De-facto Python linter (FastAPI, Pydantic, Airflow) | Fast, but S-rules are a subset of bandit, not full parity |
| bandit | Mature, Apache-2.0, ~90 curated Python-AST security checks | Zero-config, cheap belt-and-suspenders alongside ruff |
| pip-audit | PyPA-maintained, OSV-backed | Stable, blocking-gate-ready today (unlike uv audit) |
| least-privilege GITHUB_TOKEN / environment protection rules | GitHub-documented since 2023-24 | `permissions: {}` at workflow level, elevate per-job |

### Emerging (early but promising)
| Tool/Pattern | Signal | Worth Watching Because |
|---|---|---|
| Python `re` opt-in timeout | Active discuss.python.org proposal (2026, still open) | Would remove the length-cap-as-only-mitigation reliance |
| semgrep GitHub rulesets (`p/python`, `p/security-audit`, `p/github-actions`) | Community + Semgrep-maintained, free CE — [registry.semgrep.dev](https://registry.semgrep.dev/ruleset/github-actions) | Dataflow/taint checks neither ruff nor bandit do (AST-only) |

### Declining (losing mindshare)
| Tool/Pattern | Signal | Avoid Because |
|---|---|---|
| Manual-only regex review without length caps | Root cause in multiple 2026 ReDoS incidents (e.g. litellm secret-redaction ReDoS) | `re` still has no engine-level timeout; length-cap is the only reliable stopgap |
| Self-hosted Actions runners for untrusted-trigger bots | Explicit Trail of Bits Homebrew finding (privilege escalation via archive extraction pivot) | GitHub-hosted ephemeral runners remove the persistence risk entirely |

## Design Patterns Worth Considering

- **Re-derive-not-trust, applied to code structure**: one core "regenerate entry from registry
  truth" module, two thin CLI entry points (single-package announce vs full reconcile) —
  mirrors [BCR's `bcr_validation.py`](https://github.com/bazelbuild/bazel-central-registry/tree/main/tools)
  `--check <id>` / `--check_all` shape. Keeps the security-critical validation logic in one
  place with one test suite (matches the repo's 100%-coverage requirement).
- **Environment-scoped write path, not approval-gated**: use a GitHub Environment
  (`index-write`) to bind `contents: write`/`pull-requests: write` only to the commit/PR step,
  separate from the read-only registry-fetch job — satisfies G-16's privileged/unprivileged
  split concretely. [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [GitHub least-privilege secrets](https://github.blog/security/application-security/implementing-least-privilege-for-secrets-in-github-actions/).
- **Audit-then-block egress**: `step-security/harden-runner` in `egress-policy: audit` for a
  few weeks before flipping to `block` — avoids breaking the bot on an unlisted endpoint while
  still catching the exfiltration-class attacks it's designed for. [harden-runner](https://github.com/step-security/harden-runner), [DoH bypass advisory (Community tier)](https://github.com/step-security/harden-runner/security/advisories/GHSA-46g3-37rh-v698).

## Key Findings

1. `client_payload.package` validation: length-cap before `re.fullmatch` (G-08's existing regex
   has no nested quantifiers, so it's not catastrophically backtrack-prone, but cap anyway),
   reject `..`/leading `/`, route only through env-var indirection — never `run:`
   interpolation. Python's `re` has no built-in ReDoS timeout as of mid-2026
   ([discuss.python.org proposal, still open](https://discuss.python.org/t/add-an-opt-in-timeout-parameter-to-re-to-mitigate-catastrophic-backtracking/107766)).
2. jsonschema (`check-jsonschema` or the `jsonschema` package,
   [python-jsonschema/check-jsonschema](https://github.com/python-jsonschema/check-jsonschema))
   is correct for entry-schema structural validation (G-01) but is not a security boundary —
   SSRF/traversal/injection checks need hand-written Python validators layered after it.
3. SSRF: allowlist the registry host (`ghcr.io`, per G-03) via `urllib.parse.urlparse(url).hostname`
   comparison, disable auto-redirects on the HTTP client and re-validate any redirect target,
   never resolve/fetch a host derived from payload content — OWASP's cheat sheet is the
   canonical pattern reference ([SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).
4. Static analysis stack: ruff S-rules (already-running linter, near-zero marginal cost) +
   bandit (cheap second AST net, catches what ruff's subset misses) + semgrep
   `p/python` + `p/security-audit` (dataflow/taint — the actual differentiator) — all blocking
   on PR. [Ruff security rules](https://pydevtools.com/handbook/how-to/how-to-enable-ruff-security-rules/), [Bandit vs Semgrep](https://appsecsanta.com/sast-tools/bandit-vs-semgrep), [semgrep bandit ruleset](https://semgrep.dev/p/bandit).
5. zizmor is the standard 2026 GitHub Actions auditor (5.6k+ stars, 3.2M+ downloads, 500+
   project trophy case) — SARIF output, default persona is high-signal, blocking-ready.
   [zizmor.sh](https://zizmor.sh/), [zizmor-action](https://github.com/zizmorcore/zizmor-action).
6. harden-runner's value is highest exactly on jobs that both fetch (registry reads) and write
   (git commit/PR) — the announce/reconcile jobs, not `validate.yml` (already unprivileged/no
   secrets per G-16). [harden-runner](https://github.com/step-security/harden-runner).
7. Least-privilege `GITHUB_TOKEN`: `permissions: {}` at workflow level, elevate per-job;
   combine with a GitHub Environment for the write step specifically.
   [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
8. `uv audit` + `UV_MALWARE_CHECK=1` ship natively in uv (June 2026) but Astral calls both
   preview/unstable — pip-audit is the safer blocking gate today.
   [astral.sh/blog/uv-audit](https://astral.sh/blog/uv-audit).
9. `dependency-review-action` supports the uv ecosystem (uv.lock) as of early 2026 — usable as
   a PR-diff vuln gate without extra config.
   [Dependency graph ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems).
10. Trail of Bits' Homebrew audit (2024, still the most detailed public CI/CD audit of a
    package-bot-adjacent system) found `pull_request_target`/`workflow_dispatch` shell-injection
    and a self-hosted-runner privilege-escalation path — direct precedent for treating
    `repository_dispatch` payloads with the same suspicion.
    [Trail of Bits — Our audit of Homebrew](https://blog.trailofbits.com/2024/07/30/our-audit-of-homebrew/).
11. BCR's `bcr_validation.py` re-derives truth from the source archive rather than trusting
    submitted metadata, with a shared core + two CLI entry points (`--check` / `--check_all`) —
    structurally worth mirroring for announce vs reconcile.
    [bazel-central-registry/tools](https://github.com/bazelbuild/bazel-central-registry/tree/main/tools).

## Recommendation

Adopt the CI gate list below now, at design time, so `announce.py`/`reconcile.py` are written
against it from the first commit rather than retrofitted:

| Gate | Trigger | Blocking? | Catches |
|---|---|---|---|
| ruff (incl. S-rules) | every PR/push | Blocking | style + bandit-subset security |
| bandit | every PR/push | Blocking | AST security net beyond ruff's subset |
| semgrep `p/python` + `p/security-audit` | every PR/push | Blocking | dataflow/taint (payload→sink) |
| zizmor (default persona, SARIF) | PR touching `.github/workflows\|actions/**` | Blocking | Actions injection/permissions/cache-poisoning |
| pip-audit | every PR + nightly | Blocking (PR), alert (nightly) | known CVEs in locked deps |
| dependency-review-action | PR touching `pyproject.toml`/`uv.lock` | Blocking | new dependency with known vuln |
| harden-runner (audit→block) | announce.yml/reconcile.yml jobs only | Audit first, then blocking | anomalous egress = exfil/compromise |
| pytest --cov (100%) | every PR | Blocking | existing repo requirement (`task verify`) |

Do not add CodeQL or a paid SAST platform yet — the free stack above already covers every
threat class in scope (injection, SSRF, ReDoS, Actions-specific risk, supply chain), and this
repo's own boring-technology principle argues against a fourth static-analysis tool at 42-500
packages of scale.

## Sources

| Source | Type | Date | Relevance |
|---|---|---|---|
| [zizmor.sh](https://zizmor.sh/) | Docs | fetched 2026-07-16 | Actions auditor, personas, SARIF |
| [zizmor-action](https://github.com/zizmorcore/zizmor-action) | Repo | 2026 | CI integration |
| [Community discussion #190621](https://github.com/orgs/community/discussions/190621) | Discussion | 2026 | zizmor 2026 roadmap/adoption signal |
| [step-security/harden-runner](https://github.com/step-security/harden-runner) | Repo | 2026 | egress monitoring/blocking |
| [Harden-Runner DoH bypass advisory](https://github.com/step-security/harden-runner/security/advisories/GHSA-46g3-37rh-v698) | Advisory | 2026 | Community-tier limitation |
| [astral.sh/blog/uv-audit](https://astral.sh/blog/uv-audit) | Blog (primary) | fetched 2026-07-16 | uv audit + malware check, preview status |
| [Bandit vs Semgrep 2026](https://appsecsanta.com/sast-tools/bandit-vs-semgrep) | Blog | 2026 | tool selection tradeoffs |
| [semgrep.dev/p/bandit](https://semgrep.dev/p/bandit) | Registry | 2026 | bandit-equivalent semgrep ruleset |
| [Ruff security rules how-to](https://pydevtools.com/handbook/how-to/how-to-enable-ruff-security-rules/) | Docs/blog | 2026 | S-rule enablement |
| [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Official reference | ongoing | SSRF validation patterns |
| [Python re timeout proposal](https://discuss.python.org/t/add-an-opt-in-timeout-parameter-to-re-to-mitigate-catastrophic-backtracking/107766) | Official forum | 2026 | ReDoS mitigation state |
| [check-jsonschema](https://github.com/python-jsonschema/check-jsonschema) | Repo | 2026 | jsonschema CLI/pre-commit |
| [GitHub — least-privilege secrets](https://github.blog/security/application-security/implementing-least-privilege-for-secrets-in-github-actions/) | Official blog (fetched) | 2026-07-16 | Environment/secret scoping patterns |
| [GitHub — Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) | Official docs | 2026 | GITHUB_TOKEN least privilege |
| [Dependency graph supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems) | Official docs | 2026 | uv.lock support confirmation |
| [Trail of Bits — Our audit of Homebrew](https://blog.trailofbits.com/2024/07/30/our-audit-of-homebrew/) | Blog (fetched) | 2024-07-30 | CI/CD findings, self-hosted runner risk |
| [bazel-central-registry/tools](https://github.com/bazelbuild/bazel-central-registry/tree/main/tools) | Repo | 2026 | bcr_validation.py structure |
| [bazel-central-registry docs/README.md](https://github.com/bazelbuild/bazel-central-registry/blob/main/docs/README.md) | Docs | 2026 | validation/review policy |
| [Building the OpenTofu Registry](https://opentofu.org/blog/building-the-opentofu-registry/) | Blog | 2026 | re-derive-from-source pattern (Go, cross-check) |
| [opentofu/registry](https://github.com/opentofu/registry) | Repo | 2026 | GPG/checksum verification model |
