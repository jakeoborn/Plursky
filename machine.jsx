// machine.jsx — a small explicit state machine, plain JS in the vendored style
// (no state library: the app has no build step to bring one in).
//
// A machine is a table, not scattered ifs: states × events → a handler. A
// handler gets (ctx, payload) and returns [nextState, nextCtx?, effect?], or
// null to stay put. A pair the table leaves out is ILLEGAL: it is a no-op that
// warns in development, which is the tripwire that would have caught f24 (a
// cache write nothing listened for). A pair that should do nothing is written
// down as `null`, so the table says so on purpose.
//
// UNMOUNT is the same for every machine: it returns MACHINE_STOP and the
// machine stops accepting events. That replaces the closure `cancelled` flags.
//
// useMachine is the React adapter: it holds the snapshot in a ref (so two
// events in one tick see each other), re-renders on change, and runs the
// snapshot's effect after commit, never inside setState.

const MACHINE_STOP = "__stop";

function _machineDev() {
  try {
    return location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  } catch { return false; }
}

function createMachine({ id, initial, events, states }) {
  const step = (snap, type, payload) => {
    if (snap.stopped) return snap;
    const row = states[snap.state];
    if (!row || !Object.prototype.hasOwnProperty.call(row, type)) {
      if (_machineDev()) console.warn(`[machine ${id}] unhandled ${type} in ${snap.state}`);
      return snap;
    }
    const h = row[type];
    if (h === null) return snap;
    const out = h(snap.ctx, payload || {});
    if (out === MACHINE_STOP) return { ...snap, stopped: true, effect: null };
    if (!out) return snap;
    const [state, ctx = snap.ctx, effect = null] = out;
    if (!states[state]) {
      if (_machineDev()) console.warn(`[machine ${id}] ${type} in ${snap.state} went to unknown state ${state}`);
      return snap;
    }
    return { state, ctx, effect, stopped: false, seq: snap.seq + 1 };
  };
  const start = (ctx, state = initial) => ({ state, ctx, effect: null, stopped: false, seq: 0 });
  return { id, initial, events, states, step, start };
}

// Every state × event pair the table does not write down. The verify gate
// asserts this is empty for each machine.
function machineGaps(machine) {
  const gaps = [];
  for (const s of Object.keys(machine.states)) {
    for (const e of machine.events) {
      if (!Object.prototype.hasOwnProperty.call(machine.states[s], e)) gaps.push(`${s} × ${e}`);
    }
  }
  return gaps;
}

// init(prev) builds the snapshot for the current key: prev is null on mount,
// or the outgoing snapshot when the key changes (the caller steps its
// PARAM_CHANGE from it). It may step events synchronously, such as a cache
// read, so the first paint for a key is already right. runEffect(effect, snap,
// send) runs after commit. Returns [snapshot, send].
function useMachine(machine, key, init, runEffect) {
  const ref = React.useRef(null);
  const keyRef = React.useRef(key);
  if (ref.current === null) ref.current = init(null);
  else if (keyRef.current !== key) ref.current = init(ref.current);
  keyRef.current = key;
  const [, render] = React.useReducer(x => x + 1, 0);
  const effectRef = React.useRef(runEffect);
  effectRef.current = runEffect;
  const send = React.useCallback((type, payload) => {
    const prev = ref.current;
    const next = machine.step(prev, type, payload);
    if (next === prev) return;
    ref.current = next;
    if (!next.stopped) render();
  }, [machine]);
  const snap = ref.current;
  React.useEffect(() => {
    if (snap.effect && !snap.stopped) effectRef.current(snap.effect, snap, send);
  }, [snap]);
  React.useEffect(() => () => send("UNMOUNT"), [send]);
  return [snap, send];
}

Object.assign(window, { MACHINE_STOP, createMachine, machineGaps, useMachine });
