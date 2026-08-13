// 4D — kéo thanh thời gian, xem công trình mọc lên, xuất video.
//
// The viewer is the same Viewer3D the 3D tab uses, handed a project filtered
// to what has been built by the scrubbed date. Recording captures that canvas
// with MediaRecorder rather than rendering frames a second time, so the video
// is exactly what was on screen.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  auditSequence,
  builtAt,
  dateAtDay,
  planTimeline,
  projectAt,
} from "../application/fourD";
import { Viewer3D } from "../viewport/Viewer3D";
import { store, useStoreVersion } from "../state/store";

const DAYS_PER_SECOND = 30;

function formatDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

export function FourDModule() {
  const version = useStoreVersion();
  const project = store.project;
  // `version` is the store's change counter: the project object is mutated in
  // place, so it alone would not tell React anything changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timeline = useMemo(() => planTimeline(project), [project, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const audit = useMemo(() => auditSequence(project), [project, version]);

  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // Playback advances real days per real second so the clip length is
  // predictable; a fixed frame count would run a 3-day plan for as long as a
  // 3-year one.
  useEffect(() => {
    if (!playing || !timeline) return;
    const started = performance.now();
    const from = day;
    let raf = 0;
    const step = (now: number) => {
      const elapsed = (now - started) / 1000;
      const next = from + elapsed * DAYS_PER_SECOND;
      if (next >= timeline.days) {
        setDay(timeline.days);
        setPlaying(false);
        return;
      }
      setDay(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `day` is the seek position when play starts; re-running on every tick
    // would restart the clock each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline]);

  const at = timeline ? dateAtDay(timeline, day) : null;
  const state = useMemo(
    () => (at ? builtAt(project, at) : { built: new Set<string>(), inProgress: new Set<string>() }),
    // Keyed on the timestamp, not the Date object, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, at?.getTime(), version],
  );
  // Rebuilding the filtered project is not free, so key it on the id set
  // rather than on the date — many days in a row build nothing new.
  const builtKey = [...state.built].sort().join(",");
  const filtered = useMemo(
    () => projectAt(project, state.built),
    // builtKey IS state.built, serialised: depending on the Set itself would
    // rebuild every frame, since builtAt returns a new Set each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, builtKey],
  );

  async function record() {
    const canvas = hostRef.current?.querySelector("canvas");
    if (!canvas || !timeline) return;
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name}-4D.webm`;
      anchor.click();
      URL.revokeObjectURL(url);
      setRecording(false);
    };

    setRecording(true);
    setDay(0);
    recorder.start();
    setPlaying(true);
    // Stop a beat after the timeline ends so the finished building is on the
    // last frame rather than cut at the moment it completes.
    const seconds = timeline.days / DAYS_PER_SECOND + 1;
    window.setTimeout(() => recorder.stop(), seconds * 1000);
  }

  if (!timeline) {
    return (
      <div className="module-host">
        <h2>4D — mô phỏng tiến độ</h2>
        <p className="module-hint">
          Chưa có hạng mục nào mang ngày bắt đầu/kết thúc. Thêm ở tab{" "}
          <strong>Plan</strong>, rồi gán phần tử cho từng hạng mục ở{" "}
          <strong>Properties</strong> khi chọn hạng mục đó.
        </p>
      </div>
    );
  }

  return (
    <div className="atlas-host">
      <div className="atlas-tabs">
        <button onClick={() => setPlaying((value) => !value)} disabled={recording}>
          {playing ? "Tạm dừng" : "Chạy"}
        </button>
        <button onClick={() => { setPlaying(false); setDay(0); }} disabled={recording}>
          Về đầu
        </button>
        <input
          type="range"
          min={0}
          max={timeline.days}
          step={1}
          value={Math.round(day)}
          onChange={(event) => {
            setPlaying(false);
            setDay(Number(event.target.value));
          }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <span className="module-hint" style={{ margin: 0 }}>
          {at ? formatDate(at) : ""} · ngày {Math.round(day)}/{timeline.days}
        </span>
        <button onClick={() => void record()} disabled={recording}>
          {recording ? "Đang ghi…" : "Xuất video"}
        </button>
      </div>

      <p className="module-hint">
        {state.built.size} phần tử đã dựng
        {state.inProgress.size > 0 && ` · ${state.inProgress.size} đang thi công (chưa hiện)`}
        {audit.unscheduled.length > 0 &&
          ` · ${audit.unscheduled.length} phần tử chưa gán hạng mục nào — sẽ không bao giờ xuất hiện`}
        {audit.danglingElementIds.length > 0 &&
          ` · ${audit.danglingElementIds.length} tham chiếu tới phần tử đã xoá`}
      </p>

      <div ref={hostRef} style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Viewer3D project={filtered} linked={[]} version={version + Math.round(day)} />
      </div>
    </div>
  );
}
