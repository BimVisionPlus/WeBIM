import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectNav } from "@/components/project-nav";
import { AiOfflineBanner } from "@/components/ai-offline-banner";
import { formatVndShort } from "@atlas/lib";
import { requireProject, AuthError } from "@atlas/auth";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  let project: Awaited<ReturnType<typeof requireProject>>["project"];
  try {
    ({ project } = await requireProject(params.projectId));
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) redirect(`/signin?callbackUrl=/projects/${params.projectId}`);
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="bg-[rgb(var(--surface))] border-b border-[rgb(var(--line))]">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-[rgb(var(--muted))]">
            <a href="https://aecplatform.vn" className="hover:text-[rgb(var(--ink))]" title="AEC Platform">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-[rgb(var(--ink))]">Atlas</Link>
            <span>/</span>
            <Link href="/" className="hover:text-[rgb(var(--ink))]">Dự án</Link>
            <span>/</span>
            <span className="font-mono text-[rgb(var(--ink-2))]">{project.key}</span>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <Link href="/settings/team" className="hover:text-[rgb(var(--ink))]">Đội</Link>
              <Link href="/settings/ai" className="hover:text-[rgb(var(--ink))]">AI</Link>
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <h1 className="text-xl font-semibold text-[rgb(var(--ink))]">{project.name}</h1>
            <div className="flex gap-4 text-xs text-[rgb(var(--muted))]">
              <span>CĐT: {project.ownerOrg.name}</span>
              <span>Giá trị HĐ: {formatVndShort(project.contractValueVnd)}</span>
              <span>Bảo hành: {project.warrantyMonths} tháng</span>
            </div>
          </div>
        </div>
      </header>

      <ProjectNav projectId={project.id} department={project.department} />
      <AiOfflineBanner />

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
