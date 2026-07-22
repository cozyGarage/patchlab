# PatchLab

Interactive learning concept for **datacenter cable patching** with instant visual feedback (PC + mobile PWA).

This workspace contains the **MVP product brief** and a **runnable simulation engine** (TypeScript) with five mission scenarios. Full React rack UI is the next build phase.

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision, scope, principles, metrics |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens, flows, responsive rules |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents, link rules |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Missions 1–5 + sandbox |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack, folders, build phases |

## Prototype engine

```bash
cd prototype
npm install
npm test
npm run typecheck
```

Core loop: mission JSON → `createEngineState` → `reduce(CONNECT|DISCONNECT|…)` → snapshot with LEDs, tips, goals.

## MVP in one line

One rack, copper only, five missions: first lights, wrong port, VLAN trap, admin down, change window.
