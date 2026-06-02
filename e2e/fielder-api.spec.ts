import { test, expect, type APIRequestContext } from "@playwright/test";

const fielderEmail = process.env.FIELDER_EMAIL;
const fielderPassword = process.env.FIELDER_PASSWORD;

async function getFielderToken(request: APIRequestContext) {
  if (!fielderEmail || !fielderPassword) return null;
  const res = await request.post("/api/auth/login", {
    data: { email: fielderEmail, password: fielderPassword },
  });
  if (!res.ok()) return null;
  const json = await res.json();
  return typeof json?.token === "string" ? json.token : null;
}

test.describe("Fielder APIs", () => {
  test("travel endpoint requires auth", async ({ request }) => {
    const res = await request.get("/api/fielder/travel");
    expect(res.status()).toBe(401);
  });

  test("can fetch travel/tickets/reimbursements with token", async ({ request }) => {
    const token = await getFielderToken(request);
    test.skip(!token, "FIELDER_EMAIL/FIELDER_PASSWORD required");
    const headers = { Authorization: `Bearer ${token}` };

    const travel = await request.get("/api/fielder/travel", { headers });
    expect(travel.status()).toBe(200);
    const travelJson = await travel.json();
    expect(Array.isArray(travelJson.trips)).toBeTruthy();

    const tickets = await request.get("/api/fielder/tickets", { headers });
    expect(tickets.status()).toBe(200);
    const ticketsJson = await tickets.json();
    expect(Array.isArray(ticketsJson.tickets)).toBeTruthy();

    const reimbursements = await request.get("/api/fielder/reimbursements", { headers });
    expect(reimbursements.status()).toBe(200);
    const reimbursementsJson = await reimbursements.json();
    expect(Array.isArray(reimbursementsJson.reimbursements)).toBeTruthy();
  });

  test("can create ticket and list includes it", async ({ request }) => {
    const token = await getFielderToken(request);
    test.skip(!token, "FIELDER_EMAIL/FIELDER_PASSWORD required");
    const headers = { Authorization: `Bearer ${token}` };
    const title = `API ticket ${Date.now()}`;

    const createRes = await request.post("/api/fielder/tickets", {
      headers,
      data: {
        title,
        description: "Created by integration test",
        category: "OTHER",
        priority: "LOW",
      },
    });
    expect(createRes.status()).toBe(200);

    const listRes = await request.get("/api/fielder/tickets", { headers });
    expect(listRes.status()).toBe(200);
    const listJson = await listRes.json();
    const found = (listJson.tickets ?? []).some((t: { title?: string }) => t.title === title);
    expect(found).toBeTruthy();
  });

  test("reimbursement upload validates missing receipt", async ({ request }) => {
    const token = await getFielderToken(request);
    test.skip(!token, "FIELDER_EMAIL/FIELDER_PASSWORD required");
    const headers = { Authorization: `Bearer ${token}` };

    const res = await request.post("/api/fielder/reimbursements", {
      headers,
      multipart: {
        tripId: "9999999",
        expenseDate: new Date().toISOString().slice(0, 10),
        category: "GAS",
        amount: "100",
        currency: "USD",
      },
    });
    expect([400, 403]).toContain(res.status());
  });
});
