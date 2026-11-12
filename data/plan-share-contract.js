// Public plan-share contract (#74, row 4 stage 1). ONE source for the app and
// for Node: the app loads this as a classic script (window.PlurskyPlanShare);
// scripts/lib/public-plan-share.mjs evaluates this same file. The logic is the
// reviewed stage-2 patch (plursky-plan-share-stage2-670c1c85), unchanged.
// Pure: no account, backend, network or publication side effects.
(function (root) {
  "use strict";
  var KINDS = new Set(["schedule", "map", "playlist"]);
  var clean = function (value, max) { if (max === undefined) max = 160; return typeof value === "string" && value.length <= max && !/[<>\u0000-\u001f]/.test(value); };
  var required = function (v, label, max) { if (!clean(v, max) || !v.trim()) throw new Error("Invalid " + label); return v.trim(); };
  var id = function (v, label) { if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(v)) throw new Error("Invalid " + label); return v; };

  // The public payload: only these fields can ever leave the device.
  function makePublicPlan(input, now) {
    if (now === undefined) now = Date.now();
    var kind = input.kind, festivalId = input.festivalId, editionEnd = input.editionEnd;
    var sets = input.sets === undefined ? [] : input.sets;
    var stages = input.stages === undefined ? [] : input.stages;
    var playlistUrl = input.playlistUrl, displayName = input.displayName;
    if (!KINDS.has(kind)) throw new Error("Invalid share kind");
    var end = Date.parse(editionEnd);
    if (!Number.isFinite(end)) throw new Error("Exact edition end required");
    var expiresAt = end + 7 * 86400000;
    if (expiresAt <= now) throw new Error("Edition sharing window has ended");
    var out = { schemaVersion: 1, kind: kind, festivalId: id(festivalId, "festival id"), expiresAt: new Date(expiresAt).toISOString() };
    // Name is never inherited from a profile. Caller supplies it only on opt-in.
    if (displayName !== undefined && displayName !== "") out.displayName = required(displayName, "display name", 60);
    if (kind === "schedule") {
      if (!Array.isArray(sets) || sets.length > 500) throw new Error("Invalid sets");
      var seen = new Set();
      out.sets = sets.map(function (s) {
        var key = id(s.id, "set id"); if (seen.has(key)) throw new Error("Duplicate set"); seen.add(key);
        var start = Date.parse(s.startsAt), stop = Date.parse(s.endsAt);
        if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start || stop - start > 86400000) throw new Error("Invalid set time");
        return { id: key, artist: required(s.artist, "artist", 180), stage: required(s.stage, "stage", 120), startsAt: new Date(start).toISOString(), endsAt: new Date(stop).toISOString() };
      });
    }
    if (kind === "map") {
      if (!Array.isArray(stages) || stages.length > 100) throw new Error("Invalid stages");
      out.stages = Array.from(new Set(stages.map(function (s) { return id(s, "stage id"); })));
      // No coordinates, GPS, meetup locations, friends or private notes.
    }
    if (kind === "playlist") {
      var url; try { url = new URL(playlistUrl); } catch (e) { throw new Error("Invalid playlist URL"); }
      if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || !/^\/playlist\/[A-Za-z0-9]+$/.test(url.pathname)) throw new Error("Public Spotify playlist required");
      out.playlistUrl = url.origin + url.pathname;
    }
    return out;
  }

  function resolveShare(row, now) {
    if (now === undefined) now = Date.now();
    // A revoked/expired/bad row yields one indistinguishable ended state.
    if (!row || row.revokedAt || !Number.isFinite(Date.parse(row.expiresAt)) || Date.parse(row.expiresAt) <= now) return null;
    return row.payload || null;
  }

  root.PlurskyPlanShare = Object.freeze({ makePublicPlan: makePublicPlan, resolveShare: resolveShare });
})(typeof window !== "undefined" ? window : globalThis);
