/** Immutable ordering helpers for the builder's stable step IDs. */
export function moveStepBy(steps, stepId, delta) {
  if (!Array.isArray(steps) || !Number.isInteger(delta) || Math.abs(delta) !== 1) {
    return { steps: Array.isArray(steps) ? [...steps] : [], index: -1, moved: false };
  }
  const from = steps.findIndex(step => step.id === stepId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= steps.length) {
    return { steps: [...steps], index: from, moved: false };
  }
  const reordered = [...steps];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  return { steps: reordered, index: to, moved: true };
}

/** Place a step immediately before or after another step without changing IDs. */
export function placeStepRelative(steps, stepId, targetId, after = false) {
  if (!Array.isArray(steps)) return { steps: [], index: -1, moved: false };
  const from = steps.findIndex(step => step.id === stepId);
  const target = steps.findIndex(step => step.id === targetId);
  if (from < 0 || target < 0 || from === target) {
    return { steps: [...steps], index: from, moved: false };
  }
  const reordered = [...steps];
  const [step] = reordered.splice(from, 1);
  let to = target + (after ? 1 : 0);
  if (from < to) to -= 1;
  reordered.splice(to, 0, step);
  return { steps: reordered, index: to, moved: to !== from };
}

/** Restore the exact prior ID order after an interrupted pointer drag. */
export function restoreStepOrder(steps, stepIds) {
  if (!Array.isArray(steps) || !Array.isArray(stepIds)) return Array.isArray(steps) ? [...steps] : [];
  const byId = new Map(steps.map(step => [step.id, step]));
  const restored = stepIds.map(id => byId.get(id)).filter(Boolean);
  const restoredIds = new Set(restored.map(step => step.id));
  return [...restored, ...steps.filter(step => !restoredIds.has(step.id))];
}
