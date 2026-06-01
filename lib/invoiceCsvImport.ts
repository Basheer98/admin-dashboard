import { normalizeFielderName, normalizeProjectCode } from "./normalize";
import { rowsToObjects } from "./csvParse";
import {
  getProjectByCode,
  getAssignmentsByProjectId,
  insertProject,
  updateProject,
  insertAssignment,
  createInvoiceWithLines,
  type ProjectRow,
} from "./db";

export type CsvColumnRole =
  | "projectCode"
  | "clientName"
  | "totalSqft"
  | "companyRate"
  | "fielderName"
  | "fielderRate"
  | "location"
  | "status"
  | "qfield"
  | "ecd"
  | "notes"
  | "invoiceNumber"
  | "ignore";

export type ColumnMapping = Partial<Record<CsvColumnRole, string>>;

export type ImportOptions = {
  invoiceNumber: string;
  defaultClientName: string;
  defaultCompanyRate: number;
  defaultLocation: string;
  defaultStatus: string;
  syncProjectInvoiceNumber: boolean;
  projectConflict: "update" | "skip_project" | "skip";
  issueDate: string;
  dueDate?: string | null;
  notes?: string | null;
};

export type ParsedFielder = { name: string; ratePerSqft: number };

export type ParsedProjectGroup = {
  projectCode: string;
  clientName: string;
  totalSqft: number;
  companyRatePerSqft: number;
  location: string;
  status: string;
  qfield: string | null;
  ecd: string | null;
  notes: string | null;
  billingInvoiceNumber: string | null;
  fielders: ParsedFielder[];
  rowNumbers: number[];
};

export type PreviewAction =
  | "create_project"
  | "update_project"
  | "skip_project"
  | "error";

export type PreviewProjectRow = {
  group: ParsedProjectGroup;
  action: PreviewAction;
  message: string;
  existingProjectId: number | null;
  assignmentsToAdd: ParsedFielder[];
  assignmentsSkipped: string[];
};

const HEADER_ALIASES: Record<CsvColumnRole, string[]> = {
  projectCode: ["project id", "project", "project no", "project #", "project number", "project_code", "job", "job no"],
  clientName: ["client", "client name", "customer"],
  totalSqft: ["sqft", "sq ft", "square feet", "total sqft", "total_sqft", "sf"],
  companyRate: ["rate", "company rate", "company_rate", "billing rate", "client rate", "price"],
  fielderName: ["fielder", "fielder name", "assigned to", "surveyor"],
  fielderRate: ["fielder rate", "payout rate", "pay rate", "rate per sqft", "fielder_rate"],
  location: ["address", "location", "site"],
  status: ["fielding status", "data status", "submitted", "status", "project status"],
  qfield: ["qfield", "q field"],
  ecd: ["ecd", "due date", "completion date"],
  notes: ["notes", "note", "comments"],
  invoiceNumber: ["invoice", "invoice number", "invoice #", "billing batch"],
  ignore: [],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  const roles: CsvColumnRole[] = [
    "projectCode",
    "clientName",
    "totalSqft",
    "companyRate",
    "fielderName",
    "fielderRate",
    "location",
    "status",
    "qfield",
    "ecd",
    "notes",
    "invoiceNumber",
  ];

  for (const role of roles) {
    const aliases = HEADER_ALIASES[role];
    for (const header of headers) {
      if (used.has(header)) continue;
      const n = normalizeHeader(header);
      if (aliases.includes(n) || n === role.replace(/([A-Z])/g, " $1").trim().toLowerCase()) {
        mapping[role] = header;
        used.add(header);
        break;
      }
    }
  }

  return mapping;
}

function cell(obj: Record<string, string>, header: string | undefined): string {
  if (!header) return "";
  return (obj[header] ?? "").trim();
}

