# Schema patch — Tenant fields (D1)

Apply this patch to `schema.prisma` BEFORE running `prisma migrate deploy`.

## 1. Add enum at the top with other enums

```prisma
enum TenantStatus {
  PROVISIONING
  ACTIVE
  EXPIRED
  ARCHIVED
  CONVERTED
}
```

## 2. Patch `model Organization` — add these fields inside the model

Find the existing `model Organization { ... }` block. Add after the `createdAt` line:

```prisma
  // Multi-tenant subdomain support (D — Sandbox per customer)
  isTenantDemo            Boolean       @default(false)
  tenantStatus            TenantStatus?
  tenantExpiresAt         DateTime?
  tenantProvisionedFrom   String?
  tenantProvisionedAt     DateTime?
  prospectName            String?
  prospectEmail           String?
  prospectCompany         String?
  prospectIndustry        String?
  prospectSource          String?
  lastVisitedAt           DateTime?
  visitCount              Int           @default(0)
```

And add to the back-relations block (near other `xxx XxxModel[]` lines):

```prisma
  tenantProvisionings     TenantProvisioning[]
  tenantVisits            TenantVisit[]
```

And add an index near the existing `@@index` blocks:

```prisma
  @@index([isTenantDemo, tenantStatus])
```

## 3. Add new models at the end of schema.prisma

```prisma
// ──────────────────────────────────────────────────────────────────────────────
// MULTI-TENANT (module D) — provisioning audit + visit analytics for tenant
// pilot subdomains <slug>.aecplatform.vn. Each tenant is just an Organization
// with isTenantDemo=true; this table tracks lifecycle events.
// ──────────────────────────────────────────────────────────────────────────────
model TenantProvisioning {
  id            String       @id @default(cuid())
  orgId         String
  sourceOrgId   String?      // template org we cloned from
  startedAt     DateTime     @default(now())
  finishedAt    DateTime?
  status        String       @default("RUNNING") // RUNNING | SUCCESS | FAILED
  errorMessage  String?      @db.Text
  stats         Json?        // { projects: 5, issues: 234, ... }
  actorId       String?
  ip            String?
  userAgent     String?

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([status, startedAt])
}

model TenantVisit {
  id          String   @id @default(cuid())
  orgId       String
  visitedAt   DateTime @default(now())
  userId      String?  // nullable for anonymous browse
  path        String
  ip          String?
  userAgent   String?

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, visitedAt(sort: Desc)])
}
```

After patching:
```bash
cd packages/db
DATABASE_URL=... pnpm exec prisma format
DATABASE_URL=... pnpm exec prisma migrate deploy
DATABASE_URL=... pnpm exec prisma generate
```
