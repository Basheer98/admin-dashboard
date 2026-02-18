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

- **Invoice / billing batch:** Each project has an optional **Invoice** field (e.g. `001`, `002`, `Jan-001`). Use it to group projects by client invoice or billing run.
- **Dashboard filter:** Filter by invoice so totals and charts show only that batch.
- **Invoice PDF:** From the dashboard (under “Filter by invoice”) or from **Projects** when filtered by invoice, use **Download PDF for {invoice}** or **Download invoice PDF** to get a one-page PDF: project list, SQFT, rate, revenue, and total. API: `GET /api/invoices/[invoiceNumber]/pdf`.
- **Bulk set invoice:** On **Projects**, select rows with the checkboxes, enter an invoice number in “Set invoice for selected”, and click **Apply** to set that invoice for all selected projects.

---

## Reports & dashboard

- **Period comparison:** The dashboard section **“Period comparison — are we doing better?”** compares the current period to the previous one (e.g. this month vs last month, or your chosen date range vs the same-length period before). It shows revenue, payouts, profit, and % change.
- **Profit margin:** The dashboard **Projects overview** table and the **Projects** list include **Profit** and **Margin %** (profit ÷ revenue). On Projects you can sort by Profit or Margin %.
- **Fielder reports:** **Fielders** lists each fielder with totals; **Fielders → [name]** shows that fielder’s assignments and payouts. **Manager commissions** and **Monthly** reports are under **Reports**.
- **Invoice column:** Tables that show projects (Dashboard, Projects, Assignments, Payments, Fielder reports, Monthly report, etc.) include an **Invoice** column so you can see which batch each row belongs to.

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