function parseNum(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\$/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Split "Nikhil/Jaggu" or "A, B" into normalized fielder names. */
export function parseFielderNamesFromCell(raw: string, ratePerSqft = 0): ParsedFielder[] {
  if (!raw.trim()) return [];
  const names = raw.split(/[,;|/]+/).map((n) => normalizeFielderName(n)).filter(Boolean);
  return names.map((name) => ({ name, ratePerSqft }));
}

function normalizeQfieldFromSheet(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("2")) return "Qfield-2";
  if (s.includes("1")) return "Qfield-1";
  return null;
}

const VALID_PROJECT_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"]);

function mapSheetStatus(raw: string, fallback: string): string {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (VALID_PROJECT_STATUSES.has(u)) return u;
  return fallback;
}

function extractWideFielders(obj: Record<string, string>, headers: string[]): ParsedFielder[] {
  const fielders: ParsedFielder[] = [];
  const fielderCols: { index: number; header: string; rateHeader?: string }[] = [];

  for (const h of headers) {
    const m = h.trim().match(/^fielder\s*(\d+)$/i);
    if (m) {
      const idx = m[1]!;
      const rateHeader = headers.find((x) => /^rate\s*\d+$/i.test(x.trim()) && x.trim().match(/\d+/)?.[0] === idx);
      fielderCols.push({ index: Number(idx), header: h, rateHeader });
    }
  }

  fielderCols.sort((a, b) => a.index - b.index);

  for (const col of fielderCols) {
    const nameRaw = obj[col.header]?.trim() ?? "";
    if (!nameRaw) continue;
    const names = nameRaw.includes(",") ? nameRaw.split(",") : [nameRaw];
    const rateRaw = col.rateHeader ? obj[col.rateHeader] : "";
    const rate = parseNum(rateRaw ?? "") ?? 0;
    for (const n of names) {
      const name = normalizeFielderName(n);
      if (name) fielders.push({ name, ratePerSqft: rate });
    }
  }

  if (fielders.length === 0) {
    for (const h of headers) {
      if (/^fielder$/i.test(h.trim()) && !/^fielder\s*rate/i.test(h)) {
        const nameRaw = obj[h]?.trim() ?? "";
        if (!nameRaw) continue;
        const rateHeader = headers.find((x) => /fielder\s*rate|payout/i.test(x));
        const rate = rateHeader ? parseNum(obj[rateHeader] ?? "") ?? 0 : 0;
        fielders.push(...parseFielderNamesFromCell(nameRaw, rate));
      }
    }
  }

  return fielders;
}

function applyFielderRatesFromSettings(
  fielders: ParsedFielder[],
  fielderRateMap: Map<string, number>,
): ParsedFielder[] {
  return fielders.map((f) => {
    if (f.ratePerSqft > 0) return f;
    const fromSettings = fielderRateMap.get(f.name);
    if (fromSettings != null && fromSettings > 0) {
      return { ...f, ratePerSqft: fromSettings };
    }
    return f;
  });
}

