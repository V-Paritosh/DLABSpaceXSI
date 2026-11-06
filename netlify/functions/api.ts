import type { Config, Context } from "@netlify/functions";
import { handleMissionApi } from "../../server/src/http/aiHandler";

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

export default async (req: Request, _context: Context) => {
  return handleMissionApi(req, {
    get: (name) => Netlify.env.get(name),
  });
};

// Routed by the /api/* rewrite in netlify.toml. Leaving path unset keeps
// /.netlify/functions/api/:splat as the function URL that rewrite targets.
export const config: Config = {};
