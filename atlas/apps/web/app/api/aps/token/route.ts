import { NextResponse } from "next/server";
import { apsViewerToken } from "@atlas/lib";

export async function GET() {
  try {
    const token = await apsViewerToken();
    return NextResponse.json({ access_token: token, expires_in: 3600 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "APS token error" }, { status: 500 });
  }
}
