import { redirect } from "next/navigation";
export default function P({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/site/issues?type=SUBMITTAL`);
}
