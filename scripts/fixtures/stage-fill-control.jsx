// Positive control for scripts/lib/token-pairs.mjs stageFillFailures (read by
// test-appearance). Not loaded by the app. One fill reads its ink from the AA
// policy and must pass; one uses a mode token on a stage colour and must FAIL.
const ok = <div style={{ background: stage.color, color: _inkOnHex(stage.color) }}>ok</div>;
const bad = <div style={{ background: s.color, color: "var(--ink)" }}>bad</div>;
