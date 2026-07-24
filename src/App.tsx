import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Mission,
  PortRef,
  ProgressSave,
  Score,
  SettingsSave,
} from './types/schema';
import { missions, baseRack, getMission } from './missions';
import { isMissionUnlocked } from './lib/progress';
import {
  createEngineState,
  reduce,
  type EngineState,
} from './engine/reducer';
import { scoreRun } from './engine/scoring';
import {
  exportProgress,
  importProgress,
  loadProgress,
  recordMissionClear,
  resetProgress,
} from './lib/progress';
import { loadSettings, saveSettings } from './lib/settings';
import { playTipSound } from './lib/sound';
import {
  SANDBOX_PRESETS,
  loadSandboxSnapshot,
  saveSandboxSnapshot,
} from './lib/sandboxLab';
import { MissionList } from './ui/MissionList';
import { MissionBrief } from './ui/MissionBrief';
import { RackView } from './ui/RackView';
import { Debrief } from './ui/Debrief';
import { Glossary } from './ui/Glossary';
import { Onboarding } from './ui/Onboarding';

type Screen = 'home' | 'brief' | 'rack' | 'debrief';

const sandboxMission: Mission = {
  id: 'sandbox',
  title: 'Sandbox',
  order: 99,
  brief:
    'Free play: power, console, copper/fiber, VLANs, trunks, IP, NAT, ping, and firewall rules.',
  constraints: ['Experiment freely', 'Reset anytime'],
  parTimeSec: 9999,
  hintAfterWrongAttempts: 99,
  inventory: {
    copper_cat6: 12,
    fiber_om4: 8,
    power_c13: 6,
    console_rj45: 4,
  },
  initial: { devices: [], cables: [] },
  goals: [],
  track: 'mixed',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [progress, setProgress] = useState<ProgressSave>(() => loadProgress());
  const [settings, setSettings] = useState<SettingsSave>(() => loadSettings());
  const [mission, setMission] = useState<Mission | null>(null);
  const [engine, setEngine] = useState<EngineState | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [tipHistory, setTipHistory] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sandbox, setSandbox] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [coachStep, setCoachStep] = useState(0);
  const [coachOpen, setCoachOpen] = useState(
    () => !loadSettings().onboardingDone,
  );
  const [progressNotice, setProgressNotice] = useState<{
    level: 'ok' | 'bad';
    message: string;
  } | null>(null);
  const lastTipCode = useRef<string | undefined>(undefined);
  const completedRunKey = useRef<string | null>(null);

  useEffect(() => {
    if (screen !== 'rack' || !engine || sandbox) return;
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - engine.startedAtMs) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [screen, engine, sandbox]);

  useEffect(() => {
    if (!engine || sandbox || screen !== 'rack') return;
    if (!engine.snapshot.complete) return;

    const runKey = `${mission?.id ?? 'none'}:${engine.startedAtMs}`;
    if (completedRunKey.current === runKey) return;
    completedRunKey.current = runKey;

    const result = scoreRun(engine);
    setScore(result);
    if (mission && mission.id !== 'sandbox') {
      setProgress(recordMissionClear(mission.id, result));
    }
    playTipSound(settings.sound, 'success');
    window.setTimeout(() => {
      setScreen((current) => (current === 'rack' ? 'debrief' : current));
    }, 450);
  }, [engine, sandbox, screen, mission, settings.sound]);

  function trackTip(next: EngineState) {
    const tip = next.snapshot.lastTip;
    const msg = tip?.message;
    if (msg) {
      setTipHistory((prev) =>
        prev[prev.length - 1] === msg ? prev : [...prev, msg].slice(-8),
      );
    }
    if (tip && tip.code !== lastTipCode.current) {
      lastTipCode.current = tip.code;
      if (
        [
          'LINK_UP',
          'MEDIA_MISMATCH',
          'VLAN_MISMATCH',
          'ADMIN_DOWN',
          'PORT_BUSY',
          'GOAL_COMPLETE',
          'NO_POWER',
          'PING_OK',
          'PING_FAIL',
          'IP_UPDATED',
          'FIREWALL_UPDATED',
          'NAT_UPDATED',
          'ROUTE_UPDATED',
          'TRACEROUTE_OK',
          'TRACEROUTE_FAIL',
        ].includes(tip.code)
      ) {
        playTipSound(settings.sound, tip.level);
      }
    }
  }

  function openBrief(m: Mission) {
    setSandbox(false);
    setMission(m);
    setScore(null);
    setTipHistory([]);
    setElapsedSec(0);
    setScreen('brief');
  }

  function startMission(m: Mission, isSandbox = false) {
    const state = createEngineState(m, baseRack);
    setMission(m);
    setEngine(state);
    setSandbox(isSandbox);
    setScore(null);
    setTipHistory([]);
    setElapsedSec(0);
    setScreen('rack');
    lastTipCode.current = undefined;
    completedRunKey.current = null;
    trackTip(state);
  }

  function apply(next: EngineState) {
    setEngine(next);
    trackTip(next);
  }

  function dispatchConnect(a: PortRef, b: PortRef) {
    if (!engine) return;
    apply(reduce(engine, { type: 'CONNECT', a, b }));
  }

  function dispatchDisconnect(port: PortRef) {
    if (!engine) return;
    apply(reduce(engine, { type: 'DISCONNECT_PORT', port }));
  }

  function dispatchHint() {
    if (!engine) return;
    apply(reduce(engine, { type: 'REQUEST_HINT' }));
  }

  function dispatchCycleVlan(port: PortRef) {
    if (!engine) return;
    apply(reduce(engine, { type: 'CYCLE_VLAN', port }));
  }

  function dispatchToggleAdmin(port: PortRef) {
    if (!engine) return;
    apply(reduce(engine, { type: 'TOGGLE_ADMIN', port }));
  }

  function dispatchSetIp(
    port: PortRef,
    address: string,
    prefix: number,
    gateway?: string,
  ) {
    if (!engine) return;
    apply(reduce(engine, { type: 'SET_IP', port, address, prefix, gateway }));
  }

  function dispatchFirewallPermitLan() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `permit-lan-${Date.now()}`,
          action: 'permit',
          srcCidr: '10.10.10.0/24',
          dstCidr: '10.10.10.0/24',
          note: 'Trainer permit',
          enabled: true,
        },
      }),
    );
  }

  function dispatchFirewallPermitLanWan() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `permit-lan-wan-${Date.now()}`,
          action: 'permit',
          srcCidr: '10.10.10.0/24',
          dstCidr: '203.0.113.0/30',
          note: 'LAN → WAN',
          enabled: true,
        },
      }),
    );
  }

  function dispatchFirewallPermitWanLan() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `permit-wan-lan-${Date.now()}`,
          action: 'permit',
          srcCidr: '203.0.113.0/30',
          dstCidr: '10.10.10.0/24',
          note: 'WAN → LAN',
          enabled: true,
        },
      }),
    );
  }

  function dispatchFirewallDenyHost() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `deny-host-20-${Date.now()}`,
          action: 'deny',
          srcCidr: '10.10.10.20/32',
          dstCidr: '203.0.113.0/30',
          note: 'Deny SERVER-07 to WAN',
          enabled: true,
        },
      }),
    );
  }

  function dispatchFirewallDenyHostBranch() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `deny-host-branch-${Date.now()}`,
          action: 'deny',
          srcCidr: '10.10.10.20/32',
          dstCidr: '198.51.100.0/24',
          note: 'Deny SERVER-07 to BRANCH',
          enabled: true,
        },
      }),
    );
  }

  function dispatchFirewallCustomRule(
    action: 'permit' | 'deny',
    srcCidr: string,
    dstCidr: string,
  ) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `custom-${action}-${Date.now()}`,
          action,
          srcCidr: srcCidr.trim(),
          dstCidr: dstCidr.trim(),
          note: 'Custom ACL',
          enabled: true,
        },
      }),
    );
  }

  function dispatchSetNat(insideIp: string, outsideIp: string) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'SET_NAT',
        deviceId: 'fw-1',
        insideIp,
        outsideIp,
      }),
    );
  }

  function dispatchSetRoute(
    destCidr: string,
    nextHop: string,
    adminDistance?: number,
  ) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'SET_ROUTE',
        deviceId: 'fw-1',
        destCidr,
        nextHop,
        adminDistance,
      }),
    );
  }

  function dispatchSetPat(insideCidr: string, outsideIp: string) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'SET_PAT',
        deviceId: 'fw-1',
        insideCidr,
        outsideIp,
      }),
    );
  }

  function dispatchFirewallPermitBranch() {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'UPSERT_FIREWALL_RULE',
        deviceId: 'fw-1',
        rule: {
          id: `permit-branch-${Date.now()}`,
          action: 'permit',
          srcCidr: '10.10.10.0/24',
          dstCidr: '198.51.100.0/24',
          note: 'LAN → BRANCH',
          enabled: true,
        },
      }),
    );
  }

  function dispatchSetVlan(port: PortRef, vlanId: number) {
    if (!engine) return;
    apply(reduce(engine, { type: 'SET_VLAN', port, vlanId }));
  }

  function dispatchSetPortMode(
    port: PortRef,
    mode: 'access' | 'trunk',
  ) {
    if (!engine) return;
    apply(reduce(engine, { type: 'SET_PORT_MODE', port, mode }));
  }

  function dispatchPing(fromId: string, toId: string) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'PING',
        fromDeviceId: fromId,
        toDeviceId: toId,
      }),
    );
  }

  function dispatchTraceroute(fromId: string, toId: string) {
    if (!engine) return;
    apply(
      reduce(engine, {
        type: 'TRACEROUTE',
        fromDeviceId: fromId,
        toDeviceId: toId,
      }),
    );
  }

  function dispatchReset() {
    if (!mission) return;
    startMission(mission, sandbox);
  }

  function finishOnboarding() {
    const next = { ...settings, onboardingDone: true };
    setSettings(next);
    saveSettings(next);
    setCoachOpen(false);
  }

  function toggleSound() {
    const next = { ...settings, sound: !settings.sound };
    setSettings(next);
    saveSettings(next);
  }

  function handleExportProgress() {
    const blob = new Blob([exportProgress(progress)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patchlab-progress.json';
    a.click();
    URL.revokeObjectURL(url);
    setProgressNotice({
      level: 'ok',
      message: 'Progress exported as patchlab-progress.json',
    });
  }

  function handleImportProgress(raw: string) {
    const result = importProgress(raw);
    if (!result.ok) {
      setProgressNotice({
        level: 'bad',
        message: `Import failed — ${result.reason}`,
      });
      return;
    }
    setProgress(result.progress);
    setProgressNotice({
      level: 'ok',
      message: `Imported ${result.progress.clearedMissionIds.length} cleared stage(s)`,
    });
  }

  function handleResetProgress() {
    if (
      !window.confirm(
        'Reset all campaign progress? This cannot be undone (export first if you care).',
      )
    ) {
      return;
    }
    setProgress(resetProgress());
    setProgressNotice({
      level: 'ok',
      message: 'Campaign progress reset',
    });
  }

  function handleSandboxSave() {
    if (!engine) return;
    saveSandboxSnapshot(engine.snapshot.rack, engine.snapshot.inventory);
    apply({
      ...engine,
      snapshot: {
        ...engine.snapshot,
        lastTip: {
          level: 'success',
          code: 'SANDBOX_SAVED',
          message: 'Sandbox rack saved in this browser',
        },
      },
    });
  }

  function handleSandboxLoad() {
    if (!engine) return;
    const snap = loadSandboxSnapshot();
    if (!snap) {
      apply({
        ...engine,
        snapshot: {
          ...engine.snapshot,
          lastTip: {
            level: 'warn',
            code: 'SANDBOX_SAVED',
            message: 'No sandbox save found yet',
          },
        },
      });
      return;
    }
    apply(
      reduce(engine, {
        type: 'LOAD_RACK',
        rack: snap.rack,
        inventory: snap.inventory,
      }),
    );
  }

  function handleSandboxPreset(presetId: string) {
    if (!engine) return;
    const preset = SANDBOX_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const built = preset.build();
    apply(
      reduce(engine, {
        type: 'LOAD_RACK',
        rack: built.rack,
        inventory: built.inventory,
      }),
    );
  }

  const nextMission = useMemo(() => {
    if (!mission || mission.id === 'sandbox') return undefined;
    return missions.find((m) => m.order === mission.order + 1);
  }, [mission]);

  return (
    <div className="app-shell wide">
      <Onboarding
        open={coachOpen && screen === 'home'}
        step={coachStep}
        onNext={() => {
          if (coachStep >= 2) finishOnboarding();
          else setCoachStep((s) => s + 1);
        }}
        onSkip={finishOnboarding}
      />

      {screen === 'home' ? (
        <MissionList
          missions={missions}
          progress={progress}
          settings={settings}
          progressNotice={progressNotice}
          onSelect={openBrief}
          onSandbox={() => startMission(sandboxMission, true)}
          onToggleSound={toggleSound}
          onOpenGlossary={() => setGlossaryOpen(true)}
          onExportProgress={handleExportProgress}
          onImportProgress={handleImportProgress}
          onResetProgress={handleResetProgress}
          onReplayOnboarding={() => {
            setCoachStep(0);
            setCoachOpen(true);
          }}
        />
      ) : null}

      {screen === 'brief' && mission ? (
        <MissionBrief
          mission={mission}
          onBack={() => setScreen('home')}
          onStart={() => startMission(mission, false)}
        />
      ) : null}

      {screen === 'rack' && engine ? (
        <RackView
          state={engine}
          sandbox={sandbox}
          elapsedSec={elapsedSec}
          onConnect={dispatchConnect}
          onDisconnectPort={dispatchDisconnect}
          onHint={dispatchHint}
          onReset={dispatchReset}
          onCycleVlan={dispatchCycleVlan}
          onToggleAdmin={dispatchToggleAdmin}
          onSetIp={dispatchSetIp}
          onFirewallPermitLan={dispatchFirewallPermitLan}
          onFirewallPermitLanWan={dispatchFirewallPermitLanWan}
          onFirewallPermitWanLan={dispatchFirewallPermitWanLan}
          onFirewallDenyHost={dispatchFirewallDenyHost}
          onFirewallDenyHostBranch={dispatchFirewallDenyHostBranch}
          onFirewallCustomRule={dispatchFirewallCustomRule}
          onSetNat={dispatchSetNat}
          onSetPat={dispatchSetPat}
          onSetRoute={dispatchSetRoute}
          onFirewallPermitBranch={dispatchFirewallPermitBranch}
          onSetVlan={dispatchSetVlan}
          onSetPortMode={dispatchSetPortMode}
          onPing={dispatchPing}
          onTraceroute={dispatchTraceroute}
          onSandboxSave={sandbox ? handleSandboxSave : undefined}
          onSandboxLoad={sandbox ? handleSandboxLoad : undefined}
          onSandboxPreset={sandbox ? handleSandboxPreset : undefined}
          sandboxPresets={
            sandbox
              ? SANDBOX_PRESETS.map((p) => ({ id: p.id, title: p.title }))
              : undefined
          }
          onBack={() => setScreen(sandbox ? 'home' : 'brief')}
        />
      ) : null}

      {screen === 'debrief' && mission && score ? (
        <Debrief
          mission={mission}
          score={score}
          progress={progress}
          tipHistory={tipHistory}
          onHome={() => setScreen('home')}
          onRetry={() => startMission(mission, false)}
          onNext={
            nextMission && isMissionUnlocked(nextMission.order, progress)
              ? () => {
                  const m = getMission(nextMission.id);
                  if (m) openBrief(m);
                }
              : undefined
          }
          nextLabel={
            nextMission
              ? `Next: Stage ${nextMission.order} — ${nextMission.title}`
              : undefined
          }
        />
      ) : null}

      <Glossary open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}
