// Multi-user sync: element-level last-writer-wins merge.
//
// Every element collection in the project dict is keyed by id, so two
// peers editing DIFFERENT elements always merge cleanly; edits to the
// SAME element resolve by Lamport clock (client id breaks ties). The
// transport here is a BroadcastChannel (tabs of the same browser); the
// message shape is transport-agnostic, so a WebSocket relay can carry
// the same payloads between machines.

export const SYNCED_COLLECTIONS = [
  "grid_axes",
  "views",
  "walls",
  "levels",
  "sheets",
  "slabs",
  "schedules",
  "wall_types",
  "dimensions",
] as const;

/** Pseudo-element carrying the project-level fields (name, site, ...). */
export const META_ID = "__meta__";

export type ProjectDict = Record<string, unknown>;
export interface Clock {
  t: number;
  c: string;
}
export type ElementClocks = Record<string, Clock>;

export interface SyncMessage {
  projectId: string;
  clientId: string;
  clocks: ElementClocks;
  project: ProjectDict;
}

type ElementRecord = { collection: string; json: string };

/** Flatten a project dict into id -> serialized element. */
export function collectElements(project: ProjectDict): Map<string, ElementRecord> {
  const elements = new Map<string, ElementRecord>();
  for (const collection of SYNCED_COLLECTIONS) {
    for (const element of (project[collection] as { id: string }[]) ?? []) {
      elements.set(element.id, { collection, json: JSON.stringify(element) });
    }
  }
  const meta = { ...project };
  for (const collection of SYNCED_COLLECTIONS) {
    delete meta[collection];
  }
  elements.set(META_ID, { collection: META_ID, json: JSON.stringify(meta) });
  return elements;
}

/** Ids whose serialized form changed (edited, added or removed). */
export function changedElementIds(
  previous: Map<string, ElementRecord>,
  next: Map<string, ElementRecord>,
): string[] {
  const changed: string[] = [];
  for (const [id, record] of next) {
    if (previous.get(id)?.json !== record.json) changed.push(id);
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) changed.push(id);
  }
  return changed;
}

function newerThan(a: Clock | undefined, b: Clock | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  if (a.t !== b.t) return a.t > b.t;
  return a.c > b.c;
}

export interface MergeResult {
  project: ProjectDict;
  clocks: ElementClocks;
  changed: boolean;
}

/**
 * Merge a remote project state into the local one, element by element:
 * the side with the newer clock wins per element; absence plus a newer
 * clock means deletion. Local element order is preserved, remote-only
 * elements append in remote order.
 */
export function mergeRemote(
  localProject: ProjectDict,
  localClocks: ElementClocks,
  remoteProject: ProjectDict,
  remoteClocks: ElementClocks,
): MergeResult {
  const local = collectElements(localProject);
  const remote = collectElements(remoteProject);
  const clocks: ElementClocks = { ...localClocks };
  let changed = false;

  const winners = new Map<string, ElementRecord>();
  const ids = new Set([...local.keys(), ...remote.keys()]);
  for (const id of ids) {
    const takeRemote = newerThan(remoteClocks[id], localClocks[id]);
    const record = takeRemote ? remote.get(id) : local.get(id);
    if (takeRemote) {
      if (remoteClocks[id]) clocks[id] = remoteClocks[id];
      if ((remote.get(id)?.json ?? null) !== (local.get(id)?.json ?? null)) {
        changed = true;
      }
    }
    if (record) winners.set(id, record);
  }

  const merged: ProjectDict = JSON.parse(
    winners.get(META_ID)?.json ?? JSON.stringify(localProject),
  );
  for (const collection of SYNCED_COLLECTIONS) {
    const rows: unknown[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      const winner = winners.get(id);
      if (!winner || winner.collection !== collection || seen.has(id)) return;
      seen.add(id);
      rows.push(JSON.parse(winner.json));
    };
    for (const element of (localProject[collection] as { id: string }[]) ?? []) {
      push(element.id);
    }
    for (const element of (remoteProject[collection] as { id: string }[]) ?? []) {
      push(element.id);
    }
    merged[collection] = rows;
  }
  return { project: merged, clocks, changed };
}

interface EngineHooks {
  getProjectDict: () => ProjectDict;
  getProjectId: () => string;
  applyRemote: (project: ProjectDict) => void;
}

const CLOCKS_KEY = "webim.sync_clocks";

export class SyncEngine {
  readonly clientId: string;
  private channel: BroadcastChannel | null = null;
  private lamport = 0;
  private clocks: ElementClocks = {};
  private shadow: Map<string, ElementRecord>;
  private hooks: EngineHooks;
  private applying = false;

  constructor(hooks: EngineHooks) {
    this.hooks = hooks;
    this.clientId =
      sessionStorage.getItem("webim.sync_client") ??
      Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("webim.sync_client", this.clientId);
    try {
      this.clocks = JSON.parse(localStorage.getItem(CLOCKS_KEY) ?? "{}");
      this.lamport = Math.max(0, ...Object.values(this.clocks).map((c) => c.t));
    } catch {
      this.clocks = {};
    }
    this.shadow = collectElements(hooks.getProjectDict());
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("webim-sync");
      this.channel.onmessage = (event: MessageEvent<SyncMessage>) =>
        this.onRemote(event.data);
    }
    this.broadcast();
  }

  /** Called after every persisted local commit. */
  onLocalCommit(): void {
    if (this.applying) return;
    const next = collectElements(this.hooks.getProjectDict());
    const changed = changedElementIds(this.shadow, next);
    if (changed.length > 0) {
      this.lamport += 1;
      for (const id of changed) {
        this.clocks[id] = { t: this.lamport, c: this.clientId };
      }
      localStorage.setItem(CLOCKS_KEY, JSON.stringify(this.clocks));
    }
    this.shadow = next;
    if (changed.length > 0) {
      this.broadcast();
    }
  }

  private broadcast(): void {
    this.channel?.postMessage({
      projectId: this.hooks.getProjectId(),
      clientId: this.clientId,
      clocks: this.clocks,
      project: this.hooks.getProjectDict(),
    } satisfies SyncMessage);
  }

  private onRemote(message: SyncMessage): void {
    if (message.clientId === this.clientId) return;
    if (message.projectId !== this.hooks.getProjectId()) return;
    const remoteMax = Math.max(0, ...Object.values(message.clocks).map((c) => c.t));
    this.lamport = Math.max(this.lamport, remoteMax);
    const result = mergeRemote(
      this.hooks.getProjectDict(),
      this.clocks,
      message.project,
      message.clocks,
    );
    this.clocks = result.clocks;
    localStorage.setItem(CLOCKS_KEY, JSON.stringify(this.clocks));
    if (result.changed) {
      this.applying = true;
      try {
        this.hooks.applyRemote(result.project);
      } finally {
        this.applying = false;
      }
      this.shadow = collectElements(this.hooks.getProjectDict());
    }
  }
}
