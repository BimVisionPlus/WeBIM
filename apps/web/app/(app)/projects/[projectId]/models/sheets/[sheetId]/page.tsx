import { notFound } from "next/navigation";
import { requireProject } from "@atlas/auth";
import { canvasData } from "@/lib/canvas";
import { SheetCanvas } from "@/components/canvas/sheet-canvas";
import { ShareButton } from "@/components/canvas/share-button";

export default async function CanvasPage({ params }: { params: { projectId: string; sheetId: string } }) {
  await requireProject(params.projectId);
  const data = await canvasData(params.sheetId);
  if (!data) notFound();
  // Never trust a sheet id from another accessible project in this URL.
  const { prisma } = await import("@atlas/db");
  const belongs = await prisma.sheet.count({ where: { id: params.sheetId, drawingSet: { projectId: params.projectId } } });
  if (!belongs) notFound();
  return <div className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Canvas bản vẽ</h2><p className="text-sm text-slate-500">Review, markup và issue ngay trong trình duyệt.</p></div><ShareButton sheetId={params.sheetId} /></div><SheetCanvas sheet={data.sheet} initialMarkups={data.markups} createEndpoint={`/api/canvas/sheets/${params.sheetId}/markups`} presenceEndpoint={`/api/canvas/sheets/${params.sheetId}/presence`} canComment /></div>;
}
