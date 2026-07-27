import type { ProgressSave } from '../types/schema';
import { missions } from '../missions';

const CLASSROOM_KEY = 'patchlab.classroom.v1';

export interface ClassroomState {
  version: 1;
  unlocked: boolean;
  codeApplied?: string;
  unlockedAt?: string;
}

/** Simple shared lab codes — not cryptographic secrets. */
export const CLASSROOM_CODES = {
  unlockAll: 'PATCHLAB-LAB',
  unlockSandbox: 'PATCHLAB-SANDBOX',
} as const;

export function loadClassroom(): ClassroomState {
  try {
    const raw = localStorage.getItem(CLASSROOM_KEY);
    if (!raw) return { version: 1, unlocked: false };
    const parsed = JSON.parse(raw) as ClassroomState;
    if (parsed?.version !== 1) return { version: 1, unlocked: false };
    return parsed;
  } catch {
    return { version: 1, unlocked: false };
  }
}

export function saveClassroom(state: ClassroomState): void {
  localStorage.setItem(CLASSROOM_KEY, JSON.stringify(state));
}

export type ClassroomCodeResult =
  | { ok: true; message: string; progress?: ProgressSave; classroom: ClassroomState }
  | { ok: false; message: string };

/** Apply a classroom code. Unlock-all marks every campaign mission cleared. */
export function applyClassroomCode(
  code: string,
  progress: ProgressSave,
): ClassroomCodeResult {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, message: 'Enter a classroom code' };

  if (normalized === CLASSROOM_CODES.unlockSandbox) {
    const classroom: ClassroomState = {
      version: 1,
      unlocked: true,
      codeApplied: normalized,
      unlockedAt: new Date().toISOString(),
    };
    saveClassroom(classroom);
    const next: ProgressSave = {
      ...progress,
      sandboxUnlocked: true,
    };
    return {
      ok: true,
      message: 'Sandbox unlocked for this classroom session.',
      progress: next,
      classroom,
    };
  }

  if (normalized === CLASSROOM_CODES.unlockAll) {
    const classroom: ClassroomState = {
      version: 1,
      unlocked: true,
      codeApplied: normalized,
      unlockedAt: new Date().toISOString(),
    };
    saveClassroom(classroom);
    const next: ProgressSave = {
      ...progress,
      clearedMissionIds: missions.map((m) => m.id),
      sandboxUnlocked: true,
    };
    return {
      ok: true,
      message: 'Classroom unlock applied — all stages available.',
      progress: next,
      classroom,
    };
  }

  return {
    ok: false,
    message: 'Unknown code. Ask your instructor for PATCHLAB-LAB or PATCHLAB-SANDBOX.',
  };
}

export function classroomHandout(): string {
  return `# PatchLab classroom handout

## Student setup
1. Open https://cozygarage.github.io/patchlab/
2. Choose Easy pace for coaching, or Standard for less scaffolding.
3. Complete stages in order — stars are optional.

## Instructor codes
- \`PATCHLAB-LAB\` — unlock all campaign stages + sandbox
- \`PATCHLAB-SANDBOX\` — unlock sandbox only

Enter a code from the home screen Classroom panel.

## Suggested 45-minute lab
1. First Lights On (copper path)
2. Wrong Port (move a cross-connect)
3. VLAN Trap or Access VLAN Assign
4. Sandbox free-play / share a lab URL

## Tips
- Tap-tap or drag to patch; U / fling to unplug; Undo to reverse the last action.
- Easy pace keeps ticket details and coach tips visible.
- Export progress before rotating machines.
`;
}
