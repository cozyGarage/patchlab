import { useEffect, useMemo, useState } from 'react';
import type { Mission, PortRef, ProgressSave, Score } from './types/schema';
import { missions, baseRack, getMission } from './missions';
import {
  createEngineState,
  reduce,
  type EngineState,
} from './engine/reducer';
import { scoreRun } from './engine/scoring';
import {
  loadProgress,
  recordMissionClear,
} from './lib/progress';
import { MissionList } from './ui/MissionList';
import { MissionBrief } from './ui/MissionBrief';
import { RackView } from './ui/RackView';
import { Debrief } from './ui/Debrief';

type Screen = 'home' | 'brief' | 'rack' | 'debrief';

const sandboxMission: Mission = {
  id: 'sandbox',
  title: 'Sandbox',
  order: 99,
  brief: 'Free play on the training rack. No timer, no goals.',
  constraints: ['Experiment freely', 'Reset anytime'],
  parTimeSec: 9999,
  hintAfterWrongAttempts: 99,
  inventory: { copper_cat6: 12 },
  initial: { devices: [], cables: [] },
  goals: [],
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [progress, setProgress] = useState<ProgressSave>(() => loadProgress());
  const [mission, setMission] = useState<Mission | null>(null);
  const [engine, setEngine] = useState<EngineState | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [tipHistory, setTipHistory] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    if (screen !== 'rack' || !engine || sandbox) return;
    const id = window.setInterval(() => {
      setElapsedSec(
        Math.floor((Date.now() - engine.startedAtMs) / 1000),
      );
    }, 500);
    return () => window.clearInterval(id);
  }, [screen, engine, sandbox]);

  useEffect(() => {
    if (!engine || sandbox || screen !== 'rack') return;
    if (!engine.snapshot.complete || score) return;
    const result = scoreRun(engine);
    setScore(result);
    if (mission && mission.id !== 'sandbox') {
      setProgress(recordMissionClear(mission.id, result));
    }
    const t = window.setTimeout(() => setScreen('debrief'), 650);
    return () => window.clearTimeout(t);
  }, [engine, sandbox, screen, mission, score]);

  function trackTip(next: EngineState) {
    const msg = next.snapshot.lastTip?.message;
    if (msg) {
      setTipHistory((prev) =>
        prev[prev.length - 1] === msg ? prev : [...prev, msg].slice(-8),
      );
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
    trackTip(state);
  }

  function dispatchConnect(a: PortRef, b: PortRef) {
    if (!engine) return;
    const next = reduce(engine, { type: 'CONNECT', a, b });
    setEngine(next);
    trackTip(next);
  }

  function dispatchDisconnect(port: PortRef) {
    if (!engine) return;
    const next = reduce(engine, { type: 'DISCONNECT_PORT', port });
    setEngine(next);
    trackTip(next);
  }

  function dispatchHint() {
    if (!engine) return;
    const next = reduce(engine, { type: 'REQUEST_HINT' });
    setEngine(next);
    trackTip(next);
  }

  function dispatchReset() {
    if (!mission) return;
    startMission(mission, sandbox);
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
          onSelect={openBrief}
          onSandbox={() => startMission(sandboxMission, true)}
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
    </div>
  );
}
