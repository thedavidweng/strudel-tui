# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.1](https://github.com/thedavidweng/strudel-tui/compare/v0.2.0...v0.2.1) (2026-10-17)


### Bug Fixes

* **release:** sign and notarize macOS executables ([#50](https://github.com/thedavidweng/strudel-tui/issues/50)) ([ca4e46d](https://github.com/thedavidweng/strudel-tui/commit/ca4e46d27809c1d91b7e883217c0c6156770e524))

## [0.2.0](https://github.com/thedavidweng/strudel-tui/compare/v0.1.0...v0.2.0) (2026-10-17)


### Features

* add /config and /provider slash commands ([55d05b9](https://github.com/thedavidweng/strudel-tui/commit/55d05b9aa5eedbbd736e807dc50811a757532b4f))
* add test pyramid, CI improvements, and E2E smoke tests ([c65c26f](https://github.com/thedavidweng/strudel-tui/commit/c65c26fe8a01d8a6b793b856c0a131ebd2c5dcc6))
* **audio:** real playback via a localhost browser bridge ([06fcc1d](https://github.com/thedavidweng/strudel-tui/commit/06fcc1ddcd2fd8f96311d9e3f876415076ed4a11))
* **editor:** implement PatternPanel edit mode ([f26a80e](https://github.com/thedavidweng/strudel-tui/commit/f26a80e9b6c6159ccecab844180090a66a1b007b))
* inline config wizard, direct commands, and UX improvements ([757103b](https://github.com/thedavidweng/strudel-tui/commit/757103b9ca6e6a928bf01a224dd9f336d2502c39))
* kimi-code inspired UX improvements ([41798bf](https://github.com/thedavidweng/strudel-tui/commit/41798bfbb4d35aa2cfd5f359a9684cd11116116a))
* sidebar layout, GoReleaser full pipeline, Agent architecture refactor ([2e414d5](https://github.com/thedavidweng/strudel-tui/commit/2e414d58060a080806189d9fa831cb1a8cc96bab))
* slash command autocomplete menu ([26d26aa](https://github.com/thedavidweng/strudel-tui/commit/26d26aa7bb60bf42af35286d968c56965f4d422b))
* strudel-tui — terminal live coding for Strudel with AI agent ([bc031cd](https://github.com/thedavidweng/strudel-tui/commit/bc031cd7a3407e7efbaee6f26ee88fb2c751160d))


### Bug Fixes

* add force_push and fetch-depth: 0 ([2f8b70f](https://github.com/thedavidweng/strudel-tui/commit/2f8b70f9e50594ac93dd4c4cdfe0a2369cbc9340))
* add force_push and fetch-depth: 0 ([42748ae](https://github.com/thedavidweng/strudel-tui/commit/42748aec2c4ae3492e05a3e90b8f9a2e41df6cf5))
* address PR review — wire pattern editor into the TUI, SSE spec compliance ([da99520](https://github.com/thedavidweng/strudel-tui/commit/da9952044ab09197317d5d545073834415f144d2))
* all lint warnings, bump dependabot action versions ([ac044c4](https://github.com/thedavidweng/strudel-tui/commit/ac044c442289d4e570290c5282cc5369a977af2f))
* CI failures, add dependabot, pin Bun version, add type checking ([d6fd8c4](https://github.com/thedavidweng/strudel-tui/commit/d6fd8c49819f0f9570c08bb3b96f16941dcc65ed))
* CI test failures, add oxlint, patch @kabelsalat/web ESM resolution ([1edd557](https://github.com/thedavidweng/strudel-tui/commit/1edd557f2c44875f1000529b77a9bbf29d71e0c5))
* **ci:** repair release-please YAML and smoke-test import list ([b3ded0b](https://github.com/thedavidweng/strudel-tui/commit/b3ded0b0a96ec764fd25a184ebcf3e91352f0277))
* **ci:** use SHA pin for actions/checkout@v7.0.0 consistently ([b282319](https://github.com/thedavidweng/strudel-tui/commit/b2823191c038a9e7a08af91b8d606a685feb055c))
* close remaining audit findings — validate purity, SRI, docs truth ([a5d3f6a](https://github.com/thedavidweng/strudel-tui/commit/a5d3f6a4de4b0bd6d1784e8d2447035d1ec9ccc5))
* correct mirror action SHA ([6e22a1f](https://github.com/thedavidweng/strudel-tui/commit/6e22a1fdb35eda4b6179861c5444d09b387ef35c))
* correct mirror action SHA ([f9a4953](https://github.com/thedavidweng/strudel-tui/commit/f9a4953c2e9ca75502c159234087f01c5a29bc27))
* **deps:** patch @kabelsalat/web with an ESM exports map ([b6f0b91](https://github.com/thedavidweng/strudel-tui/commit/b6f0b91f7abb9c9c57a69c66e666cdd579d9e274))
* make the shipped binary actually work outside a repo checkout ([14dfca2](https://github.com/thedavidweng/strudel-tui/commit/14dfca2e3a034581d608f6802331150ab0639987))
* pin action SHA, remove test.txt, add permissions ([f2080f0](https://github.com/thedavidweng/strudel-tui/commit/f2080f0d83d053aed871d51b89ecbbd2a0712f35))
* **release:** use repository token and let tap poll assets ([#48](https://github.com/thedavidweng/strudel-tui/issues/48)) ([e825825](https://github.com/thedavidweng/strudel-tui/commit/e825825ecb2f5785c123b24f8d581268c9e2b797))
* resolve CodeQL alert and CI test failures ([1e8a551](https://github.com/thedavidweng/strudel-tui/commit/1e8a551ceb1efad0c6337cc968d227c58aace814))
* sidebar width adapts proportionally to screen (28%, range 20-50 cols) ([5a13631](https://github.com/thedavidweng/strudel-tui/commit/5a136310060c69eb99c38ec295259cb2cc8daa15))
* StatusBar overflow causing Pattern Editor overlap, add playback feedback ([f28cdb1](https://github.com/thedavidweng/strudel-tui/commit/f28cdb1edb44be9f6b73be57576c662b4aa446c9))
* TUI layout — pin input to bottom, narrow sidebar ([6a7da14](https://github.com/thedavidweng/strudel-tui/commit/6a7da14eae1e6b38704082e87922d50d9967bcb2))
* update streaming messages in-place instead of accumulating duplicates ([457aa25](https://github.com/thedavidweng/strudel-tui/commit/457aa251a9fd84aafd1b417f0d6ee977a211b1ad))


### Refactoring

* code review cleanup — dead code, error handling, type safety, DRY ([#15](https://github.com/thedavidweng/strudel-tui/issues/15)) ([008e806](https://github.com/thedavidweng/strudel-tui/commit/008e8068e28d482299fb5656b5d0c511ae0fc2fc))
* consolidate pattern state into PatternOwner ([0f4cfad](https://github.com/thedavidweng/strudel-tui/commit/0f4cfad3233bd055c3a5815448cb47f6dabb3f07))
* extract ChatHistory from LLMAdapter ([d1818ab](https://github.com/thedavidweng/strudel-tui/commit/d1818ab577ae787d72eafad6ac2f9b12cee62cf7))
* extract SSEParser from OpenAIClient ([d1b9801](https://github.com/thedavidweng/strudel-tui/commit/d1b98018ead4a317874c722be44e83ed07fc202c))
* split StrudelEngineWrapper into PatternSyntax + Engine ([71b71be](https://github.com/thedavidweng/strudel-tui/commit/71b71be61cc970a2e7960d5dbc150004fb6cddda))


### Documentation

* add Diátaxis user guides (tutorial, how-tos, reference, explanation) ([7fad086](https://github.com/thedavidweng/strudel-tui/commit/7fad0868243660495f682adf50968da66412ed33))
* ADR-001 — pi-tui over Ink, decided on measured evidence ([0c1a7e7](https://github.com/thedavidweng/strudel-tui/commit/0c1a7e79a377a21f24ed529cf6ba08685f599a9a))

## [Unreleased]


### ✨ New Features

- Strudel-tui — terminal live coding for Strudel with AI agent
- Sidebar layout, GoReleaser full pipeline, Agent architecture refactor
- Slash command autocomplete menu
- Add /config and /provider slash commands
- Kimi-code inspired UX improvements
- Inline config wizard, direct commands, and UX improvements
- Add test pyramid, CI improvements, and E2E smoke tests

### 🐛 Bug Fixes

- Resolve CodeQL alert and CI test failures
- CI failures, add dependabot, pin Bun version, add type checking
- CI test failures, add oxlint, patch @kabelsalat/web ESM resolution
- All lint warnings, bump dependabot action versions
- TUI layout — pin input to bottom, narrow sidebar
- Sidebar width adapts proportionally to screen (28%, range 20-50 cols)
- Update streaming messages in-place instead of accumulating duplicates
- StatusBar overflow causing Pattern Editor overlap, add playback feedback

### 📦 Dependencies

- Upgrade to latest actions, add security scanning and dependency review
