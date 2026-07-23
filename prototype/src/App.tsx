import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Mission,
  PortRef,
  ProgressSave,
  Score,
  SettingsSave,
} from './types/schema';
import { missions, baseRack, getMission } from './missions';
import {
  createEngineState,
  reduce,
  type EngineState,
} from './engine/reducer';
import { scoreRun } from './engine/scoring';
import { loadProgress, recordMissionClear } from './lib/progress';
import { loadSettings, saveSettings } from './lib/settings';
import { playTipSound } from './lib/sound';
import { MissionList } from './ui/MissionList';
import { MissionBrief } from './ui/MissionBrief';
import { RackView } from './ui/RackView';
import { Debrief } from './ui/Debrief';
import { Glossary } from './ui/Glossary';

type Screen = 'home' | 'brief' | 'rack' | 'debrief';

const sandboxMission: Mission = {
  id: 'sandbox',
  title: 'Sandbox',
  order: 99,
  brief: 'Free play on the training rack. Cycle VLANs, toggle admin, mix copper and fiber.',
  constraints: ['Experiment freely', 'Reset anytime'],
  parTimeSec: 9999,
  hintAfterWrongAttempts: 99,
  inventory: { copper_cat6: 12, fiber_om4: 8 },
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

    // StrictMode runs effects twice in dev. We must not clearTimeout on cleanup,
    // or the only scheduled debrief is cancelled and never rescheduled.
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
        tip.code === 'LINK_UP' ||
        tip.code === 'MEDIA_MISMATCH' ||
        tip.code === 'VLAN_MISMATCH' ||
        tip.code === 'ADMIN_DOWN' ||
        tip.code === 'PORT_BUSY' ||
        tip.code === 'GOAL_COMPLETE'
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

  function dispatchReset() {
    if (!mission) return;
    startMission(mission, sandbox);
  }

  function toggleSound() {
    const next = { ...settings, sound: !settings.sound };
    setSettings(next);
    saveSettings(next);
  }

  const nextMission = useMemo(() => {
    if (!mission || mission.id === 'sandbox') return undefined;
    return missions.find((m) => m.order === mission.order + 1);
  }, [mission]);

  return (
    <div className="app-shell">
      {screen === 'home' ? (
        <MissionList
          missions={missions}
          progress={progress}
          settings={settings}
          onSelect={openBrief}
          onSandbox={() => startMission(sandboxMission, true)}
          onToggleSound={toggleSound}
          onOpenGlossary={() => setGlossaryOpen(true)}
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
          onBack={() => setScreen(sandbox ? 'home' : 'brief')}
        />
      ) : null}

      {screen === 'debrief' && mission && score ? (
        <Debrief
          mission={mission}
          score={score}
          tipHistory={tipHistory}
          onHome={() => setScreen('home')}
          onRetry={() => startMission(mission, false)}
          onNext={
            nextMission
              ? () => {
                  const m = getMission(nextMission.id);
                  if (m) openBrief(m);
                }
              : undefined
          }
          nextLabel={nextMission ? `Next: ${nextMission.title}` : undefined}
        />
      ) : null}

      <Glossary open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}
