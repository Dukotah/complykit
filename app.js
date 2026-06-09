/* ComplyKit — client-side legal-document generator.
 *
 * HARD PRIVACY GUARANTEE: this file makes ZERO network calls with user data.
 * There is no fetch / XMLHttpRequest / WebSocket / sendBeacon / Image-ping
 * anywhere here. Everything the user types is used to assemble documents
 * locally in the browser and never leaves the tab.
 *
 * SECURITY: every value the user supplies (company name, email, URL, etc.) is
 * inserted into the live preview via textContent / DOM construction — NEVER via
 * innerHTML — so a malicious paste cannot inject markup or run script. The
 * generated documents are modeled as a structured "block" tree; renderers turn
 * that tree into safe DOM (preview), an HTML string (with every interpolation
 * HTML-escaped), Markdown, and plain text.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // HTML-escape for the downloadable .html string (the only place we build an
  // HTML string from user data). The preview never uses this — it uses the DOM.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayISO() {
    var d = new Date();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function todayLong() {
    try {
      return new Date().toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric"
      });
    } catch (e) {
      return todayISO();
    }
  }

  // Build a version stamp from the generation day, e.g. "2026.06.08".
  function versionStamp() {
    return todayISO().replace(/-/g, ".");
  }

  /* ------------------------------------------------------------------ *
   * Read the questionnaire into a plain model object.
   * ------------------------------------------------------------------ */
  var THIRD_PARTIES = {
    ga:         { name: "Google Analytics", purpose: "website and product analytics", privacy: "https://policies.google.com/privacy" },
    stripe:     { name: "Stripe",           purpose: "payment processing",            privacy: "https://stripe.com/privacy" },
    vercel:     { name: "Vercel",           purpose: "website hosting and delivery",  privacy: "https://vercel.com/legal/privacy-policy" },
    cloudflare: { name: "Cloudflare",       purpose: "content delivery, security, and DDoS protection", privacy: "https://www.cloudflare.com/privacypolicy/" },
    email:      { name: "our email provider", purpose: "sending transactional and account emails", privacy: "" }
  };

  function readModel() {
    function val(id) { var n = $(id); return n ? n.value.trim() : ""; }
    function on(id) { var n = $(id); return !!(n && n.checked); }

    var company = val("company") || "";
    var model = {
      company: company,
      displayName: company || "the Company",
      website: val("website"),
      email: val("email"),
      entity: val("entity"),
      minage: val("minage") || "16",
      data: {
        analytics: on("d-analytics"),
        cookies:   on("d-cookies"),
        accounts:  on("d-accounts"),
        payments:  on("d-payments"),
        location:  on("d-location"),
        marketing: on("d-marketing")
      },
      tp: {
        ga:         on("t-ga"),
        stripe:     on("t-stripe"),
        vercel:     on("t-vercel"),
        cloudflare: on("t-cloudflare"),
        email:      on("t-email")
      },
      region: {
        eu:     on("r-eu"),
        ca:     on("r-ca"),
        global: on("r-global")
      },
      dateLong: todayLong(),
      dateISO: todayISO(),
      version: versionStamp()
    };

    // Stripe implies payments processing even if the payments toggle is off.
    if (model.tp.stripe) model.data.payments = true;
    // Google Analytics implies analytics + cookies.
    if (model.tp.ga) { model.data.analytics = true; model.data.cookies = true; }

    model.hasContact = !!(company || model.email || model.website);
    model.thirdPartyList = Object.keys(model.tp)
      .filter(function (k) { return model.tp[k]; })
      .map(function (k) { return THIRD_PARTIES[k]; });

    return model;
  }

  /* ------------------------------------------------------------------ *
   * Document model as a tree of "blocks".
   * Block kinds:
   *   {t:"h2", text}                       section heading
   *   {t:"h3", text}                       sub heading
   *   {t:"p", text}                        paragraph (text may contain refs)
   *   {t:"ul"|"ol", items:[text,...]}      list
   *   {t:"gloss", text}                    "what this means" plain-English note
   *   {t:"disclaimer", text}               not-legal-advice banner
   * Text strings are PLAIN TEXT (no HTML). Each renderer escapes as needed.
   * ------------------------------------------------------------------ */

  var DISCLAIMER_TEXT =
    "This document was generated from a template and is provided for general informational purposes only. " +
    "It is not legal advice and does not create an attorney-client relationship. Laws differ by jurisdiction and change over time. " +
    "Review and adapt this document with a qualified lawyer before relying on it.";

  function contactLine(m) {
    var bits = [];
    if (m.email) bits.push("email at " + m.email);
    if (m.website) bits.push("our website at " + m.website);
    if (!bits.length) return "the contact details published on our website";
    return bits.join(", or via ");
  }

  function ageNoun(age) {
    if (age === "18") return "18 years of age";
    if (age === "16") return "16 years of age";
    if (age === "13") return "13 years of age";
    return "";
  }

  /* ---------- Privacy Policy ---------- */
  function buildPrivacy(m) {
    var b = [];
    b.push({ t: "disclaimer", text: DISCLAIMER_TEXT });

    b.push({ t: "p", text:
      "This Privacy Policy explains how " + m.displayName +
      " (“we”, “us”, or “our”) collects, uses, and protects information when you use " +
      (m.website ? m.website : "our website and services") + " (the “Service”)." });

    // 1. Information we collect
    b.push({ t: "h2", text: "1. Information We Collect" });
    var collected = [];
    if (m.data.accounts) collected.push("Account information you provide when you register, such as your name, email address, and password.");
    if (m.data.payments) collected.push("Billing information needed to process payments. Card details are handled by our payment processor and are not stored on our own servers.");
    if (m.data.analytics) collected.push("Usage and device data, such as pages viewed, actions taken, browser type, and approximate device information, collected automatically as you use the Service.");
    if (m.data.cookies) collected.push("Information stored in cookies and similar technologies on your device (see the Cookies section below).");
    if (m.data.location) collected.push("Location information, which may be derived from your IP address or, with your permission, from your device.");
    if (m.data.marketing) collected.push("Contact information you give us when you subscribe to emails or marketing communications.");
    collected.push("Information you send us directly, for example when you contact support or fill in a form.");
    b.push({ t: "ul", items: collected });
    b.push({ t: "gloss", text: "This is the plain list of what you actually gather. Only keep what you genuinely use — collecting less data lowers both your risk and your obligations." });

    // 2. How we use it
    b.push({ t: "h2", text: "2. How We Use Your Information" });
    var uses = ["To provide, operate, and maintain the Service.", "To respond to your requests and provide support."];
    if (m.data.accounts) uses.push("To create and manage your account and authenticate you.");
    if (m.data.payments) uses.push("To process payments, subscriptions, and refunds.");
    if (m.data.analytics) uses.push("To understand how the Service is used and to improve it.");
    if (m.data.marketing) uses.push("To send you newsletters or marketing messages, where you have agreed to receive them.");
    uses.push("To protect the Service against fraud, abuse, and security threats, and to comply with our legal obligations.");
    b.push({ t: "ol", items: uses });

    // 3. Legal bases (GDPR) — only when EU selected
    if (m.region.eu) {
      b.push({ t: "h2", text: "3. Legal Bases for Processing (EU/UK)" });
      b.push({ t: "p", text:
        "If you are in the European Economic Area or the United Kingdom, we process your personal data only where we have a legal basis to do so under the General Data Protection Regulation (GDPR)." });
      var bases = [
        "Performance of a contract — to deliver the Service you requested.",
        "Consent — where you have given it, for example for marketing or non-essential cookies. You may withdraw consent at any time.",
        "Legitimate interests — to operate, secure, and improve the Service, where those interests are not overridden by your rights.",
        "Legal obligation — where we must process data to comply with the law."
      ];
      b.push({ t: "ul", items: bases });
      b.push({ t: "gloss", text: "GDPR requires a specific lawful reason for every kind of processing. Naming the basis up front is exactly what regulators look for." });
    }

    // Payments / Stripe clause
    if (m.data.payments) {
      b.push({ t: "h2", text: "Payment Processing" });
      var payProc = m.tp.stripe ? "Stripe" : "our third-party payment processor";
      b.push({ t: "p", text:
        "Payments are processed by " + payProc + ". When you make a purchase, your payment-card details are collected and processed directly by " + payProc +
        " under its own privacy terms; we do not store full card numbers on our servers. We receive only the information needed to confirm and manage your transaction, such as the last four digits, the card brand, and the result of the charge." });
      if (m.tp.stripe) {
        b.push({ t: "p", text: "You can review Stripe’s privacy practices at https://stripe.com/privacy." });
      }
      b.push({ t: "gloss", text: "Using a processor like Stripe keeps raw card data out of your hands, which dramatically reduces your PCI and breach exposure. Say so plainly." });
    }

    // Analytics + opt-out clause
    if (m.data.analytics) {
      b.push({ t: "h2", text: "Analytics and Tracking" });
      var analyticsTool = m.tp.ga ? "Google Analytics" : "analytics tools";
      b.push({ t: "p", text:
        "We use " + analyticsTool + " to understand how visitors use the Service so we can improve it. " +
        "These tools collect information such as the pages you visit, how you arrived, and general device and browser details, typically using cookies or similar identifiers." });
      var optOut = [];
      if (m.data.cookies) optOut.push("Adjusting your choices in our cookie banner, where non-essential analytics cookies are off until you accept them.");
      optOut.push("Using your browser’s settings to block or delete cookies.");
      if (m.tp.ga) optOut.push("Installing Google’s opt-out browser add-on, available at https://tools.google.com/dlpage/gaoptout.");
      optOut.push("Sending a “Do Not Track” or Global Privacy Control signal, which we honor where required by law.");
      b.push({ t: "h3", text: "Your choices" });
      b.push({ t: "ul", items: optOut });
      b.push({ t: "gloss", text: "If you track people you must give them a real way to opt out — and the opt-out has to actually work, not just be described." });
    }

    // Account-data clause
    if (m.data.accounts) {
      b.push({ t: "h2", text: "Account Data" });
      b.push({ t: "p", text:
        "When you create an account we store the information needed to operate it, such as your login credentials and profile details. " +
        "You can update most of this information from your account settings. If you ask us to delete your account, we will remove or anonymize your account data within a reasonable period, except where we are required to keep certain records by law." });
      b.push({ t: "gloss", text: "Account holders expect control over their own data. Spell out how they edit it and how they close the account." });
    }

    // Sharing / third parties
    b.push({ t: "h2", text: "How We Share Information" });
    b.push({ t: "p", text:
      "We do not sell your personal information. We share it only with service providers that help us run the Service, and only as needed for them to perform their work for us." });
    if (m.thirdPartyList.length) {
      b.push({ t: "p", text: "The main third-party providers we rely on are:" });
      var tpItems = m.thirdPartyList.map(function (tp) {
        var line = tp.name + " — " + tp.purpose + ".";
        if (tp.privacy) line += " Privacy policy: " + tp.privacy;
        return line;
      });
      b.push({ t: "ul", items: tpItems });
    }
    b.push({ t: "p", text:
      "We may also disclose information where required by law, to enforce our terms, or to protect the rights, property, or safety of our users or the public." });

    // Cookies summary (only if cookies)
    if (m.data.cookies) {
      b.push({ t: "h2", text: "Cookies" });
      b.push({ t: "p", text:
        "We use cookies and similar technologies to keep the Service working, remember your preferences, and — with your consent — measure usage. " +
        "You can control non-essential cookies through the consent banner on the Service and through your browser settings. See our separate Cookie Notice for the full details." });
    }

    // Data retention
    b.push({ t: "h2", text: "Data Retention" });
    b.push({ t: "p", text:
      "We keep personal information only for as long as we need it for the purposes described in this policy, or for as long as the law requires, after which we delete or anonymize it." });

    // Security
    b.push({ t: "h2", text: "Security" });
    b.push({ t: "p", text:
      "We use reasonable technical and organizational measures to protect your information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security." });

    // Children
    b.push({ t: "h2", text: "Children’s Privacy" });
    var ageWord = ageNoun(m.minage);
    if (ageWord) {
      b.push({ t: "p", text:
        "The Service is not directed to children under " + ageWord + ", and we do not knowingly collect personal information from them. " +
        "If you believe a child under " + ageWord + " has provided us with personal information, please contact us and we will delete it." });
    } else {
      b.push({ t: "p", text:
        "If you believe a child has provided us with personal information without appropriate consent, please contact us and we will delete it." });
    }

    // GDPR rights — EU
    if (m.region.eu) {
      b.push({ t: "h2", text: "Your Rights (EU/UK – GDPR)" });
      b.push({ t: "p", text: "If you are in the EEA or the UK, you have the following rights over your personal data:" });
      b.push({ t: "ul", items: [
        "Access — to obtain a copy of the personal data we hold about you.",
        "Rectification — to have inaccurate or incomplete data corrected.",
        "Erasure — to ask us to delete your data (the “right to be forgotten”).",
        "Restriction — to ask us to limit how we use your data.",
        "Portability — to receive your data in a portable, machine-readable format.",
        "Objection — to object to processing based on legitimate interests or to direct marketing.",
        "Withdraw consent — at any time, where processing is based on consent.",
        "Complain — to lodge a complaint with your local data protection authority."
      ] });
      b.push({ t: "p", text: "To exercise any of these rights, contact us using the details below. We will respond within the time the law allows." });
      b.push({ t: "gloss", text: "Listing each GDPR right and giving a working way to use it is one of the most-checked parts of a privacy policy by EU regulators." });
    }

    // CCPA rights — California
    if (m.region.ca) {
      b.push({ t: "h2", text: "Your Rights (California – CCPA/CPRA)" });
      b.push({ t: "p", text:
        "If you are a California resident, the California Consumer Privacy Act, as amended by the CPRA, gives you the following rights:" });
      b.push({ t: "ul", items: [
        "Right to know — what personal information we collect, use, and disclose.",
        "Right to delete — the personal information we have collected from you, subject to exceptions.",
        "Right to correct — inaccurate personal information we hold about you.",
        "Right to opt out — of the “sale” or “sharing” of your personal information.",
        "Right to limit — the use of sensitive personal information to what is necessary.",
        "Right to non-discrimination — we will not treat you differently for exercising these rights."
      ] });
      b.push({ t: "p", text:
        "We do not sell your personal information for money. To exercise your California rights, or to ask us not to “sell” or “share” your information as those terms are defined by the CCPA, contact us using the details below." });
      b.push({ t: "gloss", text: "California expects an explicit “Do Not Sell or Share” path and a clear statement of each consumer right. Make the opt-out easy to find." });
    }

    // International transfers (EU)
    if (m.region.eu) {
      b.push({ t: "h2", text: "International Data Transfers" });
      b.push({ t: "p", text:
        "Some of our service providers may process your data outside the EEA or the UK. Where we transfer data internationally, we rely on appropriate safeguards such as the European Commission’s Standard Contractual Clauses." });
    }

    // Changes
    b.push({ t: "h2", text: "Changes to This Policy" });
    b.push({ t: "p", text:
      "We may update this Privacy Policy from time to time. When we do, we will revise the “last updated” date at the top. Significant changes will be communicated through the Service." });

    // Contact
    b.push({ t: "h2", text: "Contact Us" });
    b.push({ t: "p", text:
      "If you have questions about this Privacy Policy or how we handle your information, contact us at " + contactLine(m) + "." });

    return {
      key: "privacy",
      title: "Privacy Policy",
      filename: "privacy-policy",
      blocks: b
    };
  }

  /* ---------- Terms of Service ---------- */
  function buildTerms(m) {
    var b = [];
    b.push({ t: "disclaimer", text: DISCLAIMER_TEXT });

    var entity = m.entity || m.displayName;
    b.push({ t: "p", text:
      "These Terms of Service (“Terms”) govern your use of " + (m.website ? m.website : "our website and services") +
      " (the “Service”), operated by " + entity + ". By accessing or using the Service, you agree to these Terms. If you do not agree, do not use the Service." });

    b.push({ t: "h2", text: "1. Eligibility" });
    var ageWord = ageNoun(m.minage);
    if (ageWord) {
      b.push({ t: "p", text:
        "You must be at least " + ageWord + " to use the Service. By using it, you confirm that you meet this requirement and that any information you provide is accurate." });
    } else {
      b.push({ t: "p", text:
        "By using the Service, you confirm that you have the legal capacity to enter into these Terms and that any information you provide is accurate." });
    }

    if (m.data.accounts) {
      b.push({ t: "h2", text: "2. Your Account" });
      b.push({ t: "p", text:
        "When you create an account, you are responsible for keeping your login credentials confidential and for all activity that happens under your account. " +
        "Notify us immediately if you suspect unauthorized use. We may suspend or terminate accounts that violate these Terms." });
      b.push({ t: "gloss", text: "This puts responsibility for password security on the user and gives you the right to close abusive accounts." });
    }

    b.push({ t: "h2", text: "Acceptable Use" });
    b.push({ t: "p", text: "You agree not to:" });
    b.push({ t: "ul", items: [
      "Break the law or infringe anyone’s rights while using the Service.",
      "Attempt to gain unauthorized access to the Service, other accounts, or our systems.",
      "Interfere with or disrupt the Service, for example by introducing malware or overloading it.",
      "Copy, resell, or reverse-engineer the Service except where the law expressly allows it.",
      "Use the Service to send spam or to harass, abuse, or harm others."
    ] });

    b.push({ t: "h2", text: "Intellectual Property" });
    b.push({ t: "p", text:
      "The Service, including its content, design, and software, is owned by " + entity + " or its licensors and is protected by intellectual-property laws. " +
      "We grant you a limited, non-exclusive, non-transferable right to use the Service for its intended purpose. Anything you submit remains yours, but you grant us the rights we need to operate the Service." });

    if (m.data.payments) {
      b.push({ t: "h2", text: "Payments and Subscriptions" });
      var payProc = m.tp.stripe ? "Stripe" : "our payment processor";
      b.push({ t: "p", text:
        "Paid features are billed as described at the point of purchase. Payments are processed by " + payProc + ". " +
        "You authorize us to charge your chosen payment method for the fees that apply. Unless stated otherwise or required by law, fees are non-refundable. " +
        "Subscriptions renew automatically until you cancel, and you can cancel at any time before the next renewal to avoid further charges." });
      b.push({ t: "gloss", text: "Auto-renewal, refund policy, and who handles the money are the three things customers and regulators most want stated clearly here." });
    }

    if (m.data.marketing) {
      b.push({ t: "h2", text: "Communications" });
      b.push({ t: "p", text:
        "By using the Service you agree that we may send you service-related messages. If you opt in to marketing emails, you can unsubscribe at any time using the link in those emails." });
    }

    b.push({ t: "h2", text: "Termination" });
    b.push({ t: "p", text:
      "You may stop using the Service at any time. We may suspend or terminate your access if you breach these Terms or if we discontinue the Service. Provisions that by their nature should survive termination will continue to apply." });

    b.push({ t: "h2", text: "Disclaimers" });
    b.push({ t: "p", text:
      "The Service is provided “as is” and “as available” without warranties of any kind, whether express or implied, to the fullest extent permitted by law. " +
      "We do not warrant that the Service will be uninterrupted, error-free, or secure." });

    b.push({ t: "h2", text: "Limitation of Liability" });
    b.push({ t: "p", text:
      "To the fullest extent permitted by law, " + entity + " will not be liable for any indirect, incidental, special, or consequential damages, or for any loss of data, profits, or revenue, arising from your use of the Service. " +
      "Nothing in these Terms excludes liability that cannot legally be excluded." });
    b.push({ t: "gloss", text: "This caps your financial exposure if something goes wrong. Courts in some places limit how far it can go, which is why the “as permitted by law” wording matters." });

    b.push({ t: "h2", text: "Changes to These Terms" });
    b.push({ t: "p", text:
      "We may update these Terms from time to time. When we make material changes, we will update the “last updated” date and, where appropriate, notify you. Continuing to use the Service after changes take effect means you accept the new Terms." });

    b.push({ t: "h2", text: "Governing Law" });
    if (m.entity) {
      b.push({ t: "p", text:
        "These Terms are governed by the laws applicable to " + m.entity + ", without regard to conflict-of-law rules, except where mandatory consumer-protection law in your place of residence provides otherwise." });
    } else {
      b.push({ t: "p", text:
        "These Terms are governed by the laws of the jurisdiction in which the operator of the Service is established, without regard to conflict-of-law rules, except where mandatory consumer-protection law in your place of residence provides otherwise." });
      b.push({ t: "gloss", text: "Add your actual legal entity and jurisdiction in the questionnaire so this names the right courts and law." });
    }

    b.push({ t: "h2", text: "Contact" });
    b.push({ t: "p", text: "Questions about these Terms? Contact us at " + contactLine(m) + "." });

    return {
      key: "terms",
      title: "Terms of Service",
      filename: "terms-of-service",
      blocks: b
    };
  }

  /* ---------- Cookie Notice ---------- */
  function buildCookies(m) {
    var b = [];
    b.push({ t: "disclaimer", text: DISCLAIMER_TEXT });

    b.push({ t: "p", text:
      "This Cookie Notice explains how " + m.displayName + " uses cookies and similar technologies on " +
      (m.website ? m.website : "our website") + ", and how you can control them." });

    b.push({ t: "h2", text: "What Are Cookies?" });
    b.push({ t: "p", text:
      "Cookies are small text files stored on your device when you visit a website. They let the site remember your actions and preferences over time. We also use similar technologies such as local storage, which work in a comparable way." });

    b.push({ t: "h2", text: "Categories of Cookies We Use" });

    b.push({ t: "h3", text: "Strictly necessary" });
    b.push({ t: "p", text:
      "These keep the Service working — for example remembering your consent choice or keeping you signed in. They cannot be switched off, and they do not require consent." });

    if (m.data.analytics) {
      b.push({ t: "h3", text: "Analytics" });
      var analyticsTool = m.tp.ga ? "Google Analytics" : "analytics tools";
      b.push({ t: "p", text:
        "These help us understand how visitors use the Service so we can improve it, using " + analyticsTool +
        ". They are only set after you accept them in our cookie banner." });
    }

    if (m.data.marketing) {
      b.push({ t: "h3", text: "Marketing" });
      b.push({ t: "p", text:
        "These are used to measure and personalize our marketing. They are only set after you accept them in our cookie banner." });
    }

    b.push({ t: "gloss", text:
      "Necessary cookies need no consent; analytics and marketing cookies do. Keeping them in separate categories — and off until accepted — is what consent law expects." });

    b.push({ t: "h2", text: "Managing Your Choices" });
    b.push({ t: "p", text:
      "When you first visit, our consent banner lets you accept or reject non-essential cookies by category. You can change your choice at any time by reopening the banner from the link in our footer, or by clearing cookies in your browser." });
    b.push({ t: "ul", items: [
      "Use the cookie banner to accept or reject analytics and marketing cookies.",
      "Use your browser settings to block or delete cookies entirely.",
      "Note that blocking strictly necessary cookies may stop parts of the Service from working."
    ] });

    b.push({ t: "h2", text: "Changes to This Notice" });
    b.push({ t: "p", text:
      "We may update this Cookie Notice as our use of cookies changes. The “last updated” date at the top shows the current version." });

    b.push({ t: "h2", text: "Contact" });
    b.push({ t: "p", text: "Questions about our use of cookies? Contact us at " + contactLine(m) + "." });

    return {
      key: "cookies",
      title: "Cookie Notice",
      filename: "cookie-notice",
      blocks: b
    };
  }

  /* ------------------------------------------------------------------ *
   * Cookie consent banner snippet (vanilla JS, no deps).
   * Returns a plain text string of HTML+CSS+JS the user copies/pastes.
   * Categories shown adapt to the model (analytics / marketing toggles).
   * ------------------------------------------------------------------ */
  function buildBannerSnippet(m) {
    var name = m.company || "Our site";
    // Comment-safe variant: collapse any "--" so a company name containing
    // "-->" can't prematurely close the opening HTML comment in the snippet.
    var nameComment = name.replace(/-+/g, "-");
    var showAnalytics = m.data.analytics;
    var showMarketing = m.data.marketing;

    var rows = [];
    rows.push(
'      <label class="ck-row">\n' +
'        <input type="checkbox" checked disabled>\n' +
'        <span><strong>Necessary</strong> &mdash; required for the site to work. Always on.</span>\n' +
'      </label>');
    if (showAnalytics) rows.push(
'      <label class="ck-row">\n' +
'        <input type="checkbox" id="ck-analytics">\n' +
'        <span><strong>Analytics</strong> &mdash; helps us understand usage.</span>\n' +
'      </label>');
    if (showMarketing) rows.push(
'      <label class="ck-row">\n' +
'        <input type="checkbox" id="ck-marketing">\n' +
'        <span><strong>Marketing</strong> &mdash; used to personalize and measure ads.</span>\n' +
'      </label>');
    var rowsHtml = rows.join("\n");

    var setLines = ['    necessary: true'];
    if (showAnalytics) setLines.push('    analytics: !!(document.getElementById("ck-analytics") || {}).checked');
    if (showMarketing) setLines.push('    marketing: !!(document.getElementById("ck-marketing") || {}).checked');
    var consentObj = setLines.join(",\n");

    var acceptAllLines = ['    var c = { necessary: true'];
    if (showAnalytics) acceptAllLines[0] += ', analytics: true';
    if (showMarketing) acceptAllLines[0] += ', marketing: true';
    acceptAllLines[0] += ' };';

    var restoreLines = [];
    if (showAnalytics) restoreLines.push('      var a = document.getElementById("ck-analytics"); if (a) a.checked = !!saved.analytics;');
    if (showMarketing) restoreLines.push('      var mk = document.getElementById("ck-marketing"); if (mk) mk.checked = !!saved.marketing;');
    var restoreBlock = restoreLines.length ? "\n" + restoreLines.join("\n") : "";

    return (
'<!-- ===== ' + nameComment + ' cookie consent banner =====\n' +
'     Self-contained: no libraries, no network calls. Paste this whole block\n' +
'     just before your closing </body> tag. The visitor\'s choice is stored in\n' +
'     localStorage under "cookie_consent". Check window.cookieConsent (or read\n' +
'     localStorage) before loading analytics or marketing scripts. Generated by\n' +
'     ComplyKit — review with a lawyer before relying on it. ============= -->\n' +
'<div id="cookie-banner" class="cookie-banner" role="dialog" aria-modal="false"\n' +
'     aria-labelledby="cookie-banner-title" aria-describedby="cookie-banner-desc" hidden>\n' +
'  <div class="cookie-inner">\n' +
'    <h2 id="cookie-banner-title" class="cookie-title">Cookies on ' + esc(name) + '</h2>\n' +
'    <p id="cookie-banner-desc" class="cookie-desc">\n' +
'      We use necessary cookies to make this site work. With your permission we also\n' +
'      use optional cookies as described below. You can change your choice at any time.\n' +
'    </p>\n' +
'    <div class="cookie-options">\n' +
rowsHtml + '\n' +
'    </div>\n' +
'    <div class="cookie-actions">\n' +
'      <button type="button" id="cookie-reject" class="cookie-btn cookie-btn-reject">Reject optional</button>\n' +
'      <button type="button" id="cookie-save" class="cookie-btn cookie-btn-ghost">Save choices</button>\n' +
'      <button type="button" id="cookie-accept" class="cookie-btn cookie-btn-primary">Accept all</button>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'\n' +
'<style>\n' +
'  .cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;\n' +
'    background:#fff;color:#14181f;border-top:1px solid #e9e3d8;\n' +
'    box-shadow:0 -8px 30px -12px rgba(20,24,31,.25);\n' +
'    font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}\n' +
'  .cookie-banner[hidden]{display:none}\n' +
'  .cookie-inner{max-width:760px;margin:0 auto;padding:18px 20px}\n' +
'  .cookie-title{font-size:17px;font-weight:700;margin:0 0 6px}\n' +
'  .cookie-desc{font-size:14px;color:#665f54;margin:0 0 12px}\n' +
'  .cookie-options{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}\n' +
'  .ck-row{display:flex;align-items:flex-start;gap:9px;font-size:14px;color:#2c2f36}\n' +
'  .ck-row input{margin-top:3px;width:17px;height:17px;flex:0 0 auto;accent-color:#bf6b3c}\n' +
'  .cookie-actions{display:flex;gap:10px;flex-wrap:wrap}\n' +
'  .cookie-btn{font:inherit;font-size:14px;font-weight:700;border-radius:9px;\n' +
'    padding:9px 16px;cursor:pointer;border:1.5px solid #e9e3d8;background:#fff;color:#14181f}\n' +
'  .cookie-btn-ghost:hover{border-color:#13525a;background:#e3eeef}\n' +
'  /* Reject is as prominent as Accept: solid ink button, distinct from the neutral ghost. */\n' +
'  .cookie-btn-reject{background:#14181f;border-color:#14181f;color:#fff}\n' +
'  .cookie-btn-reject:hover{background:#000;border-color:#000}\n' +
'  .cookie-btn-primary{background:#bf6b3c;border-color:#bf6b3c;color:#fff}\n' +
'  .cookie-btn-primary:hover{background:#8f4a22;border-color:#8f4a22}\n' +
'  .cookie-btn:focus-visible{outline:3px solid #13525a;outline-offset:2px}\n' +
'  @media (max-width:520px){.cookie-actions{flex-direction:column}.cookie-btn{width:100%}}\n' +
'</style>\n' +
'\n' +
'<script>\n' +
'(function () {\n' +
'  "use strict";\n' +
'  var KEY = "cookie_consent";\n' +
'  var banner = document.getElementById("cookie-banner");\n' +
'  if (!banner) return;\n' +
'\n' +
'  function read() {\n' +
'    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }\n' +
'  }\n' +
'  function write(consent) {\n' +
'    consent.timestamp = new Date().toISOString();\n' +
'    try { localStorage.setItem(KEY, JSON.stringify(consent)); } catch (e) {}\n' +
'    window.cookieConsent = consent;\n' +
'    // Let your own scripts react, e.g. load analytics only after consent.\n' +
'    try {\n' +
'      document.dispatchEvent(new CustomEvent("cookieconsent", { detail: consent }));\n' +
'    } catch (e) {}\n' +
'  }\n' +
'  function hide() { banner.hidden = true; }\n' +
'  function show() { banner.hidden = false; }\n' +
'\n' +
'  function currentSelection() {\n' +
'    return {\n' +
consentObj + '\n' +
'    };\n' +
'  }\n' +
'\n' +
'  var accept = document.getElementById("cookie-accept");\n' +
'  var reject = document.getElementById("cookie-reject");\n' +
'  var save = document.getElementById("cookie-save");\n' +
'\n' +
'  if (accept) accept.addEventListener("click", function () {\n' +
acceptAllLines[0] + '\n' +
'    write(c); hide();\n' +
'  });\n' +
'  if (reject) reject.addEventListener("click", function () {\n' +
'    write({ necessary: true' + (showAnalytics ? ', analytics: false' : '') + (showMarketing ? ', marketing: false' : '') + ' }); hide();\n' +
'  });\n' +
'  if (save) save.addEventListener("click", function () {\n' +
'    write(currentSelection()); hide();\n' +
'  });\n' +
'\n' +
'  // Expose a helper to reopen the banner (wire this to a "Cookie settings" link).\n' +
'  window.openCookieSettings = function () {\n' +
'    var saved = read() || {};' + restoreBlock + '\n' +
'    show();\n' +
'  };\n' +
'\n' +
'  var saved = read();\n' +
'  if (saved && saved.necessary) {\n' +
'    window.cookieConsent = saved; // already chosen; keep banner hidden\n' +
'  } else {\n' +
'    show(); // first visit: ask for consent\n' +
'  }\n' +
'})();\n' +
'<\/script>'
    );
  }

  /* ------------------------------------------------------------------ *
   * Renderers
   * ------------------------------------------------------------------ */

  // Empty-state shown before the user has entered enough to generate.
  function renderEmpty(pane, msg) {
    pane.textContent = "";
    var wrap = el("div", "doc-empty");
    var icon = el("div", "de-icon");
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>';
    wrap.appendChild(icon);
    wrap.appendChild(el("h3", null, "Your documents appear here"));
    wrap.appendChild(el("p", null, msg));
    pane.appendChild(wrap);
  }

  // Render one document's block tree into a preview pane (safe DOM only).
  function renderDocToPane(doc, m, pane) {
    pane.textContent = "";

    pane.appendChild(el("h1", "doc-title", doc.title + " for " + m.displayName));
    pane.appendChild(el("p", "doc-meta",
      "Last updated " + m.dateLong + "  ·  Version " + m.version));

    for (var i = 0; i < doc.blocks.length; i++) {
      var blk = doc.blocks[i];
      switch (blk.t) {
        case "disclaimer":
          var dis = el("div", "doc-disclaimer");
          dis.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
          var disText = el("div");
          disText.appendChild(el("strong", null, "Template, not legal advice. "));
          disText.appendChild(document.createTextNode(blk.text));
          dis.appendChild(disText);
          pane.appendChild(dis);
          break;
        case "h2":
          pane.appendChild(el("h2", "clause-h", blk.text));
          break;
        case "h3":
          pane.appendChild(el("h3", "clause-sub", blk.text));
          break;
        case "p":
          pane.appendChild(linkifyP(blk.text));
          break;
        case "ul":
        case "ol":
          var list = el(blk.t === "ul" ? "ul" : "ol");
          for (var j = 0; j < blk.items.length; j++) {
            list.appendChild(linkifyLi(blk.items[j]));
          }
          pane.appendChild(list);
          break;
        case "gloss":
          var g = el("div", "gloss");
          g.appendChild(el("span", "gloss-label", "What this means"));
          g.appendChild(el("p", null, blk.text));
          pane.appendChild(g);
          break;
      }
    }
  }

  // Turn URLs in a plain-text string into safe <a> nodes inside a <p>.
  function linkifyInto(parent, text) {
    var re = /(https?:\/\/[^\s)]+)/g;
    var last = 0, mm;
    while ((mm = re.exec(text)) !== null) {
      if (mm.index > last) parent.appendChild(document.createTextNode(text.slice(last, mm.index)));
      var a = el("a", null, mm[1]);
      a.href = mm[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      parent.appendChild(a);
      last = mm.index + mm[1].length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function linkifyP(text) { var p = el("p"); linkifyInto(p, text); return p; }
  function linkifyLi(text) { var li = el("li"); linkifyInto(li, text); return li; }

  // Render the banner-snippet pane.
  function renderBannerPane(m, pane, snippet) {
    pane.textContent = "";
    pane.appendChild(el("h1", "doc-title", "Cookie-consent banner"));
    pane.appendChild(el("p", "snippet-intro",
      "Paste this self-contained block just before your closing </body> tag. No libraries, no network calls. It stores the visitor’s choice in localStorage and dispatches a “cookieconsent” event so your scripts can load analytics or marketing tags only after consent."));

    var dis = el("div", "doc-disclaimer");
    dis.appendChild(el("strong", null, "Template, not legal advice. "));
    dis.appendChild(document.createTextNode("Make sure non-essential scripts actually wait for consent before they run."));
    pane.appendChild(dis);

    var pre = el("pre", "code-block");
    pre.textContent = snippet; // safe: textContent, never executed here
    pane.appendChild(pre);

    pane.appendChild(el("p", "snippet-note",
      "Wire your own tags to the result: check window.cookieConsent.analytics (or listen for the “cookieconsent” event) before loading Google Analytics, and check window.cookieConsent.marketing before loading marketing pixels. Add a “Cookie settings” link that calls window.openCookieSettings() so visitors can change their mind."));
  }

  /* ------------------------------------------------------------------ *
   * Export builders: HTML / Markdown / Plain text from a doc block tree.
   * ------------------------------------------------------------------ */
  function blocksToHTML(doc, m) {
    var out = [];
    out.push("<!doctype html>");
    out.push('<html lang="en">');
    out.push("<head>");
    out.push('<meta charset="utf-8">');
    out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    out.push("<title>" + esc(doc.title) + " — " + esc(m.displayName) + "</title>");
    out.push("<style>body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14181f}h1{font-size:28px}h2{font-size:20px;margin-top:32px}h3{font-size:16px;margin-top:20px}.meta{color:#777;font-size:14px}.disclaimer{background:#f9f0dd;border:1px solid #ecd9b3;border-radius:8px;padding:12px 16px;font-size:14px;color:#6b5012}.gloss{background:#e3eeef;border-left:3px solid #13525a;border-radius:0 8px 8px 0;padding:10px 14px;font-size:14px;color:#1c3c40;margin:8px 0 16px}.gloss .lbl{font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.05em;display:block;margin-bottom:3px}a{color:#8f4a22}</style>");
    out.push("</head>");
    out.push("<body>");
    out.push("<h1>" + esc(doc.title) + " for " + esc(m.displayName) + "</h1>");
    out.push('<p class="meta">Last updated ' + esc(m.dateLong) + " &middot; Version " + esc(m.version) + "</p>");

    for (var i = 0; i < doc.blocks.length; i++) {
      var blk = doc.blocks[i];
      switch (blk.t) {
        case "disclaimer":
          out.push('<p class="disclaimer"><strong>Template, not legal advice.</strong> ' + linkifyHtml(blk.text) + "</p>");
          break;
        case "h2": out.push("<h2>" + esc(blk.text) + "</h2>"); break;
        case "h3": out.push("<h3>" + esc(blk.text) + "</h3>"); break;
        case "p": out.push("<p>" + linkifyHtml(blk.text) + "</p>"); break;
        case "ul":
        case "ol":
          out.push("<" + blk.t + ">");
          for (var j = 0; j < blk.items.length; j++) out.push("<li>" + linkifyHtml(blk.items[j]) + "</li>");
          out.push("</" + blk.t + ">");
          break;
        case "gloss":
          out.push('<div class="gloss"><span class="lbl">What this means</span>' + linkifyHtml(blk.text) + "</div>");
          break;
      }
    }
    out.push("</body>");
    out.push("</html>");
    out.push("");
    return out.join("\n");
  }

  // Escape text then turn URLs into anchors (for the HTML export).
  function linkifyHtml(text) {
    var escaped = esc(text);
    return escaped.replace(/(https?:\/\/[^\s)<]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>";
    });
  }

  function blocksToMarkdown(doc, m) {
    var out = [];
    out.push("# " + doc.title + " for " + m.displayName);
    out.push("");
    out.push("_Last updated " + m.dateLong + " · Version " + m.version + "_");
    out.push("");
    for (var i = 0; i < doc.blocks.length; i++) {
      var blk = doc.blocks[i];
      switch (blk.t) {
        case "disclaimer":
          out.push("> **Template, not legal advice.** " + blk.text);
          out.push("");
          break;
        case "h2": out.push("## " + blk.text); out.push(""); break;
        case "h3": out.push("### " + blk.text); out.push(""); break;
        case "p": out.push(blk.text); out.push(""); break;
        case "ul":
          for (var j = 0; j < blk.items.length; j++) out.push("- " + blk.items[j]);
          out.push("");
          break;
        case "ol":
          for (var k = 0; k < blk.items.length; k++) out.push((k + 1) + ". " + blk.items[k]);
          out.push("");
          break;
        case "gloss":
          out.push("> **What this means:** " + blk.text);
          out.push("");
          break;
      }
    }
    return out.join("\n");
  }

  function blocksToText(doc, m) {
    var out = [];
    out.push(doc.title.toUpperCase() + " FOR " + m.displayName.toUpperCase());
    out.push("Last updated " + m.dateLong + "  |  Version " + m.version);
    out.push("");
    for (var i = 0; i < doc.blocks.length; i++) {
      var blk = doc.blocks[i];
      switch (blk.t) {
        case "disclaimer":
          out.push("[TEMPLATE, NOT LEGAL ADVICE] " + blk.text);
          out.push("");
          break;
        case "h2":
          out.push("");
          out.push(blk.text.toUpperCase());
          out.push(repeat("-", blk.text.length));
          break;
        case "h3": out.push(""); out.push(blk.text); break;
        case "p": out.push(wrap(blk.text)); out.push(""); break;
        case "ul":
          for (var j = 0; j < blk.items.length; j++) out.push("  * " + blk.items[j]);
          out.push("");
          break;
        case "ol":
          for (var k = 0; k < blk.items.length; k++) out.push("  " + (k + 1) + ". " + blk.items[k]);
          out.push("");
          break;
        case "gloss":
          out.push("  >> WHAT THIS MEANS: " + blk.text);
          out.push("");
          break;
      }
    }
    return out.join("\n");
  }

  function repeat(ch, n) { var s = ""; for (var i = 0; i < n; i++) s += ch; return s; }
  function wrap(text) {
    // Simple 78-col word wrap for the plain-text export.
    var words = text.split(/\s+/), line = "", out = [];
    for (var i = 0; i < words.length; i++) {
      if ((line + " " + words[i]).trim().length > 78) { out.push(line.trim()); line = words[i]; }
      else line += " " + words[i];
    }
    if (line.trim()) out.push(line.trim());
    return out.join("\n");
  }

  /* ------------------------------------------------------------------ *
   * Download helper (Blob + object URL; local only, no network).
   * ------------------------------------------------------------------ */
  function download(filename, mime, content) {
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    } catch (e) {
      // no-op: nothing else to fall back to without a network
    }
  }

  function copyText(text, btn) {
    function done(ok) {
      if (!btn) return;
      btn.classList.toggle("copied", ok);
      setTimeout(function () { btn.classList.remove("copied"); }, 1700);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      done(!!ok);
    } catch (e) { done(false); }
  }

  /* ------------------------------------------------------------------ *
   * Wire-up
   * ------------------------------------------------------------------ */
  function init() {
    var form = $("builder-form");
    if (!form) return;

    var panes = {
      privacy: $("panel-privacy"),
      terms: $("panel-terms"),
      cookies: $("panel-cookies"),
      banner: $("panel-banner")
    };
    var tabs = {
      privacy: $("tab-privacy"),
      terms: $("tab-terms"),
      cookies: $("tab-cookies"),
      banner: $("tab-banner")
    };
    var tabOrder = ["privacy", "terms", "cookies", "banner"];
    var docNames = { privacy: "Privacy Policy", terms: "Terms of Service", cookies: "Cookie Notice", banner: "Banner Snippet" };
    var live = $("builder-status");
    var exportDocName = $("export-doc-name");

    var current = { privacy: null, terms: null, cookies: null, bannerSnippet: "" };
    var activeKey = "privacy";

    function regenerate() {
      var m = readModel();
      current.model = m;
      current.privacy = buildPrivacy(m);
      current.terms = buildTerms(m);
      current.cookies = buildCookies(m);
      current.bannerSnippet = buildBannerSnippet(m);

      if (!m.hasContact) {
        renderEmpty(panes.privacy, "Enter your company or app name above and the privacy policy will build itself, clause by clause, as you answer.");
        renderEmpty(panes.terms, "Enter your company or app name above to generate your terms of service.");
        renderEmpty(panes.cookies, "Enter your company or app name above to generate your cookie notice.");
      } else {
        renderDocToPane(current.privacy, m, panes.privacy);
        renderDocToPane(current.terms, m, panes.terms);
        renderDocToPane(current.cookies, m, panes.cookies);
      }
      renderBannerPane(m, panes.banner, current.bannerSnippet);
    }

    function activate(key) {
      activeKey = key;
      tabOrder.forEach(function (k) {
        var isActive = k === key;
        tabs[k].classList.toggle("is-active", isActive);
        tabs[k].setAttribute("aria-selected", isActive ? "true" : "false");
        tabs[k].tabIndex = isActive ? 0 : -1;
        panes[k].hidden = !isActive;
      });
      if (exportDocName) exportDocName.textContent = docNames[key];
    }

    // Tab clicks + roving-tabindex keyboard nav.
    tabOrder.forEach(function (k, idx) {
      tabs[k].addEventListener("click", function () { activate(k); });
      tabs[k].addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabOrder[(idx + 1) % tabOrder.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length];
        else if (e.key === "Home") next = tabOrder[0];
        else if (e.key === "End") next = tabOrder[tabOrder.length - 1];
        if (next) { e.preventDefault(); activate(next); tabs[next].focus(); }
      });
    });

    // Export buttons.
    function currentExport(kind) {
      var m = current.model || readModel();
      if (activeKey === "banner") {
        // The banner pane only meaningfully exports its snippet.
        if (kind === "copy-html" || kind === "html") return { name: "cookie-banner.html", mime: "text/html", text: current.bannerSnippet };
        if (kind === "md") return { name: "cookie-banner.md", mime: "text/markdown", text: "```html\n" + current.bannerSnippet + "\n```\n" };
        return { name: "cookie-banner.txt", mime: "text/plain", text: current.bannerSnippet };
      }
      var doc = current[activeKey];
      if (!doc) return null;
      if (kind === "copy-html" || kind === "html") return { name: doc.filename + ".html", mime: "text/html", text: blocksToHTML(doc, m) };
      if (kind === "md") return { name: doc.filename + ".md", mime: "text/markdown", text: blocksToMarkdown(doc, m) };
      return { name: doc.filename + ".txt", mime: "text/plain", text: blocksToText(doc, m) };
    }

    var exportBtns = document.querySelectorAll(".exp-btn");
    Array.prototype.forEach.call(exportBtns, function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-export");
        var ex = currentExport(kind);
        if (!ex) {
          if (live) live.textContent = "Enter your company name first to export.";
          return;
        }
        if (kind === "copy-html") {
          copyText(ex.text, btn);
          if (live) live.textContent = docNames[activeKey] + " HTML copied to clipboard.";
        } else {
          download(ex.name, ex.mime, ex.text);
          if (live) live.textContent = "Downloaded " + ex.name + ".";
        }
      });
    });

    // Live regeneration on any input change.
    form.addEventListener("input", regenerate);
    form.addEventListener("change", regenerate);

    // Example data.
    var exampleBtn = $("example-btn");
    if (exampleBtn) exampleBtn.addEventListener("click", function () {
      setVal("company", "Acme Labs");
      setVal("website", "https://acme.example");
      setVal("email", "privacy@acme.example");
      setVal("entity", "Acme Labs Ltd, Ireland");
      setVal("minage", "16");
      setCheck("d-analytics", true);
      setCheck("d-cookies", true);
      setCheck("d-accounts", true);
      setCheck("d-payments", true);
      setCheck("d-location", false);
      setCheck("d-marketing", true);
      setCheck("t-ga", true);
      setCheck("t-stripe", true);
      setCheck("t-vercel", true);
      setCheck("t-cloudflare", false);
      setCheck("t-email", true);
      setCheck("r-eu", true);
      setCheck("r-ca", true);
      setCheck("r-global", true);
      regenerate();
      if (live) live.textContent = "Loaded an example. Edit any field to see the documents update.";
    });

    // Reset.
    var resetBtn = $("reset-btn");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      form.reset();
      // form.reset restores the selected option default (16); re-sync explicitly.
      setVal("minage", "16");
      regenerate();
      activate("privacy");
      if (live) live.textContent = "Cleared. Start entering your details.";
    });

    function setVal(id, v) { var n = $(id); if (n) n.value = v; }
    function setCheck(id, v) { var n = $(id); if (n) n.checked = v; }

    // Initial render.
    activate("privacy");
    regenerate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
