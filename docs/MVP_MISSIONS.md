# PatchLab — MVP Missions

Five guided missions + sandbox. JSON sources live in `prototype/src/missions/`.

---

## Mission 1 — First Lights On

**Objective:** Bring SERVER-01 online by patching panel → switch → server.  
**Teaches:** Basic copper patching, reading port LEDs.  
**Par time:** 90s  

**Setup**
- Panel ports 1–8 empty
- Switch ports 1–8 admin up, VLAN 10
- SERVER-01 NIC expects VLAN 10
- Inventory: 4× blue Cat6

**Goals**
1. Link up: `panel-1` ↔ `sw-1`
2. Link up: `sw-5` ↔ `server-01-nic`
3. Path up: SERVER-01 → ToR

**Fail tips learners should see if wrong**
- Port busy / open circuit

**Win tip:** `Path up — SERVER-01 reaches ToR on VLAN 10`

---

## Mission 2 — Wrong Port, Right Intent

**Objective:** Ticket says patch SERVER-01 to panel port labeled `A-01`. Someone used `A-03`. Fix it.  
**Teaches:** Labels matter; move cables carefully.  
**Par time:** 75s  

**Setup**
- Pre-cabled: `panel-3` ↔ `sw-1`, `sw-5` ↔ `server-01-nic` (links up, but label goal fails)
- Correct documentation label for the circuit: panel port `A-01` (= `panel-1`)

**Goals**
1. `link_up` `panel-1` ↔ `sw-1`
2. `link_up` `sw-5` ↔ SERVER-01 NIC (keep server online)
3. `no_cables_on` leftover wrong panel port `panel-3`

---

## Mission 3 — VLAN Trap

**Objective:** SERVER-07 should be on VLAN 20. It is patched to a VLAN 10 port. Fix without moving the panel cross-connect.  
**Teaches:** VLAN mismatch vs physical open.  
**Par time:** 120s  
**Unlocks:** Sandbox  

**Setup**
- `panel-2` ↔ `sw-3` pre-cabled (unrelated cross-connect)
- `sw-7` is VLAN 20 admin up (empty)
- SERVER-07 currently on `sw-2` (VLAN 10) → amber / VLAN mismatch

**Goals**
1. `link_up` SERVER-07 ↔ `sw-7`
2. `path_up` SERVER-07 ↔ `sw-7`
3. `no_cables_on` `sw-2`

**Primary tip code:** `VLAN_MISMATCH`

---

## Mission 4 — Admin Down

**Objective:** Cable looks correct; link stays dark. Enable… wait — in MVP you don’t have CLI. Instead: move to a port that is admin up, or use the spare known-good port.  
**Teaches:** Admin down vs bad cable.  
**Par time:** 90s  

**Setup**
- Correct physical ports suggested in brief: `sw-4` is admin **down**, VLAN 10
- `sw-6` admin up, VLAN 10
- Panel `A-04` should land on working switch port

**Goals**
1. Path up SERVER-01
2. No cables attached to admin-down `sw-4`

**Tip:** `No link — switch port is admin down`

---

## Mission 5 — Change Window

**Objective:** Migrate SERVER-01 from old panel port to new one with ≤ 1 downtime moment.  
**Teaches:** Order of operations; cleanliness.  
**Par time:** 150s  

**Setup**
- Working cross-connect `panel-1` ↔ `sw-1`; SERVER-01 online on `sw-5`
- Target documentation: `panel-8` (`A-08`) ↔ `sw-8`

**Goals**
1. `link_up` `panel-8` ↔ `sw-8`
2. `link_up` `sw-5` ↔ SERVER-01 NIC (stay online)
3. `no_cables_on` old ports `panel-1` and `sw-1`

**Scoring twist:** Extra patch/unplug churn reduces cleanliness stars.

---

## Mission 6 — Fiber First Light

**Objective:** Patch OM4 fiber tray `F-01` to `Te1/0/1`.  
**Teaches:** Fiber LC vs copper; SFP cages.  
**Par time:** 90s

## Mission 7 — Wrong Media

**Objective:** Replace Cat6 mistakenly used on fiber ports; bring SERVER-09 up on fiber.  
**Teaches:** Media mismatch faults.  
**Par time:** 120s

## Mission 8 — Dual Server Bring-up

**Objective:** Bring SERVER-01 (VLAN 10) and SERVER-07 (VLAN 20) online with panel docs A-01/A-02.  
**Teaches:** Parallel circuits / mixed VLANs.  
**Par time:** 150s

## Mission 9 — Power the Rack

**Objective:** Power ToR + SERVER-01 from PDU, then restore data path.  
**Teaches:** Active gear is dark without PDU power.

## Mission 10 — Console & Mgmt IP

**Objective:** Console into ToR; set `10.10.10.2/24` on Gi1/0/1.  
**Teaches:** Out-of-band console + valid host addressing.

## Mission 11 — Same Subnet Ping

**Objective:** Address SERVER-01 and ping FW-EDGE on `10.10.10.0/24`.  
**Teaches:** Same-subnet reachability.

## Mission 12 — Firewall Permit

**Objective:** Insert permit ACL so LAN ping succeeds.  
**Teaches:** Top-down firewall policy / implicit deny.

## Mission 13 — Access VLAN Assign

