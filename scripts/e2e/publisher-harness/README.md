# ocx-e2e-publisher

Publisher harness for the announce-revamp E2E sandbox: pushes a hand-crafted
dual-libc dummy package to `ghcr.io/michael-herwig/ocx-e2e-dummy`.

Dispatch: `gh workflow run push-package.yml -f tag=1.0.0` (default tag `1.0.0`).
