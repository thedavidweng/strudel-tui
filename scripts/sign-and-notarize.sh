#!/bin/bash
set -euo pipefail

# GoReleaser runs this hook for all five targets; only Darwin uses Apple signing.
case "${1:?provide the target OS}" in
  linux|windows) exit 0 ;;
  darwin) ;;
  *) echo 'error: unsupported release OS' >&2; exit 1 ;;
esac
artifact="${2:?provide the compiled binary}"
: "${APPLE_SIGNING_IDENTITY:?}" "${APPLE_SIGNING_KEYCHAIN:?}" "${APPLE_TEAM_ID:?}"
: "${APPLE_API_KEY_PATH:?}" "${APPLE_API_KEY_ID:?}" "${APPLE_API_ISSUER:?}"
case "$APPLE_SIGNING_IDENTITY" in
  "Developer ID Application: "*) ;;
  *) echo 'error: release requires a Developer ID Application identity' >&2; exit 1 ;;
esac

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
codesign --force --timestamp --options runtime \
  --entitlements "$script_dir/bun-entitlements.plist" \
  --sign "$APPLE_SIGNING_IDENTITY" --keychain "$APPLE_SIGNING_KEYCHAIN" "$artifact"
codesign --verify --strict --verbose=2 "$artifact"
codesign --display --verbose=4 "$artifact" 2>&1 | grep -Fx "TeamIdentifier=$APPLE_TEAM_ID"

ditto -c -k --keepParent "$artifact" "$work_dir/binary.zip"
xcrun notarytool submit "$work_dir/binary.zip" \
  --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" \
  --wait --timeout 30m --output-format json > "$work_dir/result.json"
cat "$work_dir/result.json"
jq -e '.status == "Accepted"' "$work_dir/result.json" > /dev/null
# Standalone executables cannot be stapled. This is Homebrew's binary audit gate.
codesign --verify -R=notarized --check-notarization "$artifact"
