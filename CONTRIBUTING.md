# Contributing

## Branches

- `main` — production-ready. Protected; PRs only.
- `develop` — integration branch. Protected; PRs only.
- `feature/<ticket>-short-name`, `bugfix/<ticket>-short-name` — branch from `develop`.
- `hotfix/<ticket>-short-name` — branch from `main`, merge to both `main` and `develop`.

## Workflow

1. `git checkout develop && git pull`
2. `git checkout -b feature/SF-123-short-name`
3. Make small commits using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat: add transfer validation`, `fix: handle missing warehouse`, `chore: bump deps`
4. Run `npm run lint` and `npm run format` before pushing.
5. Push and open a PR into `develop`. Fill in the PR template.
6. Get at least 1 approval and a green CI run, then squash-merge.

## Rules

- Never commit `.env` or any secrets. Add new variables to `.env.example` with fake values.
- Do not push directly to `main` or `develop`.
- Keep PRs small and focused.
