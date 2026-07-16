# Research: 100% Test Coverage Gate for the OCX Announce Bot

## Metadata

**Date:** 2026-07-16
**Domain:** testing | ci-cd | security
**Triggered by:** design of `announce.yml`/`validate.yml`/`reconcile.yml` bot (security-critical, handles namespace-scoped PATs, writes to the public index) — need `task verify` + CI to enforce line+branch coverage = 100%, honestly.
**Expires:** 2026-Q4 — re-check coverage.py/hypothesis/mutmut release notes and the httpx→httpx2 stewardship transition before relying on this.

## Direct Answer

Use `coverage.py` (via `pytest-cov`) with `branch = true` + `fail_under = 100` in `[tool.coverage.*]` inside `pyproject.toml`; run it identically in `task verify` and CI so there is one gate, not two. Keep the gate honest with tight, reviewed `exclude_also` regexes (not scattered inline pragmas), an httpx+respx fake for the two external APIs (OCI registry token dance + GitHub REST), `hypothesis` for the payload-validator regex/path-traversal property tests, and a **non-blocking, scheduled** mutation-testing job (mutmut) as the check that 100% coverage isn't just "executed, never asserted." None of this is exotic — every piece is 2026-mainstream, boring-tech, and has a primary-source precedent below.

## Technology Landscape

