---
name: plursky-verify
description: >
  Validate Plursky JSX changes — there's no build pipeline (scripts/build.mjs
  only COPIES), so a green build does NOT mean valid code. Babel-transforms
  changed files + runs a headless mount probe + (for UI) a screenshot. Use
  after editing any .jsx and before committing/claiming a change works.
  Triggers: "verify plursky", "validate", "does it parse", "check the build",
  "mount probe", before any Plursky commit.
---

`scripts/build.mjs` only copies → green build ≠ valid. Always self-validate.

Prereqs: `python3`, and Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## 1. Build + parse-check changed files (Babel react preset)

```bash
cd /Users/jaobo/Plursky
node scripts/build.mjs
python3 -m http.server 8899 >/tmp/srv.log 2>&1 & SRV=$!; sleep 1
# edit FILES to the .jsx you changed
FILES='["map.jsx","spotify.jsx"]'
cat > __pc.html <<HTML
<!doctype html><meta charset="utf-8"><script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
<script>(async()=>{let o=[];for(const f of $FILES){try{const c=await(await fetch('/'+f)).text();Babel.transform(c,{presets:['react'],filename:f});o.push(f+':OK')}catch(e){o.push(f+':ERR '+e.message)}}document.body.innerHTML='<pre id=o>'+o.join(' | ')+'</pre>'})()</script>
HTML
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --virtual-time-budget=7000 --dump-dom "http://localhost:8899/__pc.html" 2>/dev/null | grep -oE "id=.o.>[^<]*"
rm -f __pc.html; kill $SRV 2>/dev/null
```

## 2. Mount probe (full app boots, no eval errors)

Loads the real script chain in `index.html` order. PASS = `root=1` and the
fns you care about are `function`.

```bash
cd /Users/jaobo/Plursky
# Match only real <script src="...">, NOT every "*.jsx" string in the file.
# index.html PROSE mentions app.jsx and spotify.jsx in comments well above the
# script tags, so the loose pattern hoisted both to the FRONT of the order.
# app.jsx then evaluated before data.jsx and died on `FESTIVAL_CONFIG is not
# defined` — a probe failure with healthy code behind it.
ORDER=$(grep -oE 'src="[^"]+\.jsx' index.html | sed 's/src="//' | awk '!seen[$0]++')
python3 -m http.server 8899 >/tmp/srv.log 2>&1 & SRV=$!; sleep 1
python3 - "$ORDER" > __probe.html <<'PY'
import sys
print('<!doctype html><meta charset="utf-8">')
for u in ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
          'https://unpkg.com/react@18.3.1/umd/react.development.js',
          'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
          'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js']:
    print(f'<script src="{u}"></script>')
print('<body><div id="root"></div>')
for f in sys.argv[1].split():
    print(f'<script type="text/babel" src="/{f}?v=probe"></script>')
# EDIT the fns to assert relevant to your change:
print('''<script>setTimeout(()=>{const fns=['MapScreen','createEdcPlaylist'];
const r=fns.map(f=>f+'='+typeof window[f]);r.push('root='+document.getElementById('root').childElementCount);
const p=document.createElement('pre');p.id='probe';p.textContent=r.join(' | ');document.body.appendChild(p)},6500)</script>''')
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --virtual-time-budget=9500 --dump-dom "http://localhost:8899/__probe.html" 2>/dev/null | grep -oE "id=.probe.>[^<]*"
rm -f __probe.html; kill $SRV 2>/dev/null
```

## 3. Visual check (UI changes only)

Render the component (or a standalone HTML mock) → screenshot → **look at it**.
Don't claim UI works without seeing it.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --window-size=430,300 \
  --screenshot=/tmp/x.png "file:///tmp/mock.html" 2>/dev/null
# then Read /tmp/x.png
```

Notes: Babel-standalone + CDNs need network. New `.jsx` must be in
`index.html` (the probe derives order from it). Clean up `__pc.html`/`__probe.html`.
