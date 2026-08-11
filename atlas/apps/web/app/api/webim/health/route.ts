/**
 * GET /api/webim/health — "yes, this is an Atlas".
 *
 * WeBIM's Atlas tab looks for a running Atlas on a few likely addresses
 * rather than making someone type a URL. Reachability is not enough to
 * decide with: port 3000 on a developer's machine is as likely to be
 * Dagster, Grafana or another Next app, and every one of them answers.
 *
 * So identity has to be readable cross-origin, which means CORS — hence
 * this route rather than `/api/health`, which sends none. No API key:
 * saying "an Atlas is here" to an allow-listed origin is what makes the
 * discovery safe, and everything past it still needs a key.
 */

import { NextRequest } from "next/server";
import { bridgeJson, bridgePreflight } from "@/lib/webim-bridge";

export async function OPTIONS(req: NextRequest) {
  return bridgePreflight(req);
}

export async function GET(req: NextRequest) {
  return bridgeJson(req, { service: "atlas", ok: true });
}
