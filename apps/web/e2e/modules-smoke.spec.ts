// Smoke spec for the 20 new modules — verifies each route auth-gates correctly,
// renders the AecModuleShell header, and contains seeded data.
//
// Per-module deep specs (CRUD + workflow) live in <module>.spec.ts files.
import { test } from "@playwright/test";
import { visitModule } from "./_helpers";

const MODULES: Array<{ slug: string; title: RegExp }> = [
  { slug: "paymentrail", title: /PaymentRail/ },
  { slug: "volumemeter", title: /VolumeMeter/ },
  { slug: "dinhmuc", title: /DinhMucDB/ },
  { slug: "bondvault", title: /BondVault/ },
  { slug: "hoancong", title: /HoanCong/ },
  { slug: "supervise", title: /SuperviseLog/ },
  { slug: "qaqc", title: /QAQC/ },
  { slug: "tenderforge", title: /TenderForge/ },
  { slug: "eiaflow", title: /EIAFlow/ },
  { slug: "hsetrain", title: /HSE-Train/ },
  { slug: "workforce", title: /WorkforceHub/ },
  { slug: "registry", title: /ContractorRegistry/ },
  { slug: "materialtrace", title: /MaterialTrace/ },
  { slug: "labreports", title: /LabReports/ },
  { slug: "methods", title: /MethodStatement/ },
  { slug: "portal", title: /ClientPortal/ },
  { slug: "consult", title: /ConsultantOps/ },
  { slug: "stakeholders", title: /StakeholderMap/ },
  { slug: "docchat", title: /DocChat/ },
  { slug: "monitor", title: /MonitorWatch/ },
];

for (const m of MODULES) {
  test(`module smoke: ${m.slug}`, async ({ page }) => {
    await visitModule(page, m.slug, m.title);
  });
}