**Objective:** Set Gi1/0/6 to VLAN 20, then patch SERVER-07.  
**Teaches:** Access VLAN assignment on a switchport.

## Mission 14 — VLAN Isolation

**Objective:** Address SERVER-01 (VLAN 10) and SERVER-07 (VLAN 20); prove ping fails.  
**Teaches:** VLANs isolate broadcast domains / L2 adjacency.

## Mission 15 — Default Gateway

**Objective:** Patch LAN + FW, set host IP with gateway, permit LAN→WAN, ping ISP-PEER.  
**Teaches:** Off-subnet reachability via default gateway.

## Mission 16 — Trunk Uplink

**Objective:** Set Gi1/0/8 to trunk and uplink to FW LAN0.  
**Teaches:** Trunk mode for multi-VLAN / uplink handoff.

## Mission 17 — Static NAT

**Objective:** Publish 10.10.10.10 as 203.0.113.10; permit WAN→LAN; ISP-PEER pings SERVER-01.  
**Teaches:** One-to-one static NAT for inbound reachability.

## Mission 18 — Deny One Host

**Objective:** Insert deny 10.10.10.20/32 → WAN above a broad permit; .20 fails, .10 succeeds.  
**Teaches:** ACL order — specific deny before general permit.

## Mission 19 — Broken Address

**Objective:** Fix SERVER-01 from 10.10.99.10/24 to 10.10.10.10/24; ping FW.  
**Teaches:** Same-subnet addressing (NetPractice-inspired, with live rack tips).

## Mission 20 — Mask Trap

**Objective:** Correct host prefix from /16 to /24; ping FW.  
**Teaches:** Address + mask must agree with the gateway interface.

## Mission 21 — Inter-VLAN Router

**Objective:** Patch dual FW LANs (VLAN 10 + 20), address both servers, ping across VLANs.  
**Teaches:** Router needs an interface in each VLAN.

## Mission 22 — Static Route

**Objective:** Route 198.51.100.0/24 via ISP-PEER, permit LAN→BRANCH, ping BRANCH-01.  
**Teaches:** Static routes for non-connected destinations (+ ACL).

## Mission 23 — No Shutdown

**Objective:** Keep A-04 ↔ Gi1/0/4 patched; Toggle admin on Gi1/0/4.  
**Teaches:** Admin-down vs bad cable — enable the port instead of moving it.

## Mission 24 — Wrong Gateway

**Objective:** Fix SERVER-01 gateway from 10.10.20.1 to 10.10.10.1; ping ISP-PEER.  
**Teaches:** Off-subnet reachability needs the correct default gateway.

## Mission 25 — Host Route

**Objective:** Override poisoned 198.51.100.10/32 via 10.10.10.10 with next hop 203.0.113.2.  
**Teaches:** Longest-prefix match — more-specific host routes win.

## Mission 26 — Deny to Branch

**Objective:** Deny 10.10.10.20/32 → BRANCH while SERVER-01 still reaches BRANCH-01.  
**Teaches:** Specific deny above a broader permit on a routed prefix.

## Mission 27 — Branch Exception

**Objective:** Console FW via TTY2; permit only 10.10.10.10/32 → 198.51.100.10/32.  
**Teaches:** Host exceptions above a broad deny; OOB console for ACL work.

## Mission 28 — Fiber No-Shut

**Objective:** Toggle admin on Te1/0/3 so prepatched F-03 lights.  
**Teaches:** Fiber admin-down recovery without moving strands.

## Mission 29 — Spare PDU

**Objective:** Power FW→OUT5 and SERVER-07→OUT6; ping recovers.  
**Teaches:** Spare outlet moves during maintenance.

## Mission 30 — Floating Static

**Objective:** Keep poisoned AD1 route; add AD10 via ISP-PEER; ping BRANCH.  
**Teaches:** Admin-distance failover when preferred next hop cannot deliver.

## Mission 31 — PAT Overload

**Objective:** Apply PAT 10.10.10.0/24 → 203.0.113.1; ping ISP-PEER.  
**Teaches:** Outbound PAT when the edge requires source translation.

## Mission 32 — Traceroute Path

**Objective:** Add route + permit, then Traceroute SERVER-01 → BRANCH-01.  
**Teaches:** Hop-by-hop path proof beyond a silent ping.

## Campaign gating

- **15 chapters** / 32 stages (pass-to-advance)
- Unlock next stage only with **≥5★** on the previous stage (of 9)
- Chapter borders also require **≥4★ on every stage** in the finished chapter
- Sandbox unlocks after **Stage 5** with the stage star gate met

## Sandbox

- Full rack: panel, fiber, ToR, SFP, firewall, servers, console, PDU, ISP peer, BRANCH
- Config panel: IP/gateway, switchport VLAN/mode, ping, firewall helpers, routes, static NAT
- Select copper switch port → **Cycle VLAN** / **Toggle admin**
- Inventory includes copper, fiber, power, console

---

## Mission JSON contract

Each file exports / contains:

```json
{
  "id": "m1-first-lights",
  "title": "First Lights On",
  "order": 1,
  "brief": "…",
  "constraints": ["Use Cat6 copper only"],
  "parTimeSec": 90,
  "hintAfterWrongAttempts": 2,
  "inventory": { "copper_cat6": 4 },
  "initial": { "devices": [], "cables": [] },
  "goals": []
}
```

Exact device graphs are in `src/missions/*.json`.
