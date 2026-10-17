# Publish a release

Release Please uses this repository's `GITHUB_TOKEN` to maintain its release PR
and create a tag/GitHub release after that PR is merged. In repository Settings →
Actions → General, enable **Allow GitHub Actions to create and approve pull
requests**; default workflow permissions can stay read-only because the workflow
requests its write permissions explicitly.

GitHub creates approval-required native PR workflow runs when `GITHUB_TOKEN`
opens or updates the release PR. A maintainer with write access must inspect the
PR and select **Approve workflows to run** in its merge box (or approve each
actual run with `gh api --method POST repos/thedavidweng/strudel-tui/actions/runs/RUN_ID/approve`).
Verify those runs belong to the current release PR head and pass before merging.
The existing PR draft, path filters and check concurrency rules remain in force.
See [GitHub's token trigger rules](https://docs.github.com/en/actions/concepts/security/github_token).

Tag pushes made with `GITHUB_TOKEN` still do not start push workflows. When
Release Please creates the release, it explicitly dispatches `release.yml` on
that tag. Release packages all five existing Bun targets, checksums, Sigstore
signatures and SBOMs.

For a failed packaging run, inspect that tag's release assets before retrying.
GoReleaser's `release.mode: append` only controls release notes; it does not
replace existing assets. If a partial upload left assets behind, list them with
`gh release view TAG --repo thedavidweng/strudel-tui --json assets` and remove the
assets from that failed attempt with
`gh release delete-asset TAG ASSET_NAME --repo thedavidweng/strudel-tui --yes`
for each exact asset name before rerunning packaging. Then rerun the failed run
or dispatch Release with the same existing tag. Do not remove assets from a
completed release or change the tag to retry a partial upload. See the
[GoReleaser release options](https://goreleaser.com/customization/publish/scm/).

The Homebrew tap owns cask updates: its scheduled **Sync Releases** workflow
reads public release assets and writes its own repository with its own
`GITHUB_TOKEN`, as it does for Apple Say. Strudel does not push to the tap and
needs neither `RELEASE_PLEASE_TOKEN` nor `HOMEBREW_TAP_GITHUB_TOKEN`. The first
Strudel cask must be added after real macOS release assets and their SHA-256
digests exist; never publish placeholder checksums. The release workflow does
not add Apple Developer ID signing or notarization to Bun binaries.
