# Mission Control AI

Browser dashboard for simulated spacecraft telemetry, threshold anomaly detection, and Grok-assisted investigation. Mission **ORBITAL-01** is simulated. The app never commands a vehicle.

## Run

From the project root, with Node.js 20 or newer:

```powershell
npm install
npm run dev
```

- Dashboard: http://localhost:5173
- API (Grok health and investigation only): http://localhost:3001

Run the processes separately if you prefer:

```powershell
npm run dev:server
npm run dev:client
```

Check types and the simulation:

```powershell
npm run typecheck
npm run verify
```

## Grok API key

The key stays on the server. The browser never sees it, and it is not prefixed with `VITE_`.

1. Copy `.env.example` to `.env` in the project root if `.env` is not already there.
2. Set `XAI_API_KEY` to a key from https://grok.com/dashboard/api-keys or https://console.x.ai. A usable key starts with `xai-`.
3. Restart the API process (`npm run dev` or `npm run dev:server`).

```env
XAI_API_KEY=your_key_here
XAI_MODEL=grok-4.7
PORT=3001
```

Without a key, investigations still complete. The report is labeled **SOURCE ONBOARD RULES** and the header shows **GROK OFFLINE**. With a key, the same panel is filled from Grok and labeled with the model name. If Grok is slow, rejects the payload, or cannot be reached, the dashboard keeps the rule-based report and explains why.

## Demo

1. Leave the scenario on **Normal Operation**. Temperature, pressure, voltage, vibration, and fuel quantity stay inside their limits. Mission status is **NOMINAL**.
2. Select **Engine Overheating**. Temperature climbs, crosses 550 K (warning) and 600 K (critical). Status becomes **CRITICAL**. One engine incident is opened — it is updated in place, not duplicated every second.
3. The critical alarm starts an investigation on its own. You can also press **Investigate** or **Re-run investigation**.
4. Read the report: observed facts, hypotheses with confidence, evidence, and actions marked for human review.
5. Select **Fuel Pressure Drop** for the fuel-system case, or **Normal Operation** to restore the bands and clear active alarms. Cleared incidents stay in history.

## Limits used by the detector

| Channel | Warning | Critical |
|---|---:|---:|
| Engine temperature | > 550 K | > 600 K |
| Fuel pressure | < 250 PSI | < 200 PSI |
| Battery voltage | < 24 V | < 20 V |
| Vibration | > 0.5 G | > 1.0 G |

These are demo limits, not flight limits. Fuel remaining is displayed and trended. It has no alarm.

## Layout

`client/` is the Vite + React dashboard. The one-hertz simulator, scenario switch, threshold detector, incident list, and rule-based report run in the browser. `server/` is the local Express process for `/api/health` and `/api/investigate`. `netlify/functions/api.ts` is that same API on Netlify. Only those routes call Grok, and only they read `XAI_API_KEY`.

Simulation state lives in the browser tab. An incident that returns inside limits is marked `RESOLVED` so it remains in history until reload. That status is an addition to the original `ACTIVE | INVESTIGATING | INVESTIGATED` set.

## Deploy to Netlify

The site is a static Vite build plus one function. A Git-based deploy from `main` picks up build command, publish directory, functions directory, and the `/api/*` rewrite from `netlify.toml`. No extra build settings are required in the Netlify UI.

1. In Netlify, import this repository. Leave the production branch as `main`.
2. In Site configuration → Environment variables, set `XAI_API_KEY`. Optionally set `XAI_MODEL` (the default is `grok-4.7`).
3. Deploy. Netlify runs `npm run build` and publishes `client/dist`.

Without `XAI_API_KEY`, the dashboard still runs. Investigations use onboard rules and the header shows **GROK OFFLINE**.

To emulate functions, redirects, and `.env` locally:

```powershell
npx netlify dev
```

Open http://localhost:8888. `npm run dev` stays the usual local workflow: the dashboard is on port 5173 and Vite proxies `/api` to Express on port 3001.

## Limitations

- Telemetry is simulated. Nothing here talks to flight hardware.
- Investigations are suggestions. They are not procedures and not commands.
- History, incidents, and reports reset when the page reloads.
- There is no operator login.
- Automatic investigation runs when a channel first reaches **critical**, and again if you already investigated a warning and it later escalates. A warning alone waits for you to press **Investigate**, unless you wait for the critical limit.
