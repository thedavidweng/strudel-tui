# Contributing

Thanks for your interest in contributing.

## Getting Started

```bash
git clone https://github.com/thedavidweng/strudel-tui.git
cd strudel-tui
mise install  # install tools pinned in mise.toml
bun install
```

## Development

```bash
# Run in development mode
bun run src/index.ts

# Build standalone binary
bun build --compile src/index.ts --outfile dist/<binary>

# Run tests
bun test

# Lint and typecheck
bun run lint
bun run typecheck
```

## Pull Requests

1. Fork the repository and create a feature branch.
2. Make your changes with tests if applicable.
3. Run lint and tests before committing.
4. Open a pull request against `main`.

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` maintenance task
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
