// Multi-user sync: element-level last-writer-wins merge plus presence.
//
// Every element collection in the project dict is keyed by id, so two
// peers editing DIFFERENT elements always merge cleanly; edits to the
// SAME element resolve by Lamport clock (client id breaks ties).
//
// Transports are pluggable and run in parallel: a BroadcastChannel links
// tabs of one browser, a WebSocket connects to the relay service
// (web/relay/server.mjs) for peers on other machines. State-based sync
// makes duplicate delivery harmless. Presence messages carry each peer's
// name, color and current selection for per-element indicators.

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

export interface SyncStateMessage {
  type: "sync";
  projectId: string;
  clientId: string;
  clocks: ElementClocks;
  project: ProjectDict;
}

export interface PresenceMessage {
  type: "presence";
  projectId: string;
  clientId: string;
  name: string;
  color: string;
  selection: { kind: string; id: string } | null;
  tool: string;
}

export interface LeaveMessage {
  type: "leave";
  clientId: string;
}

export type WireMessage = SyncStateMessage | PresenceMessage | LeaveMessage;

export interface PeerPresence {
  clientId: string;
  name: string;
  color: string;
  selection: { kind: string; id: string } | null;
  tool: string;
  lastSeen: number;
}

/** Transports deliver opaque wire messages between peers. */
export interface SyncTransport {
  send(message: WireMessage): void;
  close(): void;
}

const PEER_COLORS = [
  "#e06c75",
  "#61afef",
  "#98c379",
  "#e5c07b",
  "#c678dd",
  "#56b6c2",
];

/** Deterministic per-client color. */
export function colorForClient(clientId: string): string {
  let hash = 0;
  for (const char of clientId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return PEER_COLORS[hash % PEER_COLORS.length];
}

/** Drop peers not heard from within maxAgeMs; returns true if changed. */
export function prunePeers(
  peers: Map<string, PeerPresence>,
  now: number,
  maxAgeMs = 25000,
): boolean {
  let changed = false;
  for (const [clientId, peer] of peers) {
    if (now - peer.lastSeen > maxAgeMs) {
      peers.delete(clientId);
      changed = true;
    }
  }
  return changed;
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

class BroadcastChannelTransport implements SyncTransport {
  private channel: BroadcastChannel;

  constructor(onMessage: (message: WireMessage) => void) {
    this.channel = new BroadcastChannel("webim-sync");
    this.channel.onmessage = (event: MessageEvent<WireMessage>) =>
      onMessage(event.data);
  }

  send(message: WireMessage): void {
    this.channel.postMessage(message);
  }

  close(): void {
    this.channel.close();
  }
}

/**
 * How many opening attempts to make before deciding no relay exists here.
 * A build served as static files (a demo on Pages, a folder opened over
 * HTTP) has no relay and never will, and an unbounded backoff loop turns
 * that into a console full of red for the whole session.
 *
 * Only the FIRST connection is bounded. Once a relay has answered, a later
 * drop is a restart worth waiting out, so retries continue forever.
 */
const RELAY_ATTEMPTS_BEFORE_STANDALONE = 3;

/** WebSocket transport to the relay; reconnects with backoff, and gives up
 * quietly into standalone mode when there was never a relay to reach.
 * Exported for tests — the retry policy is the part worth pinning down. */
export class WebSocketTransport implements SyncTransport {
  private socket: WebSocket | null = null;
  private closed = false;
  private retryMs = 1000;
  private attempts = 0;
  private everConnected = false;
  private url: string;
  private onMessage: (message: WireMessage) => void;
  private onOpen: () => void;
  private onStatus: (connected: boolean) => void;
  private onStandalone: () => void;
  connected = false;
  standalone = false;

  constructor(
    url: string,
    onMessage: (message: WireMessage) => void,
    onOpen: () => void,
    onStatus: (connected: boolean) => void,
    onStandalone: () => void = () => {},
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onStatus = onStatus;
    this.onStandalone = onStandalone;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    this.attempts += 1;
    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket.onopen = () => {
      this.retryMs = 1000;
      this.attempts = 0;
      this.everConnected = true;
      this.connected = true;
      this.onStatus(true);
      this.onOpen();
    };
    this.socket.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data as string) as WireMessage);
      } catch {
        // Ignore malformed frames.
      }
    };
    this.socket.onclose = () => {
      if (this.connected) {
        this.connected = false;
        this.onStatus(false);
      }
      this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    if (!this.everConnected && this.attempts >= RELAY_ATTEMPTS_BEFORE_STANDALONE) {
      this.closed = true;
      this.standalone = true;
      this.onStandalone();
      return;
    }
    setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 15000);
  }

  send(message: WireMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
  }
}

interface EngineHooks {
  getProjectDict: () => ProjectDict;
  getProjectId: () => string;
  applyRemote: (project: ProjectDict) => void;
  getPresence: () => {
    selection: { kind: string; id: string } | null;
    tool: string;
  };
  onPeersChanged: (peers: PeerPresence[]) => void;
  onRelayStatus?: (connected: boolean) => void;
  /** No relay here and there never was one — a static build, or offline. */
  onStandalone?: () => void;
}

