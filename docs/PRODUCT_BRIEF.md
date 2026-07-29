# PatchLab — Product Brief

**Working title:** PatchLab  
**Tagline:** Rack. Power. VLAN. Route. Firewall — with instant evidence.  
**Platform:** Web PWA (desktop + mobile)  
**Live:** https://cozygarage.github.io/patchlab/  
**Audience:** Junior techs, networking students, first-week DC / CCNA-style onboarding  
**Core loop:** Receive a ticket → patch or configure → read link/ping/traceroute evidence → debrief

---

## 1. Vision

PatchLab is a short-session troubleshooting trainer for **datacenter rack work and foundational L2/L3/security skills** — not a full Cisco IOS emulator.

Learners practice copper and fiber patching, power, console, VLANs/trunks, IPv4, ACLs, NAT/PAT, static routes, and layered diagnosis with traceroute.

---

## 2. Current product (post-MVP)

**In**
- 32 campaign stages across 10 operational arcs (`src/missions/learningDesign.ts`)
- Easy vs Standard campaign pace
- Optional transfer variants after cleared parents
- Concept mastery map, graduated hints, mission debriefs
- Sandbox + shareable lab URLs + classroom codes
- Offline-capable PWA; local progress export/import

**Out (for now)**
- Full CLI / dynamic routing protocols
- Multi-rack halls, VR/WebXR
- Accounts, cloud sync, LMS gradebook

Roadmap: [ROADMAP.md](./ROADMAP.md)

---

## 3. Problem & opportunity

| Existing tools | Gap |
|---|---|
| Packet Tracer / NetSim | Strong on config; weak on physical patching + short mobile sessions |
| VR DC trainers | Immersive but heavy for 3–7 minute drills |
| Real cable testers | Hardware validation, not guided curriculum |

**Wedge:** Duolingo-length tickets with rack-truth feedback and CCNA-relevant diagnosis.

---

## 4. Learning principles

1. **Action → truth → tip** — never a wall of text before doing  
2. **One novelty per stage** — teach → practice → challenge → boss  
3. **Fail clearly** — LEDs, ping/traceroute, and short causal tips  
4. **Graduated hints** never block progression  
5. **Completion unlocks learning** — stars are optional recognition  
6. **Standard pace diagnoses from symptoms**; Easy may open ticket details  

Authoring rules: [MISSION_AUTHORING.md](./MISSION_AUTHORING.md)

---

## 5. Success metrics

- Time-to-first-successful-patch &lt; 60s for new users  
- Mission 1 completion rate &gt; 80%  
- Median session 8–15 minutes  
- Challenge/boss clearable on Standard without recipe briefs  
- Learners can explain *why* after debrief reflection  

---

## 6. Related docs

- [GAME_DESIGN.md](./GAME_DESIGN.md) — arcs, loop, acceptance criteria  
- [ROADMAP.md](./ROADMAP.md) — R0–R4 plan  
- [MISSION_AUTHORING.md](./MISSION_AUTHORING.md) — anti-spoiler / mode voice  
- [SCREEN_MAP.md](./SCREEN_MAP.md) — screens & flows  
- [DATA_MODEL.md](./DATA_MODEL.md) — ports, cables, intents  
- [TECH_STACK.md](./TECH_STACK.md) — stack & build  
