#!/usr/bin/env python3
"""build-geo-plate.py — lay a festival's OWN map art on its real venue.

Jake, 2026-11-10: every festival's map should sit "on top of where the event
venue is", with "the stylized map from the actual festival overlaid on top of
the geo coordinates".

What this does, per festival:
  1. Reads map-sources/<festivalId>-geo-ties.json: tie points between the
     official map art (pixels on `plate`) and the ground (lat/lng). Ties are
     FIXED features both the art and OpenStreetMap draw: street corners,
     building corners, shoreline and pier ends. Never stages: a stage pin is
     what the art is being tested against, not evidence for it.
  2. Fits the art to the ground: `affine` for top-down and isometric art (a
     parallel projection of a flat site IS an affine), `homography` for art
     drawn in perspective (streets converge, e.g. III Points).
  3. Warps the art into a north-up raster whose four corners are a plain
     lat/lng rectangle, so MapLibre draws it exactly (an image source drawn
     from a skewed quad is split into two triangles and tears on the diagonal).
     Outside the art box the raster is transparent.
  4. Writes the result block back into the ties file and prints the
     `mapGeoref` block for the festival config.

What a fit is and is not: residuals measure how well the ART agrees with the
ground at the ties. Art is not to scale, so the fit places the art; it does
not place stages. Stage pins, distance readouts and photo auto-tagging keep
following gpsAnchors and the gates in scripts/verify.mjs, unchanged.

  python3 scripts/build-geo-plate.py build <festivalId> [...]   # fit + warp + write
  python3 scripts/build-geo-plate.py build --all
  python3 scripts/build-geo-plate.py check                       # verify every ties file
"""
import hashlib, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TIES_DIR = os.path.join(ROOT, "map-sources")
OUT_DIR = os.path.join(ROOT, "geo-maps")
MAX_PX = 2048          # longest side of the warped raster
WEBP = dict(quality=84, method=6)


def mpd(lat):
    p = math.radians(lat)
    return (111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p),
            111412.84 * math.cos(p) - 93.5 * math.cos(3 * p))


class Frame:
    """Local metres (east, north) about a reference lat/lng."""
    def __init__(self, lat0, lng0):
        self.lat0, self.lng0 = lat0, lng0
        self.mlat, self.mlng = mpd(lat0)
    def en(self, lat, lng):
        return ((lng - self.lng0) * self.mlng, (lat - self.lat0) * self.mlat)
    def ll(self, e, n):
        return (self.lat0 + n / self.mlat, self.lng0 + e / self.mlng)


def fit(model, src, dst):
    """src, dst: (k,2) arrays. Returns 3x3 matrix M with dst ~ M @ [src,1]."""
    k = len(src)
    if model == "affine":
        if k < 3: raise SystemExit("affine needs at least 3 ties")
        A = np.hstack([src, np.ones((k, 1))])
        sol, *_ = np.linalg.lstsq(A, dst, rcond=None)
        M = np.eye(3); M[0, :] = sol[:, 0]; M[1, :] = sol[:, 1]
        return M
    if model == "homography":
        if k < 4: raise SystemExit("homography needs at least 4 ties")
        # Normalised DLT (Hartley): condition both point sets first.
        def norm(p):
            c = p.mean(0); s = math.sqrt(2) / max(np.sqrt(((p - c) ** 2).sum(1)).mean(), 1e-9)
            T = np.array([[s, 0, -s * c[0]], [0, s, -s * c[1]], [0, 0, 1]])
            return T, (np.hstack([p, np.ones((len(p), 1))]) @ T.T)[:, :2]
        Ts, s = norm(src); Td, d = norm(dst)
        rows = []
        for (x, y), (u, v) in zip(s, d):
            rows.append([-x, -y, -1, 0, 0, 0, u * x, u * y, u])
            rows.append([0, 0, 0, -x, -y, -1, v * x, v * y, v])
        _, _, Vt = np.linalg.svd(np.array(rows))
        Hn = Vt[-1].reshape(3, 3)
        H = np.linalg.inv(Td) @ Hn @ Ts
        return H / H[2, 2]
    raise SystemExit(f"unknown model {model!r}")


def apply(M, pts):
    p = np.hstack([pts, np.ones((len(pts), 1))]) @ M.T
    return p[:, :2] / p[:, 2:3]


