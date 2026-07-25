# PatchLab — Product Brief (MVP)

**Working title:** PatchLab  
**Tagline:** Learn datacenter patching with instant visual feedback.  
**Platform:** Web PWA (desktop + mobile)  
**Audience (MVP):** Junior techs, networking students, first-week DC onboarding  
**Core loop:** Patch ports → see link truth instantly → fix or complete mission

---

## 1. Vision

PatchLab is a short-session, game-like simulator for **physical and logical cabling** in a datacenter rack — not a full Cisco IOS emulator.

Learners practice:
- Copper patching (panel ↔ switch ↔ server)
- Port selection and documentation/label matching
- Diagnosing common “why is this down?” mistakes

Every connect/disconnect updates LEDs, path highlights, and a one-line tip in under 100ms.

---

## 2. Problem & opportunity

| Existing tools | Gap |
|---|---|
| Packet Tracer / NetSim / NetPilot | Strong on config & protocols; weak on physical patching muscle memory |
| Interplay-style VR | Strong immersion for power/cooling; heavy for quick mobile practice |
| Real cable testers | Hardware validation, not guided learning |

**Wedge:** “Duolingo for datacenter patching” — 3–7 minute missions, mobile-friendly, instant consequence.

---

## 3. MVP scope (must ship)

**In**
- One isometric rack scene: patch panel (8 ports) + ToR switch (8 ports) + 2 servers (1 NIC each)
- Copper Cat6 only (RJ45)
- Connect by drag (desktop) or tap-A → tap-B (mobile)
- Instant L1 link state + simple L2 adjacency (same VLAN = up)
- 5 guided missions + 1 sandbox
- Stars: correctness / speed / cleanliness (no unused dangling ends)
- Offline-capable PWA shell

**Out (post-MVP)**
- Fiber polarity, MPO breakouts, DAC/AOC
- Full CLI / routing protocols
- Multi-rack halls, VR/WebXR
- Multiplayer, LMS gradebook, accounts beyond local progress

---

## 4. Learning principles

1. **Action → truth → tip** — never a wall of text before doing
2. **One job per screen** — mission brief OR rack work OR debrief
3. **Fail clearly** — red path + short reason (`Wrong VLAN`, `Label mismatch`, `Open circuit`)
4. **Graduated hints** available voluntarily: prompt → evidence → action → exact solution
5. **Completion unlocks learning** — stars and help use never block the next lesson
6. **Sandbox unlocked** after the first boss at Mission 3

---

## 5. Success metrics (MVP validation)

- Time-to-first-successful-patch &lt; 60s for new users
- Mission 1 completion rate &gt; 80%
- Median session length 8–15 minutes
- Mobile landscape usable without pinch-zoom for Mission 1–2
- Learners can explain *why* a link is down after Mission 5

---

## 6. Product surfaces

See [SCREEN_MAP.md](./SCREEN_MAP.md) for full navigation and wireframe logic.

Primary screens:
1. Home / Mission list  
2. Mission brief  
3. Rack simulator (core)  
4. Debrief / stars  
5. Sandbox  
6. Glossary (optional drawer)

---

## 7. Simulation fidelity (MVP)

**Simulate**
- Port occupancy, media type (copper), cable endpoints
- Admin up/down, VLAN id on switch ports
- End-to-end path: device A → cable → device B
- Label string equality checks for documentation missions

**Do not simulate yet**
- Autonegotiation edge cases, PoE, CRC/errors
- Spanning tree, LACP, routing
- Real optics inventories

Engine is a deterministic TypeScript state machine. UI only renders engine snapshots.

---

## 8. Monetization / distribution (later)

MVP is free learning prototype. Later options: org licenses for DC onboarding, classroom packs, advanced fiber DLC. Not required for first vertical slice.

---

## 9. Open decisions (locked for MVP)

| Decision | MVP choice |
|---|---|
| Audience | Juniors + students |
| Depth | Physical copper + basic VLAN adjacency |
| Fidelity | Clear teaching sim (not photoreal) |
| Delivery | Web PWA first |
| Art | 2.5D isometric rack, not VR |

---

## 10. Related docs

- [SCREEN_MAP.md](./SCREEN_MAP.md) — screens & flows  
- [DATA_MODEL.md](./DATA_MODEL.md) — ports, cables, graph engine  
- [MVP_MISSIONS.md](./MVP_MISSIONS.md) — 5 missions + sandbox  
- [TECH_STACK.md](./TECH_STACK.md) — stack, folders, build plan  

Prototype code lives under `/prototype`.
