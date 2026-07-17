# E2E Sandbox (announce-revamp, Phase 0)

Disposable, all-public sandbox topology so E2E testing of announce/reconcile
never touches the real `ocx-sh/index` repo or `ghcr.io/ocx-contrib/*`.

| Repo | Role |
|---|---|
| `michael-herwig/ocx-index-e2e` | sandbox index (plain-push copy of this repo's `main`, not a fork) |
| `ocx-contrib/ocx-index-e2e` | GitHub fork of the sandbox -- plays the publisher's fork |
| `michael-herwig/ocx-e2e-publisher` | publisher harness -- pushes `ghcr.io/michael-herwig/ocx-e2e-dummy` |

Pseudo package: logical `e2e-lab/dummy`, physical `ghcr.io/michael-herwig/ocx-e2e-dummy`.

## Stages

Run `scripts/e2e/setup-sandbox.sh [stage...]` (no args = all, in order). Every
stage is idempotent -- re-running is always safe.

1. `repos` -- create the sandbox + publisher repos
2. `content` -- push this repo's `main` to the sandbox, fork it, disable its `render-deploy.yml`
   (fork lives here, not in `repos`: GitHub refuses to fork an empty repo)
3. `harness` -- publish + dispatch the publisher harness (pushes the dual-libc package)
4. `seed` -- (stub, waits on Phase 2 -- `owners[]` gains `github_id`, root shape may change)
   generate `p/e2e-lab/dummy.json` + CAS objects from registry truth
5. `protect` -- sandbox branch protection, auto-merge, Actions workflow permissions
6. `smoke` -- verify anonymous GHCR pull of the dummy package (200, 2 manifests, glibc+musl)

## Package visibility

No manual step needed: a package first pushed from a **public** repo's own
Actions run, carrying the `org.opencontainers.image.source` annotation (both
true here), lands **public automatically** -- confirmed live. If a future
push ever comes up private anyway, the fallback fix is the GHCR UI toggle:
https://github.com/users/michael-herwig/packages/container/ocx-e2e-dummy/settings

## `index-write` environment / `INDEX_WRITE_TOKEN`

Not provisioned in the sandbox, and likely never needed here: the
announce-revamp plan deletes `announce.yml` and drops `reconcile.yml` to
`issues: write` with the default `github.token`, so neither privileged path
this sandbox exists to test will require the `index-write` Environment or an
`INDEX_WRITE_TOKEN` secret. Revisit only if that Phase-3 assumption changes.

## Re-running

Safe to re-run the whole script or any single stage at any time -- each stage
checks its target state first.