def sha256(path):
    with open(path, "rb") as f: return hashlib.sha256(f.read()).hexdigest()


def ties_path(fid): return os.path.join(TIES_DIR, f"{fid}-geo-ties.json")


# Everything that decides where the art lands and which pixels it keeps. The
# in-sample rms can't catch a uniform shift of the ground points (the fit just
# moves with them), so check() compares this digest, not only the residuals.
PLACEMENT_KEYS = ("plate", "artBox", "artPolygon", "model", "ties")


def inputs_sha256(T):
    blob = json.dumps({k: T.get(k) for k in PLACEMENT_KEYS}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


def solve(T):
    ties = T["ties"]
    frame = Frame(sum(t["lat"] for t in ties) / len(ties), sum(t["lng"] for t in ties) / len(ties))
    src = np.array([[t["px"], t["py"]] for t in ties], float)
    dst = np.array([frame.en(t["lat"], t["lng"]) for t in ties], float)
    M = fit(T["model"], src, dst)
    res = np.sqrt(((apply(M, src) - dst) ** 2).sum(1))
    # Leave-one-out: each tie predicted by a fit that never saw it. This is the
    # honest error of the placement; the in-sample rms flatters small sets.
    need = 3 if T["model"] == "affine" else 4
    loo = []
    if len(ties) > need:
        for i in range(len(ties)):
            keep = [j for j in range(len(ties)) if j != i]
            Mi = fit(T["model"], src[keep], dst[keep])
            loo.append(float(np.sqrt(((apply(Mi, src[i:i + 1]) - dst[i:i + 1]) ** 2).sum())))
    checks = []
    for c in T.get("checks", []):
        p = apply(M, np.array([[c["px"], c["py"]]], float))[0]
        checks.append({"name": c["name"], "metres": round(float(np.hypot(*(p - np.array(frame.en(c["lat"], c["lng"]))))), 1)})
    return frame, M, res, loo, checks


def build(fid):
    tp = ties_path(fid)
    T = json.load(open(tp))
    assert T["festivalId"] == fid, f"{tp}: festivalId {T['festivalId']} != {fid}"
    frame, M, res, loo, checks = solve(T)
    src = np.array([[t["px"], t["py"]] for t in T["ties"]], float)
    plate = Image.open(os.path.join(ROOT, T["plate"])).convert("RGBA")
    W, H = plate.size
    box = T.get("artBox") or {"x": 0, "y": 0, "w": W, "h": H}
    alpha = Image.new("L", (W, H), 0)
    corners = np.array([[box["x"], box["y"]], [box["x"] + box["w"], box["y"]],
                        [box["x"] + box["w"], box["y"] + box["h"]], [box["x"], box["y"] + box["h"]]], float)
    if T.get("artPolygon"):
        # The ground the art draws, without its title or legend. Needed for a
        # homography: far from the ties it sends a title block across the city.
        poly = [tuple(p) for p in T["artPolygon"]]
        ImageDraw.Draw(alpha).polygon(poly, fill=255)
        corners = np.array(poly, float)
    else:
        alpha.paste(255, (box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
    plate.putalpha(Image.composite(plate.getchannel("A"), alpha, alpha))

    cen = apply(M, corners)
    e0, e1 = cen[:, 0].min(), cen[:, 0].max()
    n0, n1 = cen[:, 1].min(), cen[:, 1].max()
    # Resolution: keep the art's own detail (its median metres per pixel),
    # capped so the longest side stays under MAX_PX.
    # Metres per art pixel at the middle of the ties (local scale of the fit).
    c0 = np.array([[src[:, 0].mean(), src[:, 1].mean()]])
    ex, ey = apply(M, c0 + [[1, 0]]) - apply(M, c0), apply(M, c0 + [[0, 1]]) - apply(M, c0)
    span = float(np.hypot(*ex[0])), float(np.hypot(*ey[0]))
    res_m = max(min(span), max(e1 - e0, n1 - n0) / MAX_PX)
    ow, oh = int(math.ceil((e1 - e0) / res_m)), int(math.ceil((n1 - n0) / res_m))
    # Output pixel (i, j) -> metres (e0 + i*r, n1 - j*r) -> art pixel via M^-1.
    O = np.array([[res_m, 0, e0], [0, -res_m, n1], [0, 0, 1]])
    P = np.linalg.inv(M) @ O
    P = P / P[2, 2]
    coeffs = tuple(P.flatten()[:8])
    warped = plate.transform((ow, oh), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    os.makedirs(OUT_DIR, exist_ok=True)
    out_rel = f"geo-maps/{fid}.webp"
    warped.save(os.path.join(ROOT, out_rel), "WEBP", **WEBP)

    s, w = frame.ll(e0, n0)
    n, e = frame.ll(e1, n1)
    out = {
        "image": out_rel, "size": [ow, oh], "metresPerPixel": round(res_m, 3),
        "bounds": {"w": round(w, 7), "s": round(s, 7), "e": round(e, 7), "n": round(n, 7)},
        "rmsM": round(float(np.sqrt((res ** 2).mean())), 1), "worstM": round(float(res.max()), 1),
        "looRmsM": round(float(np.sqrt(np.mean(np.square(loo)))), 1) if loo else None,
        "residualsM": {t["name"]: round(float(r), 1) for t, r in zip(T["ties"], res)},
        "checksM": {c["name"]: c["metres"] for c in checks},
        "inputsSha256": inputs_sha256(T),
        "plateSha256": sha256(os.path.join(ROOT, T["plate"])),
        "sha256": sha256(os.path.join(ROOT, out_rel)),
    }
    T["output"] = out
    with open(tp, "w") as f:
        json.dump(T, f, indent=2, ensure_ascii=False); f.write("\n")
    print(f"{fid}: {T['model']} over {len(T['ties'])} ties · rms {out['rmsM']} m · worst {out['worstM']} m · "
          f"leave-one-out {out['looRmsM']} m · {ow}x{oh} @ {res_m:.2f} m/px")
    for t, r in zip(T["ties"], res): print(f"    {t['name']:<44} {r:6.1f} m")
    for c in checks: print(f"    check {c['name']:<38} {c['metres']:6.1f} m")
    b = out["bounds"]
    print("  mapGeoref: { image: %s, bounds: [%s, %s, %s, %s], model: %s, ties: %s, rmsM: %s, looRmsM: %s },"
          % (json.dumps(out_rel), b["w"], b["s"], b["e"], b["n"], json.dumps(T["model"]),
             json.dumps(f"map-sources/{fid}-geo-ties.json"), out["rmsM"], json.dumps(out["looRmsM"])))


def check():
    bad = 0
    files = sorted(f for f in os.listdir(TIES_DIR) if f.endswith("-geo-ties.json"))
    for f in files:
        T = json.load(open(os.path.join(TIES_DIR, f)))
        fid, out = T["festivalId"], T.get("output")
        if not out: print(f"  ✗ {fid}: never built"); bad += 1; continue
        if out.get("inputsSha256") != inputs_sha256(T):
            print(f"  ✗ {fid}: ties, art box, polygon, model or plate changed since the build"); bad += 1; continue
        frame, M, res, loo, _ = solve(T)
        if abs(float(np.sqrt((res ** 2).mean())) - out["rmsM"]) > 0.11:
            print(f"  ✗ {fid}: ties changed since the build (rms now {np.sqrt((res ** 2).mean()):.1f} m)"); bad += 1; continue
        if sha256(os.path.join(ROOT, T["plate"])) != out["plateSha256"]:
            print(f"  ✗ {fid}: plate {T['plate']} changed since the build"); bad += 1; continue
        if not os.path.exists(os.path.join(ROOT, out["image"])) or sha256(os.path.join(ROOT, out["image"])) != out["sha256"]:
            print(f"  ✗ {fid}: {out['image']} missing or not the built bytes"); bad += 1; continue
        print(f"  ok {fid:<28} {T['model']:<10} {len(T['ties'])} ties · rms {out['rmsM']} m · loo {out['looRmsM']} m")
    if bad: sys.exit(1)
    print(f"  ✓ {len(files)} geo plate(s) match their ties")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["check"]: check()
    elif a[:1] == ["build"]:
        ids = [f[:-len("-geo-ties.json")] for f in sorted(os.listdir(TIES_DIR)) if f.endswith("-geo-ties.json")] if a[1:] == ["--all"] else a[1:]
        for fid in ids: build(fid)
    else:
        print(__doc__); sys.exit(2)
