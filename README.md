# PatchLab

Interactive datacenter trainer: **rack patching + power/console + IP/subnet + firewall**, with instant visual feedback (PC + mobile browser).

Grounded in common structured-cabling practice (TIA-942 / BICSI habits: ToR + panel adjacency, power/data separation, labeling) and a CCNA-style lesson path (addressing → subnet ping → ACL/firewall).

## Run

```bash
cd prototype
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5173`).

```bash
npm test        # engine unit tests
npm run test:e2e # Playwright browser QA (dev server on :5173)
npm run build
```

## What you can do

- Realistic rack chassis: panel, fiber tray, ToR switch, SFP, **firewall**, servers, **console station**, **PDU**
- Plug **data / fiber / power / console** cords (tap-tap or drag)
- Side **config panel**: IPv4/subnet, ping, firewall permit rules
- **12 missions** from first lights → power → console/IP → subnet ping → firewall
- Glossary, sound toggle, hints, local progress

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision / MVP roots |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens & flows |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Mission catalog |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack & phases |