### Trending
| Tool/Pattern | Adoption Signal | Key Benefit | Relevance to OCX |
|---|---|---|---|
| `httpx2` (Pydantic stewardship of `httpx`) | Announced 2026, [github.com/pydantic/httpx2](https://github.com/pydantic/httpx2), companion `pytest-httpx2` built on respx already shipped | Original `httpx` maintenance had slowed; Pydantic took over for "timely security updates" — matters for a bot holding namespace PATs | Prefer `httpx`/`httpx2` over `requests` for the bot's HTTP client; respx-based mocking already supports both |
| Codecov-free, self-hosted 100% gates (`coverage combine` + `--fail-under=100` in a dedicated CI job) | [Hynek Schlawack, "How to Ditch Codecov for Python Projects"](https://hynek.me/articles/ditch-codecov-python/) | No third-party upload flakiness; the gate lives entirely in your own CI | Directly reusable pattern for `task verify`/CI parity |

### Established
| Tool/Pattern | Status | Notes |
|---|---|---|
| `coverage.py` + `pytest-cov`, `branch=true`, `fail_under=100`, `exclude_also` | Mature (coverage.py 7.x) | [Official config docs](https://coverage.readthedocs.io/en/latest/config.html), [excluding.html](https://coverage.readthedocs.io/en/latest/excluding.html) |
| `hypothesis` for property-based testing | Mature, used by CPython's own test suite ecosystem | `from_regex(pattern, fullmatch=True)` generates strings matching a validator regex; [official strategies reference](https://hypothesis.readthedocs.io/en/latest/reference/strategies.html) |
| `respx` (httpx mock router) | Mature, latest 0.23.1 (Apr 2026), Python 3.8+/httpx 0.25+ ([PyPI](https://pypi.org/project/respx/), [GitHub](https://github.com/lundberg/respx)) | Declarative route/response mocking, no cassette files to scrub |
| `vcrpy` | Mature but actively released (8.3.0, Jul 2026, [PyPI](https://pypi.org/project/vcrpy/)) | Client-agnostic record/replay; good for *exploratory* GitHub-API capture, riskier for a secrets-handling bot (cassettes must be scrubbed) |
| `mutmut` mutation testing | Mature, 1.4k★, incremental/parallel runner ([GitHub](https://github.com/boxed/mutmut), [docs](https://mutmut.readthedocs.io/en/latest/index.html)) | Good fit for a small codebase — fast enough to run without heavy infra |
| `covdefaults` (A. Sottile) | Mature, widely reused across many small repos ([GitHub](https://github.com/asottile/covdefaults)) | Ships `fail_under=100` + a curated `exclude_lines` set (`__repr__`, `NotImplementedError`, `TYPE_CHECKING`, platform/version pragmas) so every repo doesn't reinvent the regex list |

### Emerging
| Tool/Pattern | Signal | Worth Watching Because |
|---|---|---|
| `diff-cover` for "100% on the diff, ratchet the rest" | Active project ([PyPI](https://pypi.org/project/diff-cover/)), used at scale (Codacy blog) | If a *hard* 100% ever proves too costly for legacy code later, diff-cover is the standard fallback — not needed for a bot written 100%-clean from day one |
| Scientific-Python's shared coverage recipe (`sysmon` core, `source_pkgs`, matrix `coverage combine`) | Community guide, actively maintained ([learn.scientific-python.org](https://learn.scientific-python.org/development/guides/coverage/)) | `run.core = "sysmon"` (3.12+ sys.monitoring) is the new low-overhead coverage backend — check it's on once the bot's Python floor is 3.12+ |

### Declining
| Tool/Pattern | Signal | Avoid Because |
|---|---|---|
| Codecov/Coveralls as *the* pass/fail gate | Hynek's post ([link](https://hynek.me/articles/ditch-codecov-python/)) documents upload flakiness/status-delay pain repeatedly hit by mature OSS projects | Fine as a reporting/trend dashboard, wrong as the enforcement mechanism for a security-critical gate — enforce locally in CI, report externally only if wanted |
| Hand-rolled recorded-response fixtures (PyGithub's own `ReplayData` framework) | PyGithub built this because nothing better existed at the time ([testing docs](https://pygithub.readthedocs.io/en/stable/testing.html)) | For a new codebase, `vcrpy`/`respx` give the same capability without maintaining bespoke replay infra |

## Design Patterns Worth Considering

- **Doorbell re-derivation testability**: because the bot never trusts dispatch-payload fields (G-08/D4 — re-reads the registry), its HTTP boundary is small and enumerable (token endpoint, `tags/list`, manifest GET, GitHub contents/PR API) — this is exactly the shape `respx`/`responses` are built for (finite, declarable routes), not `vcrpy`'s strength (organic session capture). Keep the mock inventory small and explicit.
- **Entrypoint-as-pure-function**: give the announce script a `def main(argv: list[str], env: Mapping[str, str]) -> int` (or similar) instead of reading `sys.argv`/`os.environ` scattered through the module. `GITHUB_OUTPUT` is just a file path in `env`; tests pass a `tmp_path` file and assert its contents — no monkeypatch-the-world needed. GitHub's own mechanics: outputs are appended to the `GITHUB_OUTPUT` file (`echo "name=value" >> "$GITHUB_OUTPUT"`); `INPUT_<NAME>` only exists for declared `action.yml` inputs ([workflow-commands docs](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)) — since this bot is invoked from a plain workflow step, prefer explicit `env:` names in the YAML over emulating the `INPUT_*` convention (that convention exists for marketplace actions with an `action.yml`, which the bot is not).
- **No-combine-yet YAGNI**: Hynek's `coverage combine` across a GH Actions matrix only earns its keep once you actually run a Python-version matrix; a small bot pinned to one Python version needs one `coverage run` + `coverage report --fail-under=100`, no combine step, no artifact upload/download dance. Add combine when a matrix is added, not before.

## Key Findings

1. **Config**: `[tool.coverage.run] branch = true`, `[tool.coverage.report] fail_under = 100`, `show_missing = true`; `exclude_also` *adds* to (not replaces) the built-in default exclusions — prefer it over hand-scattering `# pragma: no cover`. [coverage.py config docs](https://coverage.readthedocs.io/en/latest/config.html), [excluding.html](https://coverage.readthedocs.io/en/latest/excluding.html)
2. **Pragma policy**: legitimate uses are narrow and enumerable (`if __name__ == "__main__":`, `@abstractmethod`, `raise NotImplementedError`, `if TYPE_CHECKING:`, platform guards) — codify them once as `exclude_also` regexes (steal `covdefaults`'s list, [GitHub](https://github.com/asottile/covdefaults)) rather than trusting every PR author's inline `# pragma: no cover` judgment call. There is no dedicated third-party "pragma linter"; the practical control is code review + keeping the `exclude_also` list itself as the single reviewed surface (a diff to that list is visible in every PR).
3. **HTTP test doubles**: for the OCI-registry token dance + GitHub REST, `respx` (httpx) or `responses` (requests) beat `vcrpy` for a 100%-coverage suite because you need to *synthesize* edge cases (401→token refresh, 5xx retry/backoff, malformed JSON, missing digest header) that a real recorded session won't naturally contain; `vcrpy` cassettes also risk leaking a namespace PAT if `filter_headers` scrubbing is ever forgotten. [respx](https://github.com/lundberg/respx), [vcrpy](https://pypi.org/project/vcrpy/), PyGithub had to build its own replay framework in the pre-`vcrpy`-maturity era ([testing docs](https://pygithub.readthedocs.io/en/stable/testing.html)) — don't repeat that; use `respx` instead.
4. **GH Actions entrypoint testing**: outputs go through the `GITHUB_OUTPUT` env-file-append convention; `INPUT_<NAME>` is specific to declared-`action.yml` inputs and doesn't apply to a plain workflow-step script. [Official docs](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions). Cleanest test seam: factor argv/env parsing into one small function taking explicit params, tested with `monkeypatch.setenv`/`tmp_path`.
5. **Hypothesis for the validator**: `from_regex(PATTERN, fullmatch=True)` is the direct tool for "does my allowlist regex accept what it should" — but the *security*-relevant property is the inverse (reject `..`, absolute paths, empty segments) and needs a second property built from `st.text()` + injected traversal tokens, not `from_regex` alone. [Official strategies reference](https://hypothesis.readthedocs.io/en/latest/reference/strategies.html). Worth the dependency: it's one `hypothesis` line vs. hand-enumerating a dozen malicious-string fixtures, and it shrinks failures to a minimal repro automatically.
6. **Mutation testing**: `mutmut` (1.4k★, actively released) and `cosmic-ray` (8.4.6, Apr 2026 release) are both live in 2026 — no need to pick a fading tool. For a bot this small, run mutation testing as a **scheduled/nightly, non-blocking** job, not a PR gate (mutation runs are slow relative to the coverage gate); treat "no new surviving mutants" as the policy on touched modules rather than a numeric score threshold. [mutmut](https://github.com/boxed/mutmut), [cosmic-ray](https://github.com/sixty-north/cosmic-ray).
7. **Wiring**: `task verify` and CI must invoke the *exact same* command (`uv run pytest --cov --cov-branch --cov-report=term-missing`, config carries `fail_under=100`) — Hynek's Codecov-free pattern (`coverage combine` + `coverage report --fail-under=100` in one CI job) is the reference shape once a Python-version matrix exists ([source](https://hynek.me/articles/ditch-codecov-python/)); until then, skip the combine step (YAGNI). Cache with `astral-sh/setup-uv`'s `enable-cache: true` keyed on `uv.lock` ([setup-uv](https://github.com/astral-sh/setup-uv), [uv GH Actions guide](https://docs.astral.sh/uv/guides/integration/github/)).
8. **Known failure mode**: 100% line/branch coverage is compatible with zero assertions — coverage measures *execution*, not *verification* (Ned Batchelder himself, coverage.py's author: "[Flaws in coverage measurement](https://nedbatchelder.com/blog/200710/flaws_in_coverage_measurement.html)" — statement coverage "takes you to the end of its road... but you aren't at your destination"). Standard mitigations: code review must check for real `assert`s (not just `pytest.raises`/call-and-discard), a scheduled mutation-testing job as the automated backstop (finding #6), and — per Batchelder's own later post — accepting that coverage-goal *shape* can differ by code region ([Coverage goals](https://nedbatchelder.com/blog/202111/coverage_goals.html)) even while this repo's `quality-core.md` "Verification Honesty" rule already bans hedged/unverified completion claims, which is the human-process half of this mitigation.

## Recommendation

Adopt this concretely, in order:

1. **`pyproject.toml`**:
   ```toml
   [tool.coverage.run]
   branch = true
   source = ["src"]   # adjust to actual bot package layout
   relative_files = true

   [tool.coverage.report]
   fail_under = 100
   show_missing = true
   exclude_also = [
     "if __name__ == .__main__.:",
     "if TYPE_CHECKING:",
     "@(abc\\.)?abstractmethod",
     "raise NotImplementedError",
   ]
   ```
2. **`taskfile.yml`**: add a `test` task running `uv run pytest --cov --cov-branch --cov-report=term-missing`, and call it from `verify` alongside the existing `jq empty` check — one command, reused verbatim in the CI workflow step so `task verify` and CI can never drift.
3. **HTTP layer**: `httpx` client (leave the httpx2-rename decision for later — respx already tracks both via `pytest-httpx2`), mocked in tests with `respx`. Do not add `vcrpy` unless a future need for full-session GitHub-API exploration arises.
4. **Validator tests**: one `hypothesis`-based test file for the payload regex (`from_regex` for acceptance, `st.text()`+injected `..`/`/` tokens for rejection). Small, worth the dependency for a security-facing validator.
5. **Mutation testing**: `mutmut`, scheduled workflow (e.g. weekly or on `validate.py`/`announce.py` diffs only), non-blocking initially — promote to a merge gate only if surviving-mutant counts stay actionable in practice.
6. **Do not** chase Codecov/Coveralls as the enforcement mechanism; if a coverage dashboard is wanted later, layer it on top of the self-contained `--fail-under=100` gate, never instead of it.

## Sources

| Source | Type | Date | Relevance |
|---|---|---|---|
| [coverage.py config reference](https://coverage.readthedocs.io/en/latest/config.html) | Official docs | live | `branch`, `fail_under`, `exclude_also` exact syntax |
| [coverage.py excluding.html](https://coverage.readthedocs.io/en/latest/excluding.html) | Official docs | live | pragma semantics, over-match warning |
| [covdefaults](https://github.com/asottile/covdefaults) | GitHub | live | reusable `exclude_also` baseline for 100% gates |
| [Hynek Schlawack — Ditch Codecov](https://hynek.me/articles/ditch-codecov-python/) | Blog (primary practitioner) | 2026 | self-hosted 100% gate across CI matrix, no third-party service |
| [Ned Batchelder — Flaws in coverage measurement](https://nedbatchelder.com/blog/200710/flaws_in_coverage_measurement.html) | Blog (coverage.py author) | 2007, still canonical | coverage-≠-correctness limitation |
| [Ned Batchelder — Coverage goals](https://nedbatchelder.com/blog/202111/coverage_goals.html) | Blog (coverage.py author) | 2021 | per-region coverage goal nuance |
| [Scientific Python — Coverage guide](https://learn.scientific-python.org/development/guides/coverage/) | Community guide | live | matrix `coverage combine`, `sysmon` core |
| [respx](https://github.com/lundberg/respx) / [PyPI](https://pypi.org/project/respx/) | GitHub/PyPI | 0.23.1, Apr 2026 | httpx mock router |
| [vcrpy PyPI](https://pypi.org/project/vcrpy/) | PyPI | 8.3.0, Jul 2026 | record/replay alternative, secrets-scrub caveat |
| [PyGithub testing docs](https://pygithub.readthedocs.io/en/stable/testing.html) | Official docs | live | precedent for (and limits of) hand-rolled replay fixtures |
| [GitHub Actions — workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) | Official docs | live | `GITHUB_OUTPUT`, `INPUT_<NAME>` mechanics |
| [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv) / [uv GH Actions guide](https://docs.astral.sh/uv/guides/integration/github/) | Official docs | live | CI caching for `uv run pytest` |
| [hypothesis strategies reference](https://hypothesis.readthedocs.io/en/latest/reference/strategies.html) | Official docs | live | `from_regex(fullmatch=True)` |
| [mutmut](https://github.com/boxed/mutmut) / [docs](https://mutmut.readthedocs.io/en/latest/index.html) | GitHub/official docs | live, 1.4k★ | mutation testing, incremental runs |
| [cosmic-ray](https://github.com/sixty-north/cosmic-ray) | GitHub | 8.4.6, Apr 2026 | mutation testing alternative |
| [diff-cover](https://pypi.org/project/diff-cover/) | PyPI | live | fallback ratchet pattern if hard 100% ever proves too costly |
| [pydantic/httpx2](https://github.com/pydantic/httpx2) / [httpx2.pydantic.dev](https://httpx2.pydantic.dev/) | Official announcement | 2026 | httpx maintenance handoff, security-update relevance |
| [pytest-httpx2](https://github.com/lundberg/pytest-httpx2) | GitHub | live | confirms respx-family mocking already covers httpx2 |
