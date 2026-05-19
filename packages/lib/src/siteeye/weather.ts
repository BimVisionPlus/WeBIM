/**
 * Open-Meteo adapter — free, no-key forecast feed.
 *
 * https://api.open-meteo.com/v1/forecast
 *
 * Used by SiteEye to:
 *  - Pull current + next-hour rainfall and wind so we can fire a
 *    "đình chỉ đổ bê tông" / "ngừng cẩu" alert.
 *  - Persist a WeatherSnapshot row that other modules (CostPulse for
 *    schedule-impact, ProjectPulse for risk heatmap) can join.
 *
 * No network call in unit tests — production caller passes coordinates
 * from Project.address geocoded once.
 */

export type WeatherReading = {
  tempC: number | null;
  humidity: number | null;
  rainMmHr: number | null;
  windKph: number | null;
  condition: string;
  raw: unknown;
};

/** Translate open-meteo's WMO weather code to a coarse condition tag. */
export function wmoToCondition(code: number | undefined): string {
  if (code === undefined) return "unknown";
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "partly_cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain_heavy";
  if (code === 95 || code === 96 || code === 99) return "thunder";
  return "other";
}

export async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherReading> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
  );
  url.searchParams.set("timezone", "Asia/Ho_Chi_Minh");

  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const json: any = await r.json();
  const c = json.current ?? {};
  return {
    tempC: typeof c.temperature_2m === "number" ? c.temperature_2m : null,
    humidity: typeof c.relative_humidity_2m === "number" ? c.relative_humidity_2m : null,
    rainMmHr: typeof c.precipitation === "number" ? c.precipitation : null,
    windKph: typeof c.wind_speed_10m === "number" ? c.wind_speed_10m : null,
    condition: wmoToCondition(c.weather_code),
    raw: json,
  };
}

/** Decide whether weather warrants a site-action alert. */
export type WeatherAlert = {
  level: "info" | "warning" | "blocking";
  reason: string;
  action: string; // recommended action
};

export function evaluateWeather(w: WeatherReading): WeatherAlert | null {
  // Rules of thumb (project-tunable in production):
  //  - Rain > 5 mm/h → no concrete pour (TCVN 4453).
  //  - Wind > 36 kph → no tower-crane lift.
  //  - Thunder → evacuate roof / high places.
  if (w.condition === "thunder") {
    return {
      level: "blocking",
      reason: "Có sấm sét trong khu vực",
      action: "Dừng toàn bộ công tác trên cao và mặt mở, di chuyển nhân lực vào nơi an toàn.",
    };
  }
  if (w.rainMmHr !== null && w.rainMmHr > 5) {
    return {
      level: "blocking",
      reason: `Mưa ${w.rainMmHr} mm/h`,
      action: "Đình chỉ công tác đổ bê tông + sơn ngoài + cẩu thiết bị cho đến khi mưa < 2 mm/h trong 30 phút (TCVN 4453).",
    };
  }
  if (w.windKph !== null && w.windKph > 36) {
    return {
      level: "warning",
      reason: `Gió ${w.windKph} kph`,
      action: "Tạm ngừng cẩu vật tư vào tải trọng cao. Cảnh báo lao động trên giàn giáo.",
    };
  }
  if (w.tempC !== null && w.tempC > 36) {
    return {
      level: "warning",
      reason: `Nắng nóng ${w.tempC}°C`,
      action: "Bố trí nghỉ ngơi 10 phút mỗi 50 phút, bổ sung nước/điện giải cho công nhân.",
    };
  }
  return null;
}
