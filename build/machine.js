var MACHINE_STOP = "__stop";
function _machineDev() {
  try {
    return location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  } catch {
    return false;
  }
}
function createMachine({
  id,
  initial,
  events,
  states
}) {
  var step = (snap, type, payload) => {
    if (snap.stopped) return snap;
    var row = states[snap.state];
    if (!row || !Object.prototype.hasOwnProperty.call(row, type)) {
      if (_machineDev()) console.warn(`[machine ${id}] unhandled ${type} in ${snap.state}`);
      return snap;
    }
    var h = row[type];
    if (h === null) return snap;
    var out = h(snap.ctx, payload || {});
    if (out === MACHINE_STOP) return {
      ...snap,
      stopped: true,
      effect: null
    };
    if (!out) return snap;
    var [state, ctx = snap.ctx, effect = null] = out;
    if (!states[state]) {
      if (_machineDev()) console.warn(`[machine ${id}] ${type} in ${snap.state} went to unknown state ${state}`);
      return snap;
    }
    return {
      state,
      ctx,
      effect,
      stopped: false,
      seq: snap.seq + 1
    };
  };
  var start = (ctx, state = initial) => ({
    state,
    ctx,
    effect: null,
    stopped: false,
    seq: 0
  });
  return {
    id,
    initial,
    events,
    states,
    step,
    start
  };
}
function machineGaps(machine) {
  var gaps = [];
  for (var s of Object.keys(machine.states)) {
    for (var e of machine.events) {
      if (!Object.prototype.hasOwnProperty.call(machine.states[s], e)) gaps.push(`${s} × ${e}`);
    }
  }
  return gaps;
}
function useMachine(machine, key, init, runEffect) {
  var ref = React.useRef(null);
  var keyRef = React.useRef(key);
  if (ref.current === null) ref.current = init(null);else if (keyRef.current !== key) ref.current = init(ref.current);
  keyRef.current = key;
  var [, render] = React.useReducer(x => x + 1, 0);
  var effectRef = React.useRef(runEffect);
  effectRef.current = runEffect;
  var send = React.useCallback((type, payload) => {
    var prev = ref.current;
    var next = machine.step(prev, type, payload);
    if (next === prev) return;
    ref.current = next;
    if (!next.stopped) render();
  }, [machine]);
  var snap = ref.current;
  React.useEffect(() => {
    if (snap.effect && !snap.stopped) effectRef.current(snap.effect, snap, send);
  }, [snap]);
  React.useEffect(() => () => send("UNMOUNT"), [send]);
  return [snap, send];
}
Object.assign(window, {
  MACHINE_STOP,
  createMachine,
  machineGaps,
  useMachine
});