# PatchLab

Interactive datacenter / CCNA-style trainer: **rack patching + VLANs/trunks + IP/gateway + NAT + firewall**, with instant visual feedback (PC + mobile browser).

**Live demo:** https://cozygarage.github.io/patchlab/

## Run

```bash
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5173`).

```bash
npm test         # engine unit tests
npm run test:e2e # Playwright (auto-starts Vite)
npm run build
npm run ci       # typecheck + unit + build
```

### CI / CD

GitHub Actions on every push/PR:

- **CI** — typecheck, Vitest, Playwright e2e, production build  
- **Deploy Pages** — publishes https://cozygarage.github.io/patchlab/ from `main`

See [docs/ci/README.md](docs/ci/README.md). Manual fallback: `npm run deploy:pages`.

## What you can do

- Choose **Easy** or **Standard** pace (Easy keeps tickets/coach tips open for learning)
- Realistic rack chassis: panel, fiber tray, ToR switch, SFP, firewall, servers, console station, PDU, ISP peer
- Plug data / fiber / power / console cords (tap-tap or drag); **Undo**, zoom/pan, cable history
- Side config panel + **CLI-lite** (`no shut`, `switchport`, `ip address`, `ping`, …)
- 32 missions + optional **transfer variants**; concept mastery map; incident-style challenge briefs
- Debrief path compare; sandbox **share URLs**; classroom codes (`PATCHLAB-LAB` / `PATCHLAB-SANDBOX`)
- PWA installable build; local analytics queue; progress export/import; glossary & sound

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision / MVP roots |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | Game loop, learning progression, campaign arcs, and implementation plan |
| [docs/MISSION_AUTHORING.md](docs/MISSION_AUTHORING.md) | Mode voice, anti-spoiler checklist, and mission authoring rules |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens & flows |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Historical MVP mission notes (see learningDesign for current catalog) |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack & phases |
