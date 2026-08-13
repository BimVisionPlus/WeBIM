import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ATLAS_CONFIG,
  IFC_CONTENT_TYPE,
  ifcFileName,
  listAtlasProjects,
  atlasCandidates,
  discoverAtlas,
  identifyAtlas,
  isLocalOrigin,
  loadAtlasConfig,
  probeAtlas,
  publishToAtlas,
  saveAtlasConfig,
  type AtlasConfig,
} from "../src/sync/atlasBridge";

const CONFIG: AtlasConfig = {
  ...DEFAULT_ATLAS_CONFIG,
  baseUrl: "https://atlas.test/",
  apiKey: "wbm_secret",
  projectId: "prj_1",
  projectLabel: "VHGP-S9 — Lô S9",
  revision: "v3",
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Records every request and replays canned responses in order. */
function recorder(responses: Array<Partial<Response> & { json?: () => Promise<unknown> }>) {
  const calls: Call[] = [];
  let index = 0;
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const response = responses[index++] ?? { ok: true, status: 200 };
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: response.json ?? (async () => ({})),
    } as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function publishResponses() {
  return [
    { json: async () => ({ uploadUrl: "https://s3.test/put?sig=1", key: "VHGP-S9/models/x.ifc" }) },
    {}, // the S3 PUT
    { json: async () => ({ modelId: "mdl_9", replaced: false, viewerPath: "/projects/prj_1/models/mdl_9" }) },
  ];
}

describe("ifcFileName", () => {
  it("folds Vietnamese and drops anything path-like", () => {
    expect(ifcFileName("Nhà điều hành — Lô S9", "v2")).toBe("Nha_dieu_hanh_Lo_S9-v2.ifc");
  });

  it("never yields a bare extension", () => {
    expect(ifcFileName("///", "")).toBe("webim-model.ifc");
  });
});

describe("publishToAtlas", () => {
  it("presigns, uploads to S3 and commits — in that order", async () => {
    const { calls, fetchImpl } = recorder(publishResponses());

    const result = await publishToAtlas(
      { config: CONFIG, ifc: "ISO-10303-21;\nENDSEC;\n", modelName: "Tòa A" },
      fetchImpl,
    );

    expect(calls.map((call) => call.url)).toEqual([
      "https://atlas.test/api/webim/presign",
      "https://s3.test/put?sig=1",
      "https://atlas.test/api/webim/commit",
    ]);
    expect(result.modelId).toBe("mdl_9");
    expect(result.viewerUrl).toBe("https://atlas.test/projects/prj_1/models/mdl_9");
  });

  it("sends the key as a bearer token and the same content type it presigned", async () => {
    const { calls, fetchImpl } = recorder(publishResponses());
    await publishToAtlas({ config: CONFIG, ifc: "ISO-10303-21;", modelName: "Tòa A" }, fetchImpl);

    const presign = JSON.parse(String(calls[0].init?.body));
    const presignHeaders = (calls[0].init?.headers ?? {}) as Record<string, string>;
    const uploadHeaders = (calls[1].init?.headers ?? {}) as Record<string, string>;

    expect(presignHeaders.Authorization).toBe("Bearer wbm_secret");
    expect(presign.contentType).toBe(IFC_CONTENT_TYPE);
    // S3 verifies Content-Type against the signature — a mismatch is a 403.
    expect(uploadHeaders["content-type"]).toBe(IFC_CONTENT_TYPE);
    expect(calls[1].init?.method).toBe("PUT");
  });

  it("commits the key S3 handed back, not a locally guessed one", async () => {
    const { calls, fetchImpl } = recorder(publishResponses());
    await publishToAtlas({ config: CONFIG, ifc: "ISO-10303-21;", modelName: "Tòa A" }, fetchImpl);

    const commit = JSON.parse(String(calls[2].init?.body));
    expect(commit.fileKey).toBe("VHGP-S9/models/x.ifc");
    expect(commit.revision).toBe("v3");
    expect(commit.discipline).toBe("KIEN_TRUC");
    expect(commit.fileName).toBe("Toa_A-v3.ifc");
  });

  it("surfaces the Vietnamese error Atlas sent", async () => {
    const { fetchImpl } = recorder([
      { ok: false, status: 403, json: async () => ({ error: "API key thiếu quyền models:write" }) },
    ]);
    await expect(
      publishToAtlas({ config: CONFIG, ifc: "x", modelName: "Tòa A" }, fetchImpl),
    ).rejects.toThrow("API key thiếu quyền models:write");
  });

  it("does not commit when the S3 upload fails", async () => {
    const { calls, fetchImpl } = recorder([
      { json: async () => ({ uploadUrl: "https://s3.test/put", key: "k" }) },
      { ok: false, status: 403 },
    ]);
    await expect(
      publishToAtlas({ config: CONFIG, ifc: "x", modelName: "Tòa A" }, fetchImpl),
    ).rejects.toThrow("HTTP 403");
    expect(calls).toHaveLength(2);
  });

  it("refuses to start without a project", async () => {
    const { calls, fetchImpl } = recorder(publishResponses());
    await expect(
      publishToAtlas(
        { config: { ...CONFIG, projectId: "" }, ifc: "x", modelName: "Tòa A" },
        fetchImpl,
      ),
    ).rejects.toThrow("Chưa chọn dự án Atlas");
    expect(calls).toHaveLength(0);
  });

  it("reports progress in order", async () => {
    const { fetchImpl } = recorder(publishResponses());
    const seen: string[] = [];
    await publishToAtlas(
      { config: CONFIG, ifc: "x", modelName: "Tòa A", onProgress: (m) => seen.push(m) },
      fetchImpl,
    );
    expect(seen).toHaveLength(4);
    expect(seen[0]).toMatch(/quyền tải lên/);
    expect(seen[3]).toMatch(/model mới/);
  });
});

describe("listAtlasProjects", () => {
  it("hits the org-scoped endpoint with the key", async () => {
    const { calls, fetchImpl } = recorder([
      { json: async () => ({ projects: [{ id: "prj_1", key: "VHGP-S9", name: "Lô S9", status: "ACTIVE" }] }) },
    ]);
    const projects = await listAtlasProjects(CONFIG, fetchImpl);
    expect(calls[0].url).toBe("https://atlas.test/api/webim/projects");
    expect(projects[0].key).toBe("VHGP-S9");
  });
});

describe("config persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  it("round-trips and fills defaults for fields written by older builds", () => {
    saveAtlasConfig({ ...CONFIG, revision: "v7" });
    expect(loadAtlasConfig().revision).toBe("v7");

    localStorage.setItem("webim.atlas", JSON.stringify({ apiKey: "wbm_x" }));
    const loaded = loadAtlasConfig();
    expect(loaded.apiKey).toBe("wbm_x");
    expect(loaded.discipline).toBe("KIEN_TRUC");
  });

  it("falls back to defaults on corrupt storage", () => {
    localStorage.setItem("webim.atlas", "{not json");
    expect(loadAtlasConfig()).toEqual(DEFAULT_ATLAS_CONFIG);
  });

  /**
   * The stuck-on-Dagster case: an address auto-picked by a discovery that
   * could not tell Atlas apart was indistinguishable from a deliberate one,
   * so it survived every reload. Untagged storage now reads as a guess.
   */
  it("treats an address stored before provenance existed as a guess", () => {
    localStorage.setItem("webim.atlas", JSON.stringify({ baseUrl: "http://localhost:3000" }));
    const loaded = loadAtlasConfig();
    expect(loaded.baseUrl).toBe("http://localhost:3000");
    expect(loaded.baseUrlSource).toBe("auto");
  });

  it("keeps a typed address deliberate across reloads", () => {
    saveAtlasConfig({ ...CONFIG, baseUrl: "https://atlas.congty.vn", baseUrlSource: "manual" });
    expect(loadAtlasConfig().baseUrlSource).toBe("manual");
  });

  it("does not let a stored value forge provenance", () => {
    localStorage.setItem(
      "webim.atlas",
      JSON.stringify({ baseUrl: "http://localhost:3000", baseUrlSource: "nonsense" }),
    );
    expect(loadAtlasConfig().baseUrlSource).toBe("auto");
  });
});

