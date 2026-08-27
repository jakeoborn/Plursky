# Google Search Console — verifying plursky.com and submitting the sitemap

Written 2026-08-26, alongside the SEO PR that made the site indexable.

This is a founder step: it needs Jake's Google account, and the verification token
is issued by Google at the moment you start verification, so it can't be
pre-committed here. Nothing in the repo changes — **domain verification is done
entirely in DNS**, which is why we picked it over the HTML meta tag: it verifies
`http`, `https` and every subdomain at once, and it can't be lost by a redeploy
overwriting `index.html`.

Verified 2026-08-26: `plursky.com` nameservers are `nsa1–nsa4.squarespacedns.com`,
so DNS really is managed in Squarespace, not at a registrar elsewhere.

---

## ⛔ Read this before touching DNS

There is **already a TXT record on the root** of plursky.com:

```
"v=spf1 include:mailgun.org ~all"
```

That is the SPF record for Mailgun email. **Do not edit it, replace it, or merge
the Google string into it.** Add a *second, separate* TXT record. Multiple TXT
records at the same host are normal and expected; both will coexist.

Editing that line instead of adding a new one is the one move here that causes
real damage — it silently breaks email deliverability, and nothing on the website
will look wrong.

---

## Step 1 — start verification in Search Console

1. Go to <https://search.google.com/search-console> and sign in.
2. Open the property dropdown (top left) → **Add property**.
3. Choose the **Domain** option — the left-hand box, *not* "URL prefix".
4. Enter exactly:
   ```
   plursky.com
   ```
   No `https://`, no `www.`, no trailing slash.
5. Click **Continue**. Google shows a TXT record that looks like:
   ```
   google-site-verification=AbCdEf1234567890_exampleTokenOnly
   ```
   Copy the **whole string**, including the `google-site-verification=` prefix.
   Leave this browser tab open — you'll come back to it in Step 3.

## Step 2 — add the TXT record in Squarespace

1. Squarespace → **Settings** → **Domains** → **plursky.com**.
2. Open **DNS** / **DNS Settings**.
3. Under **Custom Records**, click **Add Record** — do not click into the existing
   SPF row.
4. Fill in:

   | Field | Value |
   | --- | --- |
   | **Host** | `@` |
   | **Type** | `TXT` |
   | **Data** / **Value** | the full `google-site-verification=…` string from Step 1 |

   `@` means the root of the domain. If the Host field refuses `@`, leave it blank
   or enter `plursky.com` — Squarespace's UI varies; all three mean the root.

   Paste the value **unquoted**. Squarespace adds the quotes itself. If you paste
   it with quotes you can end up with a double-quoted record that won't verify.

5. **Save.**
6. Confirm the SPF record is still present and unchanged before you leave the page.

## Step 3 — verify

DNS usually propagates in a few minutes, occasionally up to an hour.

Check it has landed (either works):

```bash
dig +short TXT plursky.com
```
```bash
nslookup -type=TXT plursky.com
```

You should see **two** strings — the Mailgun SPF line and the Google one. When the
Google line appears, go back to the Search Console tab and click **Verify**.

If it fails, wait and retry rather than adding a second record; a duplicate token
doesn't help and makes the records harder to read later.

## Step 4 — submit the sitemap

Once verified, in Search Console:

1. Left sidebar → **Sitemaps**.
2. Under "Add a new sitemap", enter:
   ```
   sitemap.xml
   ```
   (the field is already prefixed with `https://plursky.com/`)
3. **Submit.**

Then, useful on day one:
- **URL Inspection** → paste `https://plursky.com/f/lost-lands-2026/` → **Request
  indexing**. Do the same for the homepage. This is the fastest way to get the
  first pages crawled instead of waiting for a natural crawl.

## Keeping it current

`sitemap.xml`, the `/f/` pages, and the homepage festival lists are all generated
together:

```bash
node scripts/gen-festival-pages.mjs
```

Run it and commit the result whenever a lineup or registry entry changes, then
**resubmit the sitemap in Search Console** so Google re-reads it. The `<lastmod>`
dates are stamped at generation time, which is the signal Google uses to decide
what to re-crawl — a stale sitemap means stale results even when the pages are
current.

## What to expect

Indexing is not instant. A brand-new domain property typically takes days to a
couple of weeks before the festival pages show up for lineup queries. The pages
being crawlable at all is the change here; ranking follows separately, and mostly
follows from the lineup content actually being complete and current.
