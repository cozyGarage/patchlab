# PatchLab — Mission Authoring

Short checklist for writing or revising campaign stages. Authoritative campaign order lives in `src/missions/learningDesign.ts` (`CAMPAIGN_MISSION_IDS`), not in each JSON file’s `order` field.

## Mode voice

| Mode | Player-facing brief | Impact line | Ticket details | Visible objectives |
|---|---|---|---|---|
| Guided | Exact values and steps | n/a | Optional; may repeat the recipe | Exact checklist |
| Practice | Outcome + limited ticket facts | n/a | Exact values OK | Broad objectives |
| Challenge | Symptoms only | Service impact (`learning.impact`) | Exact values (Easy opens these) | Outcome only |
| Boss | Incident story | Service impact (`learning.impact`) | Exact repair values only here / hints | Service outcomes |

**Campaign pace:** Easy may open ticket details and show coach tips. Standard must feel like real diagnosis — briefs, Impact, and objectives stay symptom/outcome-first. Never reuse `ticketDetails[0]` as the Impact line.

## Anti-spoiler checklist

For **practice / challenge / boss** (especially challenge and boss):

1. Brief, constraints, and `learning.impact` describe **symptoms and service impact**, not the fix.
2. Do **not** put goal port IDs, human port labels (`Gi1/0/1`, `A-01`, `OUT5`), CIDRs, ACL actions (`permit` / `deny`), next hops, or target host IPs in brief/constraints/impact/visible objectives when those values appear in `goals`.
3. Put exact repair values in `learning.ticketDetails` and the hint ladder (`prompt` → `evidence` → `action` → `solution`).
4. Visible objectives name outcomes (“restore WAN reachability”), not recipes (“set gateway 10.10.10.1”).
5. Challenge/boss stages must set a spoiler-free `learning.impact`.

Automated coverage: `src/missions/learningDesign.test.ts` fails if a challenge/boss player-facing surface contains goal literals or human recipe labels.

## Cadence (teach → practice → challenge → boss)

- Each stage introduces **at most one** concept (`conceptsIntroduced` length ≤ 1).
- The arc’s **first** stage owns the introduction; later challenge/boss stages should mostly use `conceptsPracticed`.
- Every introduced concept (except the campaign finale) must appear later in `conceptsPracticed`.
- Prefer ~6+ challenge stages with faultful initial state so Standard pace practices diagnosis.
- Bosses combine known skills; they should not be the first place a primary novelty appears when that can be avoided.

## Initial faults vs goals

- Prefer a **broken initial state** the player can observe (wrong gateway, poisoned route, ACL deny, admin-down port).
- Engine `goals` are hidden truth used for completion — not the player checklist.
- Pre-seed healthy layers when teaching layered diagnosis (e.g. ACL already open, route missing) so the brief does not disclose both faults.

## Transfers

- Aim for **one changed-value transfer** per arc after the intro/practice parent clears.
- Transfer briefs stay symptom-first; values live in Easy ticket details / hints.
- Definitions live in `src/lib/transferVariants.ts`.

## Files to touch

1. `src/missions/<id>.json` — topology, inventory, brief, constraints, goals, initial faults
2. `src/missions/learningDesign.ts` — mode, concepts, tools, objectives, ticket details, debrief, hints, campaign order
3. Tests — `learningDesign.test.ts`, engine fixtures, Playwright when flow/UI text changes

See also [GAME_DESIGN.md](./GAME_DESIGN.md) for arcs and the player loop.
