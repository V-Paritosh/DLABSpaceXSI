import { Router, type Request, type RequestHandler, type Response } from "express";
import { handleMissionApi } from "../http/aiHandler";
import { HttpError } from "../services/investigationService";

export const apiRouter = Router();

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

function envSource(): { get(name: string): string | undefined } {
  return {
    get: (name) => process.env[name],
  };
}

apiRouter.use(
  asyncRoute(async (req, res) => {
    const host = req.get("host") ?? "localhost";
    const url = `${req.protocol}://${host}${req.originalUrl}`;
    const init: RequestInit = { method: req.method };
    if (req.method !== "GET" && req.method !== "HEAD") {
      const body = typeof req.body === "string" ? req.body : "";
      init.body = body;
      init.headers = { "content-type": "application/json" };
    }
    const response = await handleMissionApi(new Request(url, init), envSource());
    const text = await response.text();
    res.status(response.status);
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(text);
  }),
);

export function handleApiError(error: unknown, res: Response): boolean {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}