describe("probeAtlas — timeouts and empties", () => {
  it("is down rather than hanging when the host swallows the request", async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    await expect(probeAtlas("https://atlas.test", fetchImpl, 10)).resolves.toBe(false);
  });

  it("does not probe an empty address", async () => {
    const { calls, fetchImpl } = recorder([{}]);
    await expect(probeAtlas("", fetchImpl)).resolves.toBe(false);
    expect(identifyAtlas("", fetchImpl)).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("discoverAtlas", () => {
  /** Only the hosts named identify as Atlas; everything else fails like DNS. */
  function onlyUp(...up: string[]) {
    return (async (url: unknown) => {
      if (up.some((host) => String(url).startsWith(host))) {
        return { ok: true, json: async () => ({ service: "atlas" }) } as unknown as Response;
      }
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
  }

  it("finds the running Atlas so nobody has to type an address", async () => {
    const found = await discoverAtlas(
      ["https://atlas.webim.vn", "http://localhost:3170"],
      onlyUp("http://localhost:3170"),
    );
    expect(found).toBe("http://localhost:3170");
  });

  it("prefers candidate order, not whichever answered first", async () => {
    const candidates = ["https://a.test", "http://localhost:3170"];
    const found = await discoverAtlas(candidates, onlyUp("https://a.test", "http://localhost:3170"));
    // Both are up; a stable answer keeps the address from flipping on reload.
    expect(found).toBe("https://a.test");
  });

  it("does not adopt another app that merely answers on the port", async () => {
    const dagsterOn3000 = (async (url: unknown) =>
      String(url).startsWith("http://localhost:3000")
        ? ({ ok: true, json: async () => ({ service: "dagster" }) } as unknown as Response)
        : Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch;
    await expect(
      discoverAtlas(["http://localhost:3170", "http://localhost:3000"], dagsterOn3000),
    ).resolves.toBeNull();
  });

  it("returns null when nothing is running", async () => {
    await expect(
      discoverAtlas(["https://a.test", "https://b.test"], onlyUp()),
    ).resolves.toBeNull();
  });
});

describe("identifyAtlas", () => {
  function respond(body: unknown, ok = true) {
    return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  }

  it("accepts an Atlas that names itself", async () => {
    await expect(
      identifyAtlas("http://localhost:3170", respond({ service: "atlas", ok: true })),
    ).resolves.toBe(true);
  });

  /**
   * The bug this pins: port 3000 on a dev machine is as likely to be Dagster,
   * and a reachability-only check framed it inside the Atlas tab.
   */
  it("rejects another app squatting on the port", async () => {
    await expect(
      identifyAtlas("http://localhost:3000", respond({ service: "dagster" })),
    ).resolves.toBe(false);
  });

  it("rejects a server answering HTML for every path", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    })) as unknown as typeof fetch;
    await expect(identifyAtlas("http://localhost:5174/atlas", fetchImpl)).resolves.toBe(false);
  });

  it("rejects a 404 — the route is what proves the bridge is there", async () => {
    await expect(
      identifyAtlas("http://localhost:3170", respond({}, false)),
    ).resolves.toBe(false);
  });

  it("asks the CORS-enabled bridge route, not /api/health", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: unknown) => {
      calls.push(String(url));
      return { ok: true, json: async () => ({ service: "atlas" }) };
    }) as unknown as typeof fetch;
    await identifyAtlas("http://localhost:3170", fetchImpl);
    expect(calls[0]).toBe("http://localhost:3170/api/webim/health");
  });
});

