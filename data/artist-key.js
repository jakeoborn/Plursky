// One artist key for every door (artist repository, M3). The registry build
// (scripts/build-artist-registry.mjs), the photo ledger build and the app's
// photo lookup (chrome.jsx) all call this, so a reviewed photo follows the
// artist and not the exact billing string: "Above & Beyond (Sunrise Set)",
// "ABOVE & BEYOND" and "Above & Beyond" are one key.
//
//   foldKey(s)       the historical library's slug, after folding letters NFKD
//                    cannot decompose ("RØZ" → roz; "¥" is a stylised Y)
//   splitSetTag(s)   lifts a trailing set tag ("(Sunrise Set)", "(live)"); a
//                    parenthetical that names people, or any other one, stays
//   artistKey(s)     foldKey of the billing without its set tag
//
// A billing that names several people ("A b2b B", "A presents B") keys as the
// whole printing here, so it never borrows one member's photo; the avatar
// splits a b2b into faces itself.
(function (g) {
  var LETTERS = { "¥": "Y", "Ø": "O", "ø": "o", "Æ": "AE", "æ": "ae", "Œ": "OE", "œ": "oe", "ß": "ss", "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Þ": "Th", "þ": "th", "ð": "d" };
  var SET_TAG = /^(?:.*\bset|live|hybrid|in the round|unmasked)$/i;
  var PEOPLE_IN_PARENS = /\s[x×+]\s|\sb[23]b\s|,|\s&\s/i;
  function foldKey(s) {
    return String(s).replace(/[¥ØøÆæŒœßŁłĐđÞþð]/g, function (c) { return LETTERS[c]; })
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  }
  function splitSetTag(printed) {
    var name = String(printed).trim();
    var m = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (!m) return { name: name, setTag: null, paren: null };
    var inner = m[2].trim();
    if (SET_TAG.test(inner) && !PEOPLE_IN_PARENS.test(inner)) return { name: m[1].trim(), setTag: inner, paren: null };
    return { name: name, setTag: null, paren: PEOPLE_IN_PARENS.test(inner) ? "people" : "unknown" };
  }
  function artistKey(printed) { return foldKey(splitSetTag(printed).name); }
  g.PlurskyArtistKey = { foldKey: foldKey, splitSetTag: splitSetTag, artistKey: artistKey };
})(typeof window !== "undefined" ? window : globalThis);
