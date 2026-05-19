/**
 * GET  /api/siteeye/weather?projectId=...&lat=&lng= — fetch + persist snapshot
 *
 * Live call to open-meteo; result persisted as WeatherSnapshot. Returns
 * the snapshot + a recommended alert (if any).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { fetchOpenMeteo, evaluateWeather } from "@atlas/lib";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!projectId || isNaN(lat) || isNaN(lng))
      return NextResponse.json({ error: "projectId, lat, lng required" }, { status: 400 });
    await requireProject(projectId);

    let reading;
    try {
      reading = await fetchOpenMeteo(lat, lng);
    } catch (e: any) {
      return NextResponse.json({ error: "weather_fetch_failed", detail: e?.message ?? "" }, { status: 502 });
    }

    const alert = evaluateWeather(reading);
    const snap = await prisma.weatherSnapshot.create({
      data: {
        projectId,
        tempC: reading.tempC,
        humidity: reading.humidity,
        rainMmHr: reading.rainMmHr,
        windKph: reading.windKph,
        condition: reading.condition,
        source: "open-meteo",
        payload: reading.raw as any,
      },
    });

    return NextResponse.json({ snapshot: snap, alert });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
