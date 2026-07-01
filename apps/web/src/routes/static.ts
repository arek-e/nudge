import type { Handler, Hono } from "hono";
import { type ObservabilityHonoEnv, wideEventFields } from "../observability";

const vestaAppIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="vesta-app-icon-title vesta-app-icon-desc"><title id="vesta-app-icon-title">Vesta app icon</title><desc id="vesta-app-icon-desc">A Vesta ember mark on a warm rounded square background.</desc><rect width="256" height="256" rx="46" fill="#f7f3ec"/><g transform="translate(-59.6519,-31.2324)"><g transform="matrix(1.7664652,0,0,1.7664652,-71.621554,-202.73348)"><path fill="#ec5c29" d="m 142.28728,226.43281 c -10.75786,-1.65243 -19.76579,-8.03254 -24.00309,-17.00074 -7.70875,-16.31563 -1.24475,-36.24872 20.656,-63.6971 5.20129,-6.51882 6.59975,-7.57737 9.16122,-6.93447 2.73501,0.68642 15.71807,16.93672 21.7567,27.23174 6.88418,11.73665 9.63779,20.15238 9.65419,29.50574 0.0153,9.32262 -2.72836,16.44328 -8.60225,22.31718 -6.64934,6.64931 -18.34955,10.15563 -28.62277,8.57765 z m 9.09811,-22.98888 c 1.90984,-3.58676 7.20067,-8.59374 10.97361,-10.38504 1.67301,-0.79429 3.03758,-1.58435 3.03237,-1.7557 -0.005,-0.17131 -1.34262,-0.96572 -2.97204,-1.76536 -1.62944,-0.7996 -4.21751,-2.52646 -5.7512,-3.83742 -3.03812,-2.59692 -7.31858,-9.2707 -8.48945,-13.23614 -0.73758,-2.49807 -0.73758,-2.49807 -1.51429,0.0944 -2.04619,6.82961 -7.46369,13.38649 -13.89051,16.81196 -3.76852,2.0086 -3.76852,2.0086 -0.13335,3.82512 6.30673,3.15148 11.68431,9.44269 13.79505,16.13873 1.01301,3.21363 1.01301,3.21363 2.26196,0.0123 0.68692,-1.76052 1.89645,-4.41694 2.68783,-5.90312 z"/><path fill="#1a2735" d="M 140.45499,269.46764 C 126.39094,267.82602 112.96308,261.27256 102.65393,251.01878 91.628734,240.0528 86.86117,228.34638 90.81498,221.949 c 2.390285,-3.86756 10.35281,-6.28197 15.31574,-4.64408 2.61587,0.86334 4.34686,2.74647 7.97774,8.67902 8.43887,13.78838 22.77383,20.86376 38.11263,18.81146 13.01947,-1.74199 22.24538,-7.92339 29.62347,-19.84789 4.11421,-6.64942 5.47747,-7.73236 10.16017,-8.07106 6.89037,-0.4984 12.69387,2.875 13.64217,7.92973 0.551,2.93718 -0.46786,6.99066 -3.04189,12.102 -5.66521,11.24964 -15.36721,20.51956 -27.78756,26.55015 -7.0529,3.42446 -12.96856,5.14882 -20.63088,6.01366 -6.05296,0.68317 -7.84625,0.6826 -13.73158,-0.005 z"/></g></g></svg>`;

export function registerStaticRoutes(app: Hono<ObservabilityHonoEnv>) {
  const versionHandler: Handler<ObservabilityHonoEnv> = (c) => {
    return c.json({
      service: "vesta-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  };

  app.get("/api/version", wideEventFields({ routeName: "api.version" }), versionHandler);
  app.get("/api/version/", wideEventFields({ routeName: "api.version" }), versionHandler);

  app.get("/manifest.webmanifest", wideEventFields({ routeName: "manifest" }), (c) => {
    return c.json({
      name: "Vesta",
      short_name: "Vesta",
      description: "A private daily operating loop for personal context and follow-through.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      background_color: "#1a2735",
      theme_color: "#1a2735",
      categories: ["productivity", "lifestyle"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
      shortcuts: [
        {
          name: "Today",
          short_name: "Today",
          description: "Open today's operating loop.",
          url: "/",
          icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
        },
      ],
    });
  });

  app.get("/offline.html", wideEventFields({ routeName: "pwa.offline" }), (c) => {
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a2735" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Vesta" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>Vesta Offline</title>
  </head>
  <body><main><p>Vesta</p><h1>You are offline</h1><p>Reconnect to sync your daily operating loop and talk to Vesta.</p></main></body>
</html>`);
  });

  app.get("/icons/icon.svg", wideEventFields({ routeName: "pwa.icon" }), (c) => {
    c.header("content-type", "image/svg+xml; charset=utf-8");
    return c.body(vestaAppIconSvg);
  });

  app.get("/", wideEventFields({ routeName: "today" }), (c) => {
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a2735" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Vesta" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>Vesta Daily Operating Loop</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0d1117;
        color: #f4efe8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(236, 92, 41, 0.24), transparent 30rem),
          linear-gradient(180deg, #1a2735 0%, #0d1117 52%, #080a0f 100%);
      }
      main {
        width: min(100%, 44rem);
        margin: 0 auto;
        padding: max(1rem, env(safe-area-inset-top)) 1rem max(2rem, env(safe-area-inset-bottom));
      }
      header {
        padding: 1.5rem 0 1rem;
      }
      .eyebrow {
        margin: 0 0 0.5rem;
        color: #ec5c29;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.3rem, 13vw, 4.8rem);
        line-height: 0.9;
        letter-spacing: -0.08em;
      }
      .summary {
        margin: 1rem 0 0;
        color: #c9d1d9;
        font-size: 1.05rem;
        line-height: 1.55;
      }
      .card {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(244, 239, 232, 0.14);
        border-radius: 1.5rem;
        background: rgba(13, 17, 23, 0.72);
        box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(18px);
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 750;
      }
      textarea {
        width: 100%;
        min-height: 9rem;
        resize: vertical;
        border: 1px solid rgba(244, 239, 232, 0.18);
        border-radius: 1rem;
        padding: 0.9rem;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font: inherit;
        line-height: 1.45;
      }
      button, a.button {
        display: inline-flex;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        padding: 0 1rem;
        background: #ec5c29;
        color: #1a2735;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        margin-top: 0.9rem;
      }
      .secondary {
        background: rgba(244, 239, 232, 0.1) !important;
        color: #f4efe8 !important;
      }
      #status {
        min-height: 1.5rem;
        margin: 0.85rem 0 0;
        color: #c9d1d9;
      }
      #proposal-status {
        min-height: 1.5rem;
        margin: 0.85rem 0 0;
        color: #c9d1d9;
      }
      ul {
        display: grid;
        gap: 0.75rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        border: 1px solid rgba(244, 239, 232, 0.1);
        border-radius: 1rem;
        padding: 0.85rem;
        background: rgba(255, 255, 255, 0.04);
      }
      .event-type {
        color: #ec5c29;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .event-note {
        margin-top: 0.35rem;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .proposal-title {
        margin: 0;
        font-size: 1rem;
      }
      .proposal-body, .proposal-rationale {
        margin: 0.45rem 0 0;
        color: #c9d1d9;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .proposal-rationale {
        font-size: 0.9rem;
      }
      @media (min-width: 40rem) {
        main { padding-inline: 1.5rem; }
        .actions { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Vesta</p>
        <h1>Daily Operating Loop</h1>
        <p class="summary">Your private operating layer for what changed, what matters now, and what Vesta should remember before it helps you act.</p>
      </header>

      <section class="card" aria-labelledby="today-title">
        <p class="eyebrow">Today</p>
        <h2 id="today-title">Start with the current state</h2>
        <p class="summary">Capture priorities, constraints, energy, and follow-ups. Vesta stores this as user-owned context for the Daily Operating Loop.</p>
      </section>

      <section class="card" aria-labelledby="check-in-title">
        <h2 id="check-in-title">Morning check-in</h2>
        <form id="check-in-form">
          <label for="note">What should Vesta know this morning?</label>
          <textarea id="note" name="note" autocomplete="off" placeholder="Priorities, energy, constraints, people to follow up with..."></textarea>
          <div class="actions">
            <button type="submit">Save check-in</button>
            <a class="button secondary" href="/api/docs">API docs</a>
          </div>
          <p id="status" role="status"></p>
        </form>
      </section>

      <section class="card" aria-labelledby="proposals-title">
        <h2 id="proposals-title">Agent proposals</h2>
        <ul id="proposals"><li>Loading proposals...</li></ul>
        <p id="proposal-status" role="status"></p>
      </section>

      <section class="card" aria-labelledby="events-title">
        <h2 id="events-title">Recent events</h2>
        <ul id="events"><li>Loading events...</li></ul>
      </section>
    </main>
    <script>
      const form = document.querySelector('#check-in-form');
      const note = document.querySelector('#note');
      const status = document.querySelector('#status');
      const events = document.querySelector('#events');
      const proposals = document.querySelector('#proposals');
      const proposalStatus = document.querySelector('#proposal-status');

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        });
      }

      async function loadEvents() {
        const response = await fetch('/api/events');
        const body = await response.json();
        events.innerHTML = '';
        if (!body.events.length) {
          events.innerHTML = '<li>No events yet. Save the first check-in.</li>';
          return;
        }
        for (const event of body.events) {
          const item = document.createElement('li');
          const text = event.payload && typeof event.payload.note === 'string' ? event.payload.note : JSON.stringify(event.payload);
          item.innerHTML = '<div class="event-type"></div><div class="event-note"></div>';
          item.querySelector('.event-type').textContent = event.type;
          item.querySelector('.event-note').textContent = text;
          events.append(item);
        }
      }

      async function loadProposals() {
        const response = await fetch('/api/proposals');
        const body = await response.json();
        proposals.innerHTML = '';
        if (!body.proposals.length) {
          proposals.innerHTML = '<li>No proposals waiting for review.</li>';
          return;
        }
        for (const proposal of body.proposals) {
          const item = document.createElement('li');
          item.innerHTML = [
            '<h3 class="proposal-title"></h3>',
            '<p class="proposal-body"></p>',
            '<p class="proposal-rationale"></p>',
            '<div class="actions">',
            '<button type="button" data-decision="accepted">Accept</button>',
            '<button class="secondary" type="button" data-decision="rejected">Reject</button>',
            '</div>',
          ].join('');
          item.querySelector('.proposal-title').textContent = proposal.title;
          item.querySelector('.proposal-body').textContent = proposal.body;
          item.querySelector('.proposal-rationale').textContent = proposal.rationale;
          for (const button of item.querySelectorAll('button')) {
            button.addEventListener('click', () => reviewProposal(proposal.id, button.dataset.decision));
          }
          proposals.append(item);
        }
      }

      async function reviewProposal(proposalId, decision) {
        proposalStatus.textContent = 'Saving review...';
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ proposalId, decision }),
        });
        if (!response.ok) {
          proposalStatus.textContent = 'Could not save review. Check the deployment logs.';
          return;
        }
        proposalStatus.textContent = 'Review saved.';
        await loadProposals();
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Saving...';
        const value = note.value.trim();
        if (!value) {
          status.textContent = 'Write a short check-in first.';
          return;
        }
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'manual_check_in_submitted',
            source: 'today_app',
            occurredAt: new Date().toISOString(),
            schemaVersion: 1,
            payload: { note: value },
          }),
        });
        if (!response.ok) {
          status.textContent = 'Could not save. Check the deployment logs.';
          return;
        }
        note.value = '';
        status.textContent = 'Saved. This is now in the user-owned event log.';
        await loadEvents();
      });

      loadEvents().catch(() => {
        events.innerHTML = '<li>Could not load events. Check the deployment logs.</li>';
      });
      loadProposals().catch(() => {
        proposals.innerHTML = '<li>Could not load proposals. Check the deployment logs.</li>';
      });
    </script>
  </body>
</html>`);
  });

  app.get("/health", wideEventFields({ routeName: "health" }), (c) => {
    const env = c.env;

    return c.json({
      ok: true,
      service: "vesta-web",
      environment: env.ENVIRONMENT ?? "unknown",
      version: env.APP_VERSION ?? "0.0.0",
      bindings: {
        d1: Boolean(env.DB),
        dailyDigestWorkflow: Boolean(env.DAILY_DIGEST_WORKFLOW),
        userAgentSession: Boolean(env.USER_AGENT_SESSION),
      },
    });
  });

  app.get("/__test/error", wideEventFields({ routeName: "test.error" }), (c) => {
    if (c.env.ENVIRONMENT !== "test") {
      return c.notFound();
    }

    if (c.req.query("kind") === "transient") {
      throw new Error("D1_ERROR: database is locked");
    }
    throw new Error("test failure");
  });
}
