import type {
  Anomaly,
  DashboardData,
  HistoryResponse,
  Investigation,
  MissionResponse,
  ScenarioId,
  TelemetryResponse,
} from "../types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // The status line is enough when the body is empty.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export function loadDashboard(): Promise<DashboardData> {
  return Promise.all([
    request<MissionResponse>("/api/mission"),
    request<TelemetryResponse>("/api/telemetry"),
    request<HistoryResponse>("/api/telemetry/history?limit=60"),
    request<Anomaly[]>("/api/anomalies"),
    request<Investigation[]>("/api/investigations"),
  ]).then(([mission, telemetry, history, anomalies, investigations]) => ({
    mission,
    telemetry,
    history,
    anomalies,
    investigations,
  }));
}

export function setScenario(scenarioId: ScenarioId): Promise<unknown> {
  return request(`/api/scenarios/${scenarioId}`, { method: "POST" });
}

export function investigateAnomaly(anomalyId: string): Promise<Investigation> {
  return request<Investigation>(`/api/anomalies/${anomalyId}/investigate`, { method: "POST" });
}
