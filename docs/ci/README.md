# CI / CD

Workflows live in [`.github/workflows/`](../../.github/workflows/).

| Workflow | Triggers | What it does |
|---|---|---|
| `ci.yml` | push / PR / manual | typecheck, unit tests, Playwright e2e, production build |
| `deploy-pages.yml` | push to `main` / manual | build Vite app → GitHub Pages |

## Local

```bash
npm ci
npm run typecheck
npm test
npm run test:e2e   # boots Vite via Playwright webServer
npm run build
```

## Manual Pages fallback

If Actions deploy is unavailable:

```bash
./scripts/deploy-pages.sh
```

## Pages source

Repo Settings → Pages → **GitHub Actions** (not `gh-pages` branch) once `deploy-pages.yml` has run successfully.