const CLOCKS_KEY = "webim.sync_clocks";
import { relayBase } from "../config";

const RELAY_URL_KEY = "webim.relay_url";

export class SyncEngine {
  readonly clientId: string;
  readonly name: string;
  readonly color: string;
  relayConnected = false;
  private transports: SyncTransport[] = [];
  private lamport = 0;
  private clocks: ElementClocks = {};
  private shadow: Map<string, ElementRecord>;
  private hooks: EngineHooks;
  private applying = false;
  private peers = new Map<string, PeerPresence>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(hooks: EngineHooks) {
    this.hooks = hooks;
    this.clientId =
      sessionStorage.getItem("webim.sync_client") ??
      Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("webim.sync_client", this.clientId);
    this.name = `User-${this.clientId.slice(0, 4)}`;
    this.color = colorForClient(this.clientId);
    try {
      this.clocks = JSON.parse(localStorage.getItem(CLOCKS_KEY) ?? "{}");
      this.lamport = Math.max(0, ...Object.values(this.clocks).map((c) => c.t));
    } catch {
      this.clocks = {};
    }
    this.shadow = collectElements(hooks.getProjectDict());

    const onMessage = (message: WireMessage) => this.onRemote(message);
    if (typeof BroadcastChannel !== "undefined") {
      this.transports.push(new BroadcastChannelTransport(onMessage));
    }
    this.connectRelay(onMessage);
    window.addEventListener("beforeunload", () => {
      this.send({ type: "leave", clientId: this.clientId });
    });
    this.heartbeat = setInterval(() => {
      this.broadcastPresence();
      if (prunePeers(this.peers, Date.now())) {
        this.emitPeers();
      }
    }, 10000);
    this.broadcastState();
    this.broadcastPresence();
  }

  dispose(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.send({ type: "leave", clientId: this.clientId });
    for (const transport of this.transports) transport.close();
  }

  private connectRelay(onMessage: (message: WireMessage) => void): void {
    // A demo build ships without a platform server; not opening a socket at
    // all is cleaner than opening one that is designed to fail.
    if (import.meta.env?.VITE_STANDALONE === "1") {
      this.standalone = true;
      this.hooks.onStandalone?.();
      return;
    }
    const base =
      new URLSearchParams(window.location.search).get("relay") ??
      localStorage.getItem(RELAY_URL_KEY) ??
      relayBase();
    // Browsers cannot set headers on a WebSocket upgrade, so the auth
    // token rides the query string; the server validates it on connect.
    let token: string | null = null;
    try {
      token = (JSON.parse(localStorage.getItem("webim.auth") ?? "null") as {
        token?: string;
      } | null)?.token ?? null;
    } catch {
      token = null;
    }
    const relayUrl = token
      ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : base;
    this.transports.push(
      new WebSocketTransport(
        relayUrl,
        onMessage,
        () => {
          // Late joiners converge from whoever announces state on open.
          this.broadcastState();
          this.broadcastPresence();
        },
        (connected) => {
          this.relayConnected = connected;
          this.standalone = false;
          this.hooks.onRelayStatus?.(connected);
        },
        () => {
          this.standalone = true;
          this.hooks.onStandalone?.();
        },
      ),
    );
  }

  /** True when there is no relay to talk to: tab-local sync only. */
  standalone = false;

  /** Drop and re-open the relay connection (after login/logout). */
  reconnectRelay(): void {
    this.standalone = false;
    const websocket = this.transports.find(
      (transport) => transport instanceof WebSocketTransport,
    );
    if (websocket) {
      websocket.close();
      this.transports = this.transports.filter((t) => t !== websocket);
    }
    this.connectRelay((message) => this.onRemote(message));
  }

  private send(message: WireMessage): void {
    for (const transport of this.transports) {
      transport.send(message);
    }
  }

  peerList(): PeerPresence[] {
    return [...this.peers.values()].sort((a, b) =>
      a.clientId.localeCompare(b.clientId),
    );
  }

  private emitPeers(): void {
    this.hooks.onPeersChanged(this.peerList());
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
      this.broadcastState();
    }
  }

  /** Called when the local selection or tool changes. */
  broadcastPresence(): void {
    const presence = this.hooks.getPresence();
    this.send({
      type: "presence",
      projectId: this.hooks.getProjectId(),
      clientId: this.clientId,
      name: this.name,
      color: this.color,
      selection: presence.selection,
      tool: presence.tool,
    });
  }

  private broadcastState(): void {
    this.send({
      type: "sync",
      projectId: this.hooks.getProjectId(),
      clientId: this.clientId,
      clocks: this.clocks,
      project: this.hooks.getProjectDict(),
    });
  }

  private onRemote(message: WireMessage): void {
    if (message.type === "leave") {
      if (this.peers.delete(message.clientId)) {
        this.emitPeers();
      }
      return;
    }
    if (message.clientId === this.clientId) return;
    if (message.projectId !== this.hooks.getProjectId()) return;

    if (message.type === "presence") {
      this.peers.set(message.clientId, {
        clientId: message.clientId,
        name: message.name,
        color: message.color,
        selection: message.selection,
        tool: message.tool,
        lastSeen: Date.now(),
      });
      this.emitPeers();
      return;
    }

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
