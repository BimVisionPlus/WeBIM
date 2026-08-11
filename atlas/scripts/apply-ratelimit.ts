/**
 * One-shot codemod: prepend `await rateLimitGuard(req, { name: "<route>" })`
 * to every mutation handler (POST | PATCH | DELETE) that doesn't already have
 * a rateLimit call.
 *
 * Idempotent: safe to re-run; skips files already guarded.
 *
 *   tsx scripts/apply-ratelimit.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..", "apps", "web", "app", "api");
const MUTATIONS = /export\s+async\s+function\s+(POST|PATCH|DELETE|PUT)\s*\(/g;

// Already gated either by explicit rateLimit() / rateLimitGuard() or by the new apiHandler() helper.
const ALREADY_GUARDED = /(rateLimit|rateLimitGuard|apiHandler)\b/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && ent.name === "route.ts") out.push(p);
  }
  return out;
}

function routeName(filePath: string): string {
  // .../app/api/winwork/bids/[bidId]/transition/route.ts → winwork.bids.transition
  const rel = path.relative(ROOT, filePath).replace(/\/route\.ts$/, "");
  return rel.replace(/\[(.*?)\]/g, "$1").split("/").join(".");
}

let touched = 0;
for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  if (ALREADY_GUARDED.test(src)) continue;
  if (!MUTATIONS.test(src)) continue;
  MUTATIONS.lastIndex = 0;

  const name = routeName(file);

  // Add import if not present
  if (!/from\s+["']@atlas\/lib["']/.test(src)) {
    src = `import { rateLimitGuard } from "@atlas/lib";\n` + src;
  } else if (!/rateLimitGuard/.test(src)) {
    src = src.replace(/from\s+["']@atlas\/lib["']/, (m) => {
      const before = src.match(/import\s*\{([^}]+)\}\s*from\s*["']@atlas\/lib["']/);
      if (!before) return m;
      const names = before[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (!names.includes("rateLimitGuard")) names.push("rateLimitGuard");
      return m;
    });
    // Replace the named-import list properly:
    src = src.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@atlas\/lib["']/,
      (_m, list: string) => {
        const names = list.split(",").map((s) => s.trim()).filter(Boolean);
        if (!names.includes("rateLimitGuard")) names.push("rateLimitGuard");
        return `import { ${names.join(", ")} } from "@atlas/lib"`;
      },
    );
  }

  // Inject guard at the top of each mutation handler body. Tolerates Next.js's
  // (req: NextRequest) or ({ params }: ...) form by hunting for the first `{`
  // after the function signature.
  src = src.replace(
    /export\s+async\s+function\s+(POST|PATCH|DELETE|PUT)\s*\(([^)]*)\)\s*\{\s*/g,
    (match, method, args) => {
      // Identify the request param name from the signature.
      const m = args.match(/(\w+)\s*:\s*(?:NextRequest|Request)/);
      const reqVar = m ? m[1] : "req";
      const guard = `\n  const __rl = await rateLimitGuard(${reqVar}, { name: "${name}" });\n  if (__rl) return __rl;\n`;
      return `${match}${guard}`;
    },
  );

  fs.writeFileSync(file, src);
  touched++;
  console.log("  ✓", path.relative(ROOT, file));
}
console.log(`\n${touched} routes guarded.`);