describe("probeAtlas", () => {
  it("only asks reachability — the user typed this address", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return {} as Response;
    }) as unknown as typeof fetch;
    await expect(probeAtlas("http://localhost:3000", fetchImpl)).resolves.toBe(true);
    expect(calls[0].mode).toBe("no-cors");
  });

  it("is down when nothing answers", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(probeAtlas("https://atlas.webim.vn", fetchImpl)).resolves.toBe(false);
  });
});

/**
 * `localhost` on a deployed page is the *visitor's* machine. Guessing it
 * cannot find our Atlas, and reaching into someone's local ports because
 * they opened a web page is not a default worth having — so the localhost
 * candidates only exist when this page is itself served from localhost.
 */
describe("where to look for Atlas", () => {
  const withOrigin = (origin: string) => {
    vi.stubGlobal("window", { location: { origin } });
    return atlasCandidates();
  };

  it("guesses local ports only when the page is itself local", () => {
    expect(withOrigin("http://localhost:5174")).toEqual([
      "http://localhost:5174/atlas",
      "http://localhost:3170",
      "http://localhost:3000",
    ]);
    expect(withOrigin("http://127.0.0.1:4173")).toContain("http://localhost:3170");
  });

  it("never probes the visitor's machine from a deployed page", () => {
    const candidates = withOrigin("https://webim.vn");
    expect(candidates).toEqual(["https://webim.vn/atlas"]);
    expect(candidates.some((url) => url.includes("localhost"))).toBe(false);
    expect(candidates.some((url) => url.includes("127.0.0.1"))).toBe(false);
  });

  it("knows a local origin from a hostname that merely contains one", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1")).toBe(true);
    expect(isLocalOrigin("https://localhost.webim.vn")).toBe(false);
    expect(isLocalOrigin("https://notlocalhost")).toBe(false);
    expect(isLocalOrigin("")).toBe(false);
  });
});
