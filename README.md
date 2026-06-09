# ComplyKit

**Generate a real privacy policy, terms of service, and a working cookie-consent
banner — free, no signup, in your browser.**

ComplyKit is a client-side legal-document generator. Answer a short
questionnaire and it assembles three documents tailored to what your app
actually does:

1. **Privacy Policy** — GDPR &amp; CCPA/CPRA aware, version-stamped with the
   day you generate it.
2. **Terms of Service** — acceptable use, accounts, payments, liability, and
   governing law, adapted to your answers.
3. **Cookie Notice** — plain-English explanation of the cookie categories you
   use — plus a copy-paste **vanilla-JS cookie-consent banner** (accessible,
   categorized necessary/analytics/marketing, `localStorage` persistence, no
   dependencies).

A **Copper Bay Labs** product.

- **Live:** https://dukotah.github.io/complykit/
- **100% client-side.** Generation runs entirely in your browser. Your answers
  are never uploaded, transmitted, logged, or stored. There is no backend —
  open the Network tab and watch: nothing leaves the page. It even works
  offline once loaded.

## Features

- Live preview that rebuilds as you type, with per-document tabs.
- Conditional clauses: Stripe &rarr; payment clause, analytics &rarr; tracking +
  opt-out clause, accounts &rarr; account-data clause, EU/UK &rarr; GDPR rights,
  California &rarr; CCPA rights, minimum-age &rarr; children's-data wording.
- Per-document **Copy HTML**, **Download .html**, **Download .md**, and
  **Download .txt**.
- Plain-English "what this means" gloss beside each major clause.
- A ready-to-paste, accessible cookie-consent banner that gates analytics and
  marketing behind real consent (`window.cookieConsent` + a `cookieconsent`
  event).
- A clear "template, not legal advice" disclaimer on every generated document
  and in the footer.

## Run it locally

No build step, no dependencies. Just open `index.html` in any modern browser:

```
git clone https://github.com/dukotah/complykit.git
cd complykit
# open index.html (double-click, or `start index.html` on Windows)
```

## What it is (and isn't)

ComplyKit is a **drafting tool, not a law firm, and its output is not legal
advice.** A polished-looking document does not make you compliant — the
documents must match what your app and company actually do, and should be
reviewed by a qualified lawyer before you publish them. See
[How it works](about.html) for the full methodology and the official GDPR/CCPA
sources the templates derive from.

---

A [Copper Bay Labs](https://copperbaytech.com) product.
