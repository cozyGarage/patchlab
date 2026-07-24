# CI / Pages templates

GitHub OAuth tokens without the `workflow` scope cannot push `.github/workflows/*`.

To enable Actions:

1. Copy these files into `.github/workflows/` locally with a PAT that includes `workflow`.
2. Or paste them in the GitHub UI under Actions → New workflow.

| Template | Purpose |
|---|---|
| [ci.yml](./ci.yml) | typecheck, unit, Playwright |
| [deploy-pages.yml](./deploy-pages.yml) | build + GitHub Pages |

Until then, use `scripts/deploy-pages.sh` after merging to `main`.
