import { notFound } from "next/navigation";
import { prisma } from "@atlas/db";
import { canvasData } from "@/lib/canvas";
import { SheetCanvas } from "@/components/canvas/sheet-canvas";

export default async function PublicCanvasPage({ params }: { params: { token: string } }) {
  const share = await prisma.sheetShareLink.findUnique({ where: { token: params.token } });
  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) notFound();
  const data = await canvasData(share.sheetId); if (!data) notFound();
  await prisma.sheetShareLink.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });
  return <main className="min-h-screen bg-slate-950 p-4"><div className="mx-auto mb-3 flex max-w-[1500px] items-center text-white"><div><div className="text-xs font-semibold uppercase tracking-widest text-blue-400">Atlas AEC · Hồ sơ trình duyệt</div><div className="text-sm text-slate-300">{data.sheet.projectName}</div></div><div className="ml-auto text-xs text-slate-400">Không cần tài khoản · {share.role === "COMMENT" ? "Được phép bình luận" : "Chỉ xem"}</div></div><div className="mx-auto max-w-[1500px]"><SheetCanvas sheet={data.sheet} initialMarkups={data.markups} createEndpoint={`/api/canvas/public/${params.token}`} presenceEndpoint={`/api/canvas/public/${params.token}/presence`} canComment={share.role === "COMMENT"} guest /></div></main>;
}
