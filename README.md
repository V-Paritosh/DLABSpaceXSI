# Mission Control AI

Browser dashboard for simulated spacecraft telemetry, threshold anomaly detection, and Grok-assisted investigation. Mission **ORBITAL-01** is simulated. The app never commands a vehicle.

## Run

From the project root, with Node.js 20 or newer:

```powershell
npm install
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:3001

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

The key stays on the server. The browser never sees it.

1. Copy `.env.example` to `.env` in the project root if `.env` is not already there.
2. Set `XAI_API_KEY` to a key from https://grok.com/dashboard/api-keys or https://console.x.ai. A usable key starts with `xai-`.
3. Restart the API process (`npm run dev` or `npm run dev:server`).

```env
XAI_API_KEY=your_key_here
XAI_MODEL=grok-4.7
PORT=3001
```

Without a key, investigations still complete. The report is labeled **SOURCE ONBOARD RULES** and the header shows **GROK OFFLINE**. With a key, the same panel is filled from Grok and labeled with the model name. If Grok is slow, rejects the payload, or cannot be reached, the server keeps the rule-based report and explains why.

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

`client/` is the Vite + React dashboard. `server/` is the Express API, the one-hertz simulator, the threshold detector, and the Grok client. State is in memory and resets when the API process restarts. An incident that returns inside limits is marked `RESOLVED` so it remains in history. That status is an addition to the original `ACTIVE | INVESTIGATING | INVESTIGATED` set.

## Limitations

- Telemetry is simulated. Nothing here talks to flight hardware.
- Investigations are suggestions. They are not procedures and not commands.
- History, incidents, and reports disappear when the server stops.
- There is no operator login.
- Automatic investigation runs when a channel first reaches **critical**, and again if you already investigated a warning and it later escalates. A warning alone waits for you to press **Investigate**, unless you wait for the critical limit.
