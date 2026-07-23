# PatchLab

Interactive trainer for **datacenter cable patching** with instant visual feedback (PC + mobile browser/PWA shell).

## Run the app

```bash
cd prototype
npm install
npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173`).

```bash
npm test      # engine unit tests
npm run build # production bundle to prototype/dist
```

## What you can do

- Home → mission brief → rack patching → star debrief
- **Tap-tap** or **drag** cables between ports
- Instant LED + tip feedback (VLAN, admin-down, media mismatch)
- **8 missions**: copper basics → fiber → dual-server bring-up
- Ghost **hints**, goal **path glow**, glossary, optional sound
- Sandbox (after M3): cycle VLANs / toggle admin, mix copper + fiber
- Progress in `localStorage`

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision, scope, principles, metrics |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens, flows, responsive rules |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents, link rules |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Missions 1–5 + sandbox |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack, folders, build phases |

## MVP in one line

One rack, copper only, five missions: first lights, wrong port, VLAN trap, admin down, change window.
