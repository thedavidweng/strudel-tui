# Publish a release

Release Please uses this repository's `GITHUB_TOKEN` to maintain its release PR
and create a tag/GitHub release after that PR is merged. In repository Settings →
Actions → General, enable **Allow GitHub Actions to create and approve pull
requests**; default workflow permissions can stay read-only because the workflow
requests its write permissions explicitly.

Events produced by `GITHUB_TOKEN` do not start ordinary PR/tag workflows. Release
Please therefore explicitly dispatches CI, smoke tests, CodeQL and workflow lint
on the release PR's head branch. CI receives the PR's base commit for dependency
review. The PR number shares the usual check concurrency group, so converting the
PR to a draft cancels its checks; drafts are not dispatched. Check each run's
head SHA against the release PR before merging it.

When Release Please creates the release, it dispatches `release.yml` on that tag.
Release packages all five existing Bun targets, checksums, Sigstore signatures
and SBOMs. For a failed packaging run, rerun that run or dispatch Release with the
same existing tag; do not create a replacement version just to retry packaging.

The Homebrew tap owns cask updates: its scheduled **Sync Releases** workflow
reads public release assets and writes its own repository with its own
`GITHUB_TOKEN`, as it does for Apple Say. Strudel does not push to the tap and
needs neither `RELEASE_PLEASE_TOKEN` nor `HOMEBREW_TAP_GITHUB_TOKEN`. The first
Strudel cask must be added after real macOS release assets and their SHA-256
digests exist; never publish placeholder checksums. The release workflow does
not add Apple Developer ID signing or notarization to Bun binaries.
