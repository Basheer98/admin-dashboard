This is a [Next.js](https://nextjs.org) project: an **internal admin dashboard** for project, fielder, and payment management (e.g. field surveying / contracting).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Environment

- **Node.js** >= 20.9.0 (see `package.json` engines).
- **Postgres:** set `DATABASE_URL` in `.env` (or in your host’s variables). The app runs schema migrations on first use.

---

## Invoicing

### Invoices page (sidebar)

- **Invoices** — Card list of saved invoices; **Create new invoice** or **Import CSV**.
- **Manual create:** Enter invoice header (number, client, dates) and line items (project #, SQFT, company rate). **Look up** fills from an existing project. Optional **Sync to dashboard** creates/updates the project and adds fielder assignments per line.
- **Rates in Settings:** Set **default company billing rate** (client invoices) and **fielder payout rates** (dashboard assignments / fielder reports). CSV import and manual invoices use these automatically.
- **CSV import:** Export any month’s Project Tracker CSV (same columns: PROJECT ID, SQFT, ADDRESS, FIELDER, etc.). **Invoices → Import CSV** → map columns → **Review changes** (nothing is written until you click **Import changes**) → success/error popup. Then dashboard projects/assignments update and a **client invoice** PDF is ready. Rates come from Settings.
- **PDF:** On an invoice detail page, **Download PDF**, or `GET /api/invoice-records/[id]/pdf`.

### Project billing batch (legacy)

- **Invoice / billing batch:** Each project has an optional **Invoice** field (e.g. `001`, `002`, `Jan-001`). Use it to group projects by client invoice or billing run.
- **Dashboard filter:** Filter by invoice so totals and charts show only that batch.
- **Batch PDF:** From the dashboard (under “Filter by invoice”), **Download PDF for {invoice}** — `GET /api/invoices/[invoiceNumber]/pdf` (projects tagged with that batch).
- **Bulk set invoice:** On **Projects**, select rows with the checkboxes, enter an invoice number in “Set invoice for selected”, and click **Apply** to set that invoice for all selected projects.

---

## Reports & dashboard

- **Period comparison:** The dashboard section **“Period comparison — are we doing better?”** compares the current period to the previous one (e.g. this month vs last month, or your chosen date range vs the same-length period before). It shows revenue, payouts, profit, and % change.
- **Profit margin:** The dashboard **Projects overview** table and the **Projects** list include **Profit** and **Margin %** (profit ÷ revenue). On Projects you can sort by Profit or Margin %.
- **Fielder reports:** **Fielders** lists each fielder with totals; **Fielders → [name]** shows that fielder’s assignments and payouts. **Manager commissions** and **Monthly** reports are under **Reports**.
- **Invoice column:** Tables that show projects (Dashboard, Projects, Assignments, Payments, Fielder reports, Monthly report, etc.) include an **Invoice** column so you can see which batch each row belongs to.

---

## Reimbursements with Google Drive receipts

Fielders can submit reimbursement requests with receipt uploads from the fielder app (`/fielder/reimbursements`).

### Google Cloud setup

1. Create/select a Google Cloud project.
2. Enable **Google Drive API**.
3. Create a **Service Account** and generate a JSON key.
4. Create a Google Drive folder for receipts.
5. Share that folder with the service-account email as **Editor**.

### Required environment variables

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (use `\n` escaped newlines in `.env`)
- `GOOGLE_DRIVE_RECEIPTS_FOLDER_ID`

### Upload rules (implemented)

- Allowed file types: `jpg`, `jpeg`, `png`, `pdf`
- Max file size: `10 MB`
- Auto filename format: `FIELDER_YYYYMMDD_TRIPID_CATEGORY.ext`
- Receipts are uploaded to Drive and linked in:
  - trip expenses
  - fielder pending reimbursement tables
  - admin reimbursement review

### Reimbursement flow

- Fielder submits reimbursement with receipt.
- Request is stored as a reimbursable trip expense.
- Pending reimbursement amount is added to fielder pending dues.
- When admin logs payment to that fielder, reimbursement entries are marked paid.

---

## Email ingest automation (dashboard-first)

Use this when incoming work updates arrive by email and you want to stop manual double entry in Google Sheets.

- Configure from **Settings → Email ingest automation**.
- Review and approve exceptions in **Email ingest** queue.
- Export approved ingest rows to CSV (`/api/export/email-ingest`) for optional Sheets reporting.

### Webhook endpoints

- `POST /api/ingest/email` — receive canonical email payloads
- `POST /api/ingest/email/process-due` — retry failed retryable queue items (call from cron)

Both endpoints require the webhook secret via either:

- `Authorization: Bearer <secret>`
- `x-ingest-secret: <secret>`

### Canonical payload

```json
{
  "source": "GMAIL",
  "externalMessageId": "<gmail-message-id>",
  "senderEmail": "ops@example.com",
  "senderName": "Operations",
  "receivedAt": "2026-04-27T05:20:00.000Z",
  "subject": "Trip expense update",
  "bodyText": "Optional original text",
  "entityType": "REIMBURSEMENT",
  "confidence": 0.98,
  "fielderName": "NIVAS",
  "projectCode": "P-1001",
  "tripName": "Colorado Sprint Apr",
  "reimbursement": {
    "expenseDate": "2026-04-26",
    "category": "GAS",
    "amount": 72.5,
    "currency": "USD",
    "reimbursable": true,
    "vendor": "Shell",
    "notes": "Route A to B"
  }
}
```

For ticket ingestion, set `"entityType": "TICKET"` and provide a `ticket` object with `title`, `description`, `category`, and `priority`.

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
