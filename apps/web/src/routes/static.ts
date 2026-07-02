import type { Handler, Hono } from "hono";
import { type ObservabilityHonoEnv, wideEventFields } from "../observability";

const nudgeAppIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="nudge-app-icon-title nudge-app-icon-desc"><title id="nudge-app-icon-title">Nudge app icon</title><desc id="nudge-app-icon-desc">A rounded orange N mark on a warm background.</desc><rect width="256" height="256" fill="#fffaf6"/><path fill="#f14f23" d="M79.6 28.4c-24.9 0-38.4 20.7-37.2 54.6.7 21.1 4.8 31.1-3.6 59.8-9.3 31.8.2 63.8 27.1 75 26.2 10.9 46.6-3.8 43.6-32.3-1.4-13.5 2-23.5 11.7-23.8 8.6-.3 15.2 11.1 24.2 25.5 14.2 22.8 31.4 34.8 56.7 31.9 25.8-2.9 37.1-24.7 33.3-57.2-3-26.1-3.3-42.4.9-66.1 6.7-38.3-9.4-67.2-37.1-67.5-25.5-.3-39.5 18.8-39.9 51.3-.3 21.4-5.1 33.7-14.5 35.2-10.1 1.7-18-11.9-27.8-31.1-15.3-29.9-20.6-55.3-37.4-55.3Z"/></svg>`;
const nudgeFaviconVersion = "nudge";

export function registerStaticRoutes(app: Hono<ObservabilityHonoEnv>) {
  const versionHandler: Handler<ObservabilityHonoEnv> = (c) => {
    return c.json({
      service: "nudge-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  };

  app.get("/api/version", wideEventFields({ routeName: "api.version" }), versionHandler);
  app.get("/api/version/", wideEventFields({ routeName: "api.version" }), versionHandler);

  app.get("/manifest.webmanifest", wideEventFields({ routeName: "manifest" }), (c) => {
    return c.json({
      name: "Nudge",
      short_name: "Nudge",
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
          src: "/icons/nudge-app-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/nudge-app-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/nudge-app-icon.svg",
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
          icons: [{ src: "/icons/nudge-app-icon-192.png", sizes: "192x192", type: "image/png" }],
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
    <meta name="apple-mobile-web-app-title" content="Nudge" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico?v=${nudgeFaviconVersion}" sizes="any" />
    <link rel="icon" href="/icons/nudge-app-icon.svg?v=${nudgeFaviconVersion}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/nudge-apple-touch-icon.png" />
    <title>Nudge Offline</title>
  </head>
  <body><main><p>Nudge</p><h1>You are offline</h1><p>Reconnect to sync your daily operating loop and talk to Nudge.</p></main></body>
</html>`);
  });

  app.get("/icons/icon.svg", wideEventFields({ routeName: "pwa.icon" }), (c) => {
    c.header("content-type", "image/svg+xml; charset=utf-8");
    return c.body(nudgeAppIconSvg);
  });
  app.get("/icons/nudge-app-icon.svg", wideEventFields({ routeName: "pwa.icon.nudge" }), (c) => {
    c.header("content-type", "image/svg+xml; charset=utf-8");
    return c.body(nudgeAppIconSvg);
  });

  app.get("/", wideEventFields({ routeName: "today" }), (c) => {
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a2735" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Nudge" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico?v=${nudgeFaviconVersion}" sizes="any" />
    <link rel="icon" href="/icons/nudge-app-icon.svg?v=${nudgeFaviconVersion}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/nudge-apple-touch-icon.png" />
    <title>Nudge Daily Operating Loop</title>
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
        <p class="eyebrow">Nudge</p>
        <h1>Daily Operating Loop</h1>
        <p class="summary">Your private operating layer for what changed, what matters now, and what Nudge should remember before it helps you act.</p>
      </header>

      <section class="card" aria-labelledby="today-title">
        <p class="eyebrow">Today</p>
        <h2 id="today-title">Start with the current state</h2>
        <p class="summary">Capture priorities, constraints, energy, and follow-ups. Nudge stores this as user-owned context for the Daily Operating Loop.</p>
      </section>

      <section class="card" aria-labelledby="check-in-title">
        <h2 id="check-in-title">Morning check-in</h2>
        <form id="check-in-form">
          <label for="note">What should Nudge know this morning?</label>
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
    const convexConfigured = Boolean(env.CONVEX_URL && env.CONVEX_RUNTIME_SECRET);

    return c.json(
      {
        ok: convexConfigured,
        service: "nudge-web",
        environment: env.ENVIRONMENT ?? "unknown",
        version: env.APP_VERSION ?? "0.0.0",
        bindings: {
          convex: convexConfigured,
          d1: Boolean(env.DB),
          dailyDigestWorkflow: Boolean(env.DAILY_DIGEST_WORKFLOW),
          userAgentSession: Boolean(env.USER_AGENT_SESSION),
        },
      },
      convexConfigured ? 200 : 503,
    );
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
