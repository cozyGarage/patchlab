# PatchLab — Roadmap

Living plan after the level-design and anti-spoiler passes (#12, #13). Campaign length stays near **32 required stages**; growth prefers transfers and a few thin-arc fillers over a long linear campaign.

## Shipped foundation

- 10 arcs / 32 stages, Easy vs Standard pace
- Symptom-first challenge/boss briefs + spoiler-free `learning.impact`
- Concept mastery map, transfer variants, CLI-lite, undo, PWA, classroom codes
- Anti-spoiler / concept-revisit automated checks

## R0 — Doc truth

Keep product docs aligned with the shipped trainer (not the 5-mission MVP).

- [x] This roadmap
- [x] `PRODUCT_BRIEF.md` current-scope refresh
- [x] `GAME_DESIGN.md` arc mode table + phase section → this file
- [x] Authoring note: campaign order is `CAMPAIGN_MISSION_IDS`, not JSON `order` ([MISSION_AUTHORING.md](./MISSION_AUTHORING.md))

## R1 — Cadence completion (current)

Finish teach → practice → challenge → boss without a large mission count increase.

1. [x] Transfers for missing arcs (fiber/power, admin-down) and thin arcs (trunk, static NAT)
2. [x] Metadata fixes so bosses practice ≥2 previously introduced concepts
3. [x] Extend `learningDesign.test.ts` toward GAME_DESIGN §6 rules
4. [ ] Later if still thin: add at most a few practice stages for trunk/NAT/PAT (keep total ≤ ~36)

**Success:** every arc has a transfer parent; Standard mid-campaign has diagnosis practice; cadence tests fail on regressions.

## R2 — Diagnosis depth

- Multi-layer incidents beyond m32 (route vs ACL vs gateway)
- Stronger traceroute / path-compare in debriefs
- Prediction → evidence → fix counting toward Independent
- Transfer footguns (e.g. floating-static AD defaults)

## R3 — Replay & parameterization

- Parameterize ports / VLANs / CIDRs / ACL hosts / next hops
- Daily Incident + generated transfers from validated templates
- Adaptive review from concept mastery
- Extend share URLs to generated tickets

## R4 — Classroom

- Instructor summary export (concepts + hint depth — not speed-as-mastery)
- Class pack: fixed seed + progress import/export polish
- Assignment links for mission/transfer sets

## Out of scope (for now)

Full CLI / routing protocols, multi-rack / VR, accounts / LMS, visual redesign, unbounded campaign growth.

## Sequencing

```text
R0 docs → R1 cadence → R2 diagnosis depth → R3 replay → R4 classroom
```

Do R1 before R3: parameterized tickets on thin NAT/trunk arcs only multiply weak teaching.

See also [GAME_DESIGN.md](./GAME_DESIGN.md) and [MISSION_AUTHORING.md](./MISSION_AUTHORING.md).
