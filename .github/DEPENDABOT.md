# Dependency update checks

Dependabot's native bun updater maintains the text bun.lock together with
package.json. CI checks it with bun install --frozen-lockfile. The redundant
pull_request auto-format workflow was retired: a Dependabot pull_request token
is read-only, so it could not push a regenerated lockfile. No privileged job
executes dependency scripts or PR code to work around that boundary.

GitHub Actions updates use the weekly SHA-aware feed. Majors and security tools
remain under manual review.

Source: https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories
