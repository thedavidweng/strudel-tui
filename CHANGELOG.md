# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

