import { cookies } from "next/headers";
import { getSettings } from "@/lib/db";
import { SidebarLayout } from "@/app/components/SidebarLayout";

const LAST_BACKUP_COOKIE = "last_backup_at";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const RESTORE_MESSAGES: Record<string, string> = {
  ok: "Backup restored successfully.",
  "no-file": "No file selected.",
  read: "Could not read file.",
  "invalid-json": "File is not valid JSON.",
  "invalid-shape": "File does not have the expected backup format (projects, assignments, payments).",
  write: "Could not write to data file.",
  error: "Restore failed.",
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const error = sp.error === "invalid";
  const restoreStatus = typeof sp.restore === "string" ? sp.restore : "";
  const restoreMessage = typeof sp.message === "string" ? RESTORE_MESSAGES[sp.message] ?? RESTORE_MESSAGES.error : RESTORE_MESSAGES[restoreStatus] ?? "";
  const normalized = sp.normalized === "1";
  const normalizedCount = typeof sp.count === "string" ? Number(sp.count) : 0;
  const settings = getSettings();

  const cookieStore = await cookies();
  const lastBackupAtRaw = cookieStore.get(LAST_BACKUP_COOKIE)?.value;
  const lastBackupAt = lastBackupAtRaw ? decodeURIComponent(lastBackupAtRaw) : null;
  const lastBackupLabel = lastBackupAt
    ? new Date(lastBackupAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <SidebarLayout title="Settings" current="settings">
      <div className="flex flex-1 flex-col gap-8">
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Settings saved.
          </div>
        )}
        {restoreStatus === "ok" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {restoreMessage}
          </div>
        )}
        {restoreStatus === "error" && restoreMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {restoreMessage}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Please enter a valid exchange rate (positive number) or leave empty to hide INR.
          </div>
        )}
        {normalized && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {normalizedCount > 0
              ? `Normalized ${normalizedCount} fielder name(s) to uppercase. Duplicate entries like "naveen" and "Naveen" are now merged.`
              : "All fielder names were already uppercase. No changes made."}
          </div>
        )}
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Currency conversion
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Set the USD to INR exchange rate to display amounts in both currencies on the dashboard and elsewhere. Leave empty to show USD only.
          </p>
          <form method="POST" action="/api/settings" className="max-w-sm space-y-4">
            <div className="space-y-1">
              <label className="label">
                1 USD = ? INR
              </label>
              <input
                type="number"
                name="usdToInrRate"
                step="0.01"
                min="0"
                placeholder="e.g. 83.5"
                defaultValue={settings.usdToInrRate ?? ""}
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary px-5 py-2.5">
              Save
            </button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Fielder names
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            If you see duplicate fielders (e.g. &quot;naveen&quot; and &quot;Naveen&quot;) in Fielder reports, run this to convert all fielder names to uppercase in the database. New assignments already save names in uppercase.
          </p>
          {lastBackupLabel && (
            <p className="mb-3 text-xs text-slate-500">
              Tip: Create a backup first so you can recover. Last backup: {lastBackupLabel}
            </p>
          )}
          <form method="POST" action="/api/settings/normalize-fielder-names" className="mb-8">
            <button type="submit" className="btn-secondary">
              Normalize all fielder names to uppercase
            </button>
          </form>

          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Backup &amp; restore
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Download a copy of all data (data.json including settings) for disaster recovery. Restore from a previously downloaded backup file.
          </p>
          {lastBackupLabel && (
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Last backup at {lastBackupLabel}. Create a backup before restore or normalize so you can recover if needed.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <a href="/api/backup" download className="btn-primary inline-block px-5 py-2.5">
                Download backup
              </a>
              <p className="mt-1 text-xs text-slate-500">
                Saves as backup-YYYY-MM-DD.json. Downloading updates &quot;Last backup at&quot; above.
              </p>
            </div>
            <form method="POST" action="/api/restore" encType="multipart/form-data" className="space-y-2">
              <label className="label">
                Restore from file
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  name="file"
                  accept=".json,application/json"
                  required
                  className="text-sm text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  Restore
                </button>
              </div>
              <p className="text-xs text-slate-500">
                This overwrites all current data. Download a backup first so you can recover if needed.
              </p>
            </form>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
