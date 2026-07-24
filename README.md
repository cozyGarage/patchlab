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
npm run test:e2e # Playwright browser QA (dev server on :5173)
npm run build
```

## What you can do

- Realistic rack chassis: panel, fiber tray, ToR switch, SFP, firewall, servers, console station, PDU, ISP peer
- Plug data / fiber / power / console cords (tap-tap or drag)
- Side config panel: IPv4/gateway, switchport VLAN/mode, ping, firewall ACLs, static NAT
- 22 missions: copper/fiber → power/console → VLAN/trunk → gateway/NAT/ACL → addressing fixes → inter-VLAN → static routes
- Glossary, sound toggle, hints, local progress

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision / MVP roots |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens & flows |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Mission catalog |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack & phases |
