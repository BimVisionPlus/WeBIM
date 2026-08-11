// Publishing the native project to Atlas is a kind of export, not a screen.
//
// It used to be a pane inside the Atlas tab, in front of the application it
// duplicates — Atlas can already upload a model. What it does that Atlas
// cannot is take *this* project, straight from the native domain, without a
// manual export-then-upload round trip. So it belongs where the other exports
// are: a toolbar button, opening a dialog only while it is being used.

import { useEffect, useState } from "react";
import {
  ATLAS_DISCIPLINES,
  discoverAtlas,
  listAtlasProjects,
  loadAtlasConfig,
  publishToAtlas,
  saveAtlasConfig,
  type AtlasConfig,
  type AtlasDiscipline,
  type AtlasProject,
  type PublishResult,
} from "../sync/atlasBridge";
import { store } from "../state/store";

export function AtlasPublishDialog({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AtlasConfig>(() => loadAtlasConfig());
  const [projects, setProjects] = useState<AtlasProject[] | null>(null);
  const [modelName, setModelName] = useState(store.project.name);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Same courtesy as the Atlas tab: find the running one rather than asking.
  useEffect(() => {
    if (config.baseUrlSource === "manual") return;
    void discoverAtlas().then((found) => {
      if (found && found !== config.baseUrl) update({ baseUrl: found });
    });
    // Once, on open — re-running on every config change would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<AtlasConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAtlasConfig(next);
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const found = await listAtlasProjects(config);
      setProjects(found);
      // Keep an already-chosen project if the org still has it; otherwise the
      // stored id is stale (revoked key, different org) and must be re-picked.
      if (!found.some((project) => project.id === config.projectId)) {
        const first = found[0];
        update({
          projectId: first?.id ?? "",
          projectLabel: first ? `${first.key} — ${first.name}` : "",
        });
      }
    } catch (cause) {
      setProjects(null);
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    setPublished(null);
    setLog([]);
    try {
      const result = await publishToAtlas({
        config,
        ifc: store.exportIfc(),
        modelName,
        webimProjectId: store.project.id,
        onProgress: (message) => setLog((lines) => [...lines, message]),
      });
      setPublished(result);
      store.setStatus(
        result.replaced
          ? `Atlas: đã thay thế ${modelName} ${config.revision}`
          : `Atlas: đã đăng ${modelName} ${config.revision}`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h3>Đẩy model sang Atlas</h3>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="module-hint">
          Xuất IFC từ model native rồi đăng vào Models của một dự án Atlas. File
          đi thẳng lên kho của Atlas; WeBIM chỉ xin quyền và đăng ký bản ghi.
        </p>

        <div className="module-form">
          <input
            value={config.baseUrl}
            placeholder="https://atlas.webim.vn"
            onChange={(event) =>
              update({
                baseUrl: event.target.value,
                baseUrlSource: event.target.value.trim() ? "manual" : "auto",
              })
            }
          />
          <input
            type="password"
            value={config.apiKey}
            placeholder="API key (wbm_…)"
            onChange={(event) => update({ apiKey: event.target.value })}
          />
          <button disabled={busy || !config.baseUrl || !config.apiKey} onClick={() => void connect()}>
            {busy ? "Đang gọi…" : "Kết nối"}
          </button>
        </div>

        {projects !== null && (
          <div className="module-form">
            <select
              value={config.projectId}
              onChange={(event) => {
                const picked = projects.find((project) => project.id === event.target.value);
                update({
                  projectId: event.target.value,
                  projectLabel: picked ? `${picked.key} — ${picked.name}` : "",
                });
              }}
            >
              {projects.length === 0 && <option value="">Tổ chức chưa có dự án nào</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.key} — {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="module-form">
          <input
            value={modelName}
            placeholder="Tên model"
            onChange={(event) => setModelName(event.target.value)}
          />
          <input
            value={config.revision}
            placeholder="Phiên bản"
            style={{ minWidth: 90 }}
            onChange={(event) => update({ revision: event.target.value })}
          />
          <select
            value={config.discipline}
            onChange={(event) => update({ discipline: event.target.value as AtlasDiscipline })}
          >
            {ATLAS_DISCIPLINES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button disabled={busy || !config.projectId} onClick={() => void publish()}>
            {busy ? "Đang đẩy…" : "Đẩy IFC"}
          </button>
        </div>

        {config.projectLabel && (
          <p className="module-hint">
            Dự án đích: <strong>{config.projectLabel}</strong> · cùng tên + phiên bản
            sẽ ghi đè bản cũ thay vì tạo trùng.
          </p>
        )}

        {log.map((line, index) => (
          <p key={index} className="module-hint">
            {line}
          </p>
        ))}

        {error && <div className="climate-finding warning">⚠ {error}</div>}

        {published && (
          <div className="ai-answer">
            {published.replaced ? "Đã thay thế model" : "Đã tạo model"} ·{" "}
            {(published.sizeBytes / 1024).toFixed(0)} KB
            {"\n"}
            <a href={published.viewerUrl} target="_blank" rel="noreferrer">
              Mở trong Atlas Models →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