export function parseProjectsFromCsv(
  headers: string[],
  dataRows: string[][],
  mapping: ColumnMapping,
  defaults: Pick<ImportOptions, "defaultClientName" | "defaultCompanyRate" | "defaultLocation" | "defaultStatus">,
  fielderRateMap: Map<string, number> = new Map(),
): { groups: ParsedProjectGroup[]; errors: string[] } {
  const objects = rowsToObjects(headers, dataRows);
  const errors: string[] = [];
  const groupMap = new Map<string, ParsedProjectGroup>();

  const hasLongFielder = Boolean(mapping.fielderName);

  objects.forEach((obj, idx) => {
    const rowNum = idx + 2;
    const codeRaw = cell(obj, mapping.projectCode);
    if (!codeRaw) {
      errors.push(`Row ${rowNum}: missing project number`);
      return;
    }
    const projectCode = normalizeProjectCode(codeRaw);
    const sqft = parseNum(cell(obj, mapping.totalSqft));
    if (sqft == null || sqft <= 0) {
      errors.push(`Row ${rowNum}: invalid SQFT for ${projectCode}`);
      return;
    }

    const clientName =
      cell(obj, mapping.clientName) || defaults.defaultClientName || "Unknown";
    const companyRate =
      parseNum(cell(obj, mapping.companyRate)) ?? defaults.defaultCompanyRate;
    const location = cell(obj, mapping.location) || defaults.defaultLocation;
    const statusRaw = cell(obj, mapping.status);
    const status = mapSheetStatus(statusRaw, defaults.defaultStatus);
    const qfield = normalizeQfieldFromSheet(cell(obj, mapping.qfield));
    const ecd = cell(obj, mapping.ecd) || null;
    const notes = cell(obj, mapping.notes) || null;
    const billingInvoiceNumber = cell(obj, mapping.invoiceNumber) || null;

    let fielders: ParsedFielder[] = [];
    if (hasLongFielder) {
      const rate = parseNum(cell(obj, mapping.fielderRate)) ?? 0;
      fielders = parseFielderNamesFromCell(cell(obj, mapping.fielderName), rate);
    } else {
      fielders = extractWideFielders(obj, headers);
    }
    fielders = applyFielderRatesFromSettings(fielders, fielderRateMap);

    const existing = groupMap.get(projectCode);
    if (existing) {
      existing.rowNumbers.push(rowNum);
      for (const f of fielders) {
        if (!existing.fielders.some((x) => x.name === f.name)) {
          existing.fielders.push(f);
        }
      }
      existing.fielders = applyFielderRatesFromSettings(existing.fielders, fielderRateMap);
      return;
    }

    groupMap.set(projectCode, {
      projectCode,
      clientName,
      totalSqft: Math.round(sqft),
      companyRatePerSqft: companyRate,
      location,
      status,
      qfield,
      ecd,
      notes,
      billingInvoiceNumber,
      fielders,
      rowNumbers: [rowNum],
    });
  });

  return { groups: Array.from(groupMap.values()), errors };
}

export async function buildImportPreview(
  groups: ParsedProjectGroup[],
  options: ImportOptions,
): Promise<PreviewProjectRow[]> {
  const preview: PreviewProjectRow[] = [];

  for (const group of groups) {
    const existing = await getProjectByCode(group.projectCode);
    let action: PreviewAction = "create_project";
    let message = "New project will be created";
    let existingProjectId: number | null = null;
    const assignmentsToAdd: ParsedFielder[] = [];
    const assignmentsSkipped: string[] = [];

    if (existing) {
      existingProjectId = existing.id;
      if (options.projectConflict === "skip") {
        action = "skip_project";
        message = "Project exists — skipped (policy)";
      } else if (options.projectConflict === "skip_project") {
        action = "skip_project";
        message = "Project exists — assignments only";
      } else {
        action = "update_project";
        message = "Project exists — SQFT, client, and rate will be updated";
      }
    }

    if (existing && action !== "skip_project" && options.projectConflict !== "skip") {
      const current = await getAssignmentsByProjectId(existing.id);
      const names = new Set(current.map((a) => a.fielderName.trim().toUpperCase()));
      for (const f of group.fielders) {
        if (names.has(f.name)) {
          assignmentsSkipped.push(f.name);
        } else {
          assignmentsToAdd.push(f);
        }
      }
    } else if (!existing && action === "create_project") {
      assignmentsToAdd.push(...group.fielders);
    } else if (existing && action === "skip_project") {
      const current = await getAssignmentsByProjectId(existing.id);
      const names = new Set(current.map((a) => a.fielderName.trim().toUpperCase()));
      for (const f of group.fielders) {
        if (names.has(f.name)) assignmentsSkipped.push(f.name);
        else assignmentsToAdd.push(f);
      }
    }

    preview.push({
      group,
      action,
      message,
      existingProjectId,
      assignmentsToAdd,
      assignmentsSkipped,
    });
  }

  return preview;
}

