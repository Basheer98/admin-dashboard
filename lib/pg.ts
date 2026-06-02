import { Pool } from "pg";

let pool: Pool | null = null;
let schemaDone = false;

export function getPool(): Pool {
  if (!pool) {
    const conn = process.env.DATABASE_URL;
    if (!conn) {
      throw new Error(
        "DATABASE_URL is not set. Add it in .env for local dev or in Railway Variables for production.",
      );
    }
    pool = new Pool({
      connectionString: conn,
      ssl: conn.startsWith("postgres://") && !conn.includes("localhost")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

export async function runSchema(): Promise<void> {
  if (schemaDone) return;
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      project_code TEXT NOT NULL,
      client_name TEXT NOT NULL,
      location TEXT NOT NULL,
      total_sqft INTEGER NOT NULL,
      company_rate_per_sqft NUMERIC(12,6) NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      ecd TEXT NULL,
      notes TEXT NULL,
      qfield TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ NULL
    );
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE projects ADD COLUMN qfield TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE projects ADD COLUMN invoice_number TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE projects ADD COLUMN work_type TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE projects ADD COLUMN gdrive_folder_url TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    UPDATE projects SET status = 'ASSIGNED' WHERE status = 'NOT_STARTED';
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS project_issues (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      reported_by TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ NULL,
      resolved_by TEXT NULL
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      city TEXT NULL,
      team_members TEXT NULL,
      budget_car NUMERIC(12,2) NULL,
      budget_accommodation NUMERIC(12,2) NULL,
      budget_gas NUMERIC(12,2) NULL,
      budget_tools NUMERIC(12,2) NULL,
      project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NULL,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN ALTER TABLE trips ADD COLUMN team_members TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trips ADD COLUMN budget_car NUMERIC(12,2) NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trips ADD COLUMN budget_accommodation NUMERIC(12,2) NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trips ADD COLUMN budget_gas NUMERIC(12,2) NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trips ADD COLUMN budget_tools NUMERIC(12,2) NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS trip_expenses (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      paid_by TEXT NULL,
      receipt_url TEXT NULL,
      reimbursable BOOLEAN NOT NULL DEFAULT FALSE,
      reimbursed_at TIMESTAMPTZ NULL,
      reimbursed_by_payment_id INTEGER NULL REFERENCES payments(id) ON DELETE SET NULL,
      vendor TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS trip_fielders (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      fielder_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (trip_id, fielder_name)
    );
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN receipt_url TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN reimbursable BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN reimbursed_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN reimbursed_by_payment_id INTEGER NULL REFERENCES payments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN approved_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN approved_by TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN rejected_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN rejected_by TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE trip_expenses ADD COLUMN rejection_note TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      fielder_name TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      description TEXT NOT NULL,
      project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
      trip_id INTEGER NULL REFERENCES trips(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      resolution_note TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      fielder_name TEXT NOT NULL,
      rate_per_sqft NUMERIC(12,6) NOT NULL,
      commission_percentage NUMERIC(10,6) NULL,
      is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      managed_by_fielder_id INTEGER NULL,
      manager_rate_per_sqft NUMERIC(10,6) NULL,
      manager_commission_share NUMERIC(10,6) NULL,
      due_date TEXT NULL,
      archived_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      fielder_assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      currency TEXT NOT NULL,
      method TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      voided_at TIMESTAMPTZ NULL
    );
    CREATE TABLE IF NOT EXISTS additional_work (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      project_number TEXT NOT NULL,
      our_project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
      assigned_fielder_assignment_id INTEGER NULL REFERENCES assignments(id) ON DELETE SET NULL,
      distance NUMERIC(12,2) NULL,
      rate_for_entire_job NUMERIC(12,2) NULL,
      amount NUMERIC(12,2) NULL,
      due_date TEXT NULL,
      completed_at TEXT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      usd_to_inr_rate NUMERIC(12,4) NULL
    );
    INSERT INTO settings (id, usd_to_inr_rate) VALUES (1, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN company_rate_per_sqft NUMERIC(12,6) NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS fielder_rates (
      fielder_name TEXT PRIMARY KEY,
      rate_per_sqft NUMERIC(12,6) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN admin_phone TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN email_ingest_enabled BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN email_ingest_webhook_secret TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN email_ingest_auto_approve BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN email_ingest_auto_approve_min_confidence NUMERIC(4,3) NOT NULL DEFAULT 0.950; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NULL
    );
    CREATE TABLE IF NOT EXISTS fielder_logins (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      fielder_name TEXT NOT NULL,
      role TEXT NULL,
      region TEXT NULL,
      gdrive_root_folder_url TEXT NULL
    );
    CREATE TABLE IF NOT EXISTS assignment_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS assignment_template_items (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES assignment_templates(id) ON DELETE CASCADE,
      fielder_name TEXT NOT NULL,
      rate_per_sqft NUMERIC(12,6) NOT NULL,
      commission_percentage NUMERIC(10,6) NULL,
      is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      manager_fielder_name TEXT NULL,
      manager_rate_per_sqft NUMERIC(10,6) NULL,
      manager_commission_share NUMERIC(10,6) NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NULL,
      details JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS email_ingest_records (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'GMAIL',
      external_message_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      sender_email TEXT NULL,
      sender_name TEXT NULL,
      subject TEXT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      raw_payload JSONB NOT NULL,
      parsed_payload JSONB NOT NULL,
      normalized_payload JSONB NULL,
      entity_type TEXT NULL,
      confidence NUMERIC(4,3) NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      retries INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      last_processed_at TIMESTAMPTZ NULL,
      approved_at TIMESTAMPTZ NULL,
      approved_by TEXT NULL,
      rejected_at TIMESTAMPTZ NULL,
      rejected_by TEXT NULL,
      rejection_reason TEXT NULL,
      created_entity_type TEXT NULL,
      created_entity_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS email_ingest_records_status_created_idx
      ON email_ingest_records (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS email_ingest_records_next_attempt_idx
      ON email_ingest_records (next_attempt_at)
      WHERE status = 'FAILED_RETRYABLE';
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE fielder_logins ADD COLUMN role TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE fielder_logins ADD COLUMN region TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    DO $$ BEGIN ALTER TABLE fielder_logins ADD COLUMN gdrive_root_folder_url TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS fielder_push_tokens (
      fielder_name TEXT NOT NULL PRIMARY KEY,
      expo_push_token TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NULL,
      notes TEXT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      source TEXT NOT NULL DEFAULT 'manual',
      import_filename TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      project_code TEXT NOT NULL,
      client_name TEXT NULL,
      total_sqft INTEGER NOT NULL,
      rate_per_sqft NUMERIC(12,6) NOT NULL,
      project_id INTEGER NULL REFERENCES projects(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx ON invoice_line_items (invoice_id);
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN ALTER TABLE invoices ADD COLUMN client_id INTEGER NULL REFERENCES clients(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE invoices ADD COLUMN bill_to_address TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE invoices ADD COLUMN bill_to_email TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE clients ADD COLUMN email TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_name TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_address TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_gstin TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_lut TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_service_description TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_sac_line TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_bank_details TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_issuer_export_declaration TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE settings ADD COLUMN invoice_place_of_supply TEXT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  schemaDone = true;
}

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await runSchema();
  const result = await getPool().query(sql, params);
  return (result.rows ?? []) as T[];
}

/** Run a query and return the first row or undefined */
export async function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

/** Run a query that returns a single value (e.g. INSERT ... RETURNING id) */
export async function queryOneRow<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}
