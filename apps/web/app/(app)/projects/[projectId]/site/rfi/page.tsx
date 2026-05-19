import { redirect } from "next/navigation";

export default function RfiPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/site/issues?type=RFI`);
}
