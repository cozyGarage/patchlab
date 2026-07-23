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

## Sandbox

- Same rack devices as missions (copper panel, fiber tray, ToR copper + SFP, 3 servers)
- Select a copper switch port → **Cycle VLAN** / **Toggle admin**
- No goals; reset button
- Copper + fiber inventory for free play

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

Exact device graphs are in `prototype/src/missions/*.json`.
