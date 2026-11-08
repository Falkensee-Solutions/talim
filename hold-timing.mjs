export function createHoldRecorder() {
  let pending = null;
  return {
    begin(id, time) {
      if (pending || !id || !Number.isFinite(time) || time < 0) return false;
      pending = { id, start: time };
      return true;
    },
    finish(time) {
      const current = pending;
      pending = null;
      if (!current || !Number.isFinite(time) || time <= current.start) return null;
      return { ...current, end: time, reviewed: true, silent: false };
    },
    cancel() { pending = null; },
    get active() { return pending !== null; },
  };
}
