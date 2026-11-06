# Backend Schema
## Mission Control AI

**Version:** 1.0  
**Architecture:** REST API + In-memory storage

---

## 1. Overview

The backend manages simulated telemetry, anomaly detection, incident records, and AI investigations.

The MVP uses in-memory storage to reduce development complexity.

A persistent database may be introduced in future versions.

## 2. Data Models

### Telemetry

```typescript
interface Telemetry {
  missionId: string;
  timestamp: string;
  engineTemperature: number;
  fuelPressure: number;
  batteryVoltage: number;
  vibration: number;
  fuelRemaining: number;
}
```

### Anomaly

```typescript
type Severity = "WARNING" | "CRITICAL";

interface Anomaly {
  id: string;
  missionId: string;
  subsystem: string;
  metric: string;
  observedValue: number;
  threshold: number;
  severity: Severity;
  description: string;
  timestamp: string;
  status: "ACTIVE" | "INVESTIGATING" | "INVESTIGATED";
}
```

### Investigation

```typescript
interface Investigation {
  id: string;
  anomalyId: string;
  summary: string;
  affectedSubsystem: string;
  observations: string[];
  potentialCauses: {
    description: string;
    confidence: number;
  }[];
  recommendedActions: string[];
  evidence: string[];
  createdAt: string;
}
```

### Mission

```typescript
interface Mission {
  id: string;
  name: string;
  status: "NOMINAL" | "WARNING" | "CRITICAL";
  simulationActive: boolean;
  createdAt: string;
}
```

## 3. API Endpoints

### GET /api/mission

Returns the current mission information.

Response:

```json
{
  "id": "orbital-01",
  "name": "ORBITAL-01",
  "status": "NOMINAL",
  "simulationActive": true
}
```

### GET /api/telemetry

Returns the current telemetry values.

### GET /api/telemetry/history

Returns historical telemetry data for chart visualization.

### POST /api/scenarios/:scenarioId

Triggers a predefined telemetry scenario.

Supported scenarios:
- normal
- engine-overheating
- fuel-pressure-drop

### GET /api/anomalies

Returns detected anomalies.

### GET /api/anomalies/:id

Returns a specific anomaly.

### POST /api/anomalies/:id/investigate

Triggers an AI investigation.

Response:

```json
{
  "id": "investigation-001",
  "anomalyId": "anomaly-001",
  "summary": "Engine temperature is above the configured threshold.",
  "affectedSubsystem": "Engine",
  "observations": [
    "Temperature increased rapidly.",
    "Vibration remains within the expected range."
  ],
  "potentialCauses": [
    {
      "description": "Potential engine cooling issue",
      "confidence": 0.78
    }
  ],
  "recommendedActions": [
    "Review cooling system telemetry.",
    "Compare temperature trends against baseline."
  ],
  "evidence": [
    "Engine temperature: 650 K",
    "Configured threshold: 600 K"
  ]
}
```

### GET /api/investigations

Returns previous investigations.

## 4. Anomaly Detection Rules

| Metric | Warning | Critical |
|---|---:|---:|
| Engine Temperature | >550 K | >600 K |
| Fuel Pressure | <250 PSI | <200 PSI |
| Battery Voltage | <24 V | <20 V |
| Vibration | >0.5 G | >1.0 G |

These are illustrative thresholds for the demo simulation, not validated aerospace operating limits.

## 5. Mission Status Logic

```typescript
function calculateMissionStatus(anomalies: Anomaly[]) {
  if (anomalies.some(a => a.severity === "CRITICAL")) {
    return "CRITICAL";
  }

  if (anomalies.some(a => a.severity === "WARNING")) {
    return "WARNING";
  }

  return "NOMINAL";
}
```

## 6. AI Output Validation

The backend must:
- Validate the AI response structure.
- Ensure confidence values are between 0 and 1.
- Ensure recommendations are strings.
- Reject malformed JSON.
- Handle missing fields.
- Provide a fallback response when the AI request fails.

## 7. Storage

### MVP
- Current telemetry: in-memory state
- Telemetry history: in-memory array
- Anomalies: in-memory array
- Investigations: in-memory array

### Future
- PostgreSQL for persistent records.
- Time-series storage for telemetry.
- Redis for caching and event processing.
- Object storage for engineering documentation.

## 8. Security

- API keys stored in environment variables.
- No secrets exposed to frontend code.
- Input validation on all POST endpoints.
- Rate limiting on AI investigation endpoints.
- Simulated telemetry only.
