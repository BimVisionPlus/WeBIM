import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { UploadForm } from "@/components/upload-form";

export default function UploadModelPage({ params }: { params: { projectId: string } }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Tải lên mô hình BIM</h2>
      <p className="text-xs text-[rgb(var(--muted))]">
        Hỗ trợ: IFC 2x3 / IFC 4, Revit (RVT/RFA), Navisworks (NWD/NWC), AutoCAD (DWG/DXF), PDF.
        File sẽ được upload lên S3 (MinIO) → đẩy sang Autodesk APS → chuyển đổi sang SVF2 để xem trên web.
      </p>
      <Card>
        <CardHeader><CardTitle>Tệp mới</CardTitle></CardHeader>
        <CardBody>
          <UploadForm projectId={params.projectId} />
        </CardBody>
      </Card>
    </div>
  );
}
