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
- 32 missions through floating statics, PAT overload, and traceroute
- Sandbox save/load + ticket presets; progress export/import; first-run tips
- Custom ACL, PAT, route AD, traceroute; glossary, sound, hard campaign gates

## Docs

| Doc | What it covers |
|---|---|
| [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md) | Vision / MVP roots |
| [docs/SCREEN_MAP.md](docs/SCREEN_MAP.md) | Screens & flows |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Ports, cables, intents |
| [docs/MVP_MISSIONS.md](docs/MVP_MISSIONS.md) | Mission catalog |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack & phases |