export type ImportResultSummary = {
  invoiceId: number;
  invoiceNumber: string;
  projectsCreated: number;
  projectsUpdated: number;
  projectsSkipped: number;
  assignmentsAdded: number;
  errors: string[];
};

export async function applyImportPreview(
  preview: PreviewProjectRow[],
  options: ImportOptions,
  importFilename?: string | null,
): Promise<ImportResultSummary> {
  const errors: string[] = [];
  let projectsCreated = 0;
  let projectsUpdated = 0;
  let projectsSkipped = 0;
  let assignmentsAdded = 0;

  const invoiceLines: Array<{
    projectCode: string;
    clientName: string | null;
    totalSqft: number;
    ratePerSqft: number;
    projectId: number | null;
  }> = [];

  const billingNumber = options.syncProjectInvoiceNumber ? options.invoiceNumber : null;

  for (const row of preview) {
    if (row.action === "error") continue;

    const g = row.group;
    let project: ProjectRow | undefined | null = null;

    try {
      if (row.action === "create_project") {
        project = await insertProject({
          projectCode: g.projectCode,
          clientName: g.clientName,
          location: g.location,
          totalSqft: g.totalSqft,
          companyRatePerSqft: g.companyRatePerSqft,
          status: g.status,
          ecd: g.ecd,
          notes: g.notes,
          qfield: g.qfield,
          invoiceNumber: billingNumber ?? g.billingInvoiceNumber,
        });
        projectsCreated++;
      } else if (row.action === "update_project" && row.existingProjectId) {
        const existing = await getProjectByCode(g.projectCode);
        if (!existing) {
          errors.push(`${g.projectCode}: project disappeared`);
        } else {
          await updateProject(existing.id, {
            projectCode: g.projectCode,
            clientName: g.clientName,
            location: g.location || existing.location,
            totalSqft: g.totalSqft,
            companyRatePerSqft: g.companyRatePerSqft,
            status: g.status || existing.status,
            ecd: g.ecd ?? existing.ecd,
            notes: g.notes ?? existing.notes,
            qfield: g.qfield ?? existing.qfield,
            invoiceNumber: billingNumber ?? g.billingInvoiceNumber ?? existing.invoiceNumber,
            workType: existing.workType,
            gdriveFolderUrl: existing.gdriveFolderUrl,
          });
          project = (await getProjectByCode(g.projectCode))!;
          projectsUpdated++;
        }
      } else if (row.existingProjectId) {
        project = (await getProjectByCode(g.projectCode)) ?? undefined;
        projectsSkipped++;
      } else {
        projectsSkipped++;
      }

      if (project) {
        for (const f of row.assignmentsToAdd) {
          if (!f.name) continue;
          await insertAssignment({
            projectId: project.id,
            fielderName: f.name,
            ratePerSqft: f.ratePerSqft > 0 ? f.ratePerSqft : 0,
            commissionPercentage: null,
            isInternal: f.ratePerSqft <= 0,
          });
          assignmentsAdded++;
        }
      }

      const linked =
        project?.id ??
        row.existingProjectId ??
        (await getProjectByCode(g.projectCode))?.id ??
        null;

      invoiceLines.push({
        projectCode: g.projectCode,
        clientName: g.clientName,
        totalSqft: g.totalSqft,
        ratePerSqft: g.companyRatePerSqft,
        projectId: linked,
      });
    } catch (e) {
      errors.push(`${g.projectCode}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  const clientName =
    options.defaultClientName ||
    preview[0]?.group.clientName ||
    "Various clients";

  const { invoice } = await createInvoiceWithLines({
    invoiceNumber: options.invoiceNumber,
    clientName,
    issueDate: options.issueDate,
    dueDate: options.dueDate,
    notes: options.notes,
    status: "final",
    source: "csv_import",
    importFilename: importFilename ?? null,
    lines: invoiceLines,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    projectsCreated,
    projectsUpdated,
    projectsSkipped,
    assignmentsAdded,
    errors,
  };
}
