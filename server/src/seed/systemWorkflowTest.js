import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = process.env.API_URL || "http://localhost:5001/api";
const here = path.dirname(fileURLToPath(import.meta.url));
const seedScript = path.join(here, "systemTestData.js");
const checks = [];

async function request(route, { token, method = "GET", body } = {}) {
  const response = await fetch(`${API_URL}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${route} failed (${response.status}): ${data.message || text}`);
  }
  return data;
}

async function login(email, password, customer = false) {
  const route = customer ? "/auth/customer/login" : "/auth/login";
  const data = await request(route, { method: "POST", body: { email, password } });
  return data.token;
}

function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log(`PASS ${name}`);
}

async function run() {
  const repToken = await login("system-test-user-1@example.com", "SystemTest@123");
  const managerToken = await login("manager@dealflow360.com", "Manager@123");
  const financeToken = await login("finance@dealflow360.com", "Finance@123");
  const customerToken = await login("system-test-customer-1@example.com", "SystemTest@123", true);

  const customers = (await request("/admin/customers", { token: repToken })).customers;
  const products = (await request("/admin/products", { token: repToken })).products;
  const customer = customers.find((item) => item.email === "system-test-customer-1@example.com");
  const product = products.find((item) => item.active);
  check("catalog and customer data are readable", customer && product);

  const created = (await request("/quotes", {
    token: repToken,
    method: "POST",
    body: {
      customerId: customer._id,
      lines: [{ productId: product._id, quantity: 2, discountPct: 15 }],
    },
  })).quote;
  const updated = (await request(`/quotes/${created._id}`, {
    token: repToken,
    method: "PUT",
    body: {
      notes: "SYSTEM_TEST",
      expectedVersion: created.version,
      lines: [{ _id: created.lines[0]._id, quantity: 3 }],
    },
  })).quote;
  check("quote create and update persist", updated.lines[0].quantity === 3 && updated.version > created.version);

  const detail = await request(`/quotes/${created._id}`, { token: repToken });
  check("quote detail loads intelligence", detail.risk && detail.dealerComparison && detail.settings);
  const whatIf = await request(`/quotes/${created._id}/what-if`, {
    token: repToken,
    method: "POST",
    body: { discountPct: 10 },
  });
  check("what-if simulation returns current and simulated values", whatIf.current && whatIf.simulation);
  const comparison = await request(`/quotes/${created._id}/dealer-comparison`, { token: repToken });
  check("dealer comparison returns scored offers", Array.isArray(comparison.comparison?.perLine));

  const portalBefore = await request(`/customer/quotes/${created._id}`, { token: customerToken });
  const line = portalBefore.quote.lines[0];
  const comment = (await request(`/customer/quotes/${created._id}/comment`, {
    token: customerToken,
    method: "POST",
    body: { lineId: line._id, text: "Need delivery before month end", expectedVersion: portalBefore.quote.version },
  })).quote;
  const negotiation = await request(`/customer/quotes/${created._id}/negotiate`, {
    token: customerToken,
    method: "POST",
    body: { discountPct: 10, expectedVersion: comment.version },
  });
  const repAfterNegotiation = await request(`/quotes/${created._id}`, { token: repToken });
  const managerAfterNegotiation = await request(`/quotes/${created._id}`, { token: managerToken });
  const financeAfterNegotiation = await request(`/quotes/${created._id}`, { token: financeToken });
  const portalAfterNegotiation = await request(`/customer/quotes/${created._id}`, { token: customerToken });
  check("customer comment persists", repAfterNegotiation.quote.lines[0].comment === "Need delivery before month end");
  check("negotiation is synchronized across roles", repAfterNegotiation.quote.negotiationStatus === managerAfterNegotiation.quote.negotiationStatus && managerAfterNegotiation.quote.negotiationStatus === financeAfterNegotiation.quote.negotiationStatus && portalAfterNegotiation.negotiations.length > 0);
  check("negotiation response contains decision", negotiation.negotiation?.decision);

  const autoQuote = (await request("/quotes", { token: repToken })).quotes.find((quote) => quote.approvalStatus === "Pending");
  if (autoQuote) {
    const autoBefore = await request(`/quotes/${autoQuote._id}`, { token: managerToken });
    const autoResult = await request(`/quotes/${autoQuote._id}/negotiate`, {
      token: managerToken,
      method: "POST",
      body: { requestedPrice: autoBefore.quote.subtotal, expectedVersion: autoBefore.quote.version },
    });
    const managerQueue = await request("/approvals", { token: managerToken });
    check("auto-accepted negotiation removes pending approval", autoResult.result.decision === "AUTO_ACCEPT" && autoResult.quote?.approvalStatus === "Approved" && !managerQueue.approvals.some((approval) => String(approval.quoteId?._id) === String(autoQuote._id)));
  }

  const submitted = await request(`/quotes/${created._id}/submit`, {
    token: repToken,
    method: "POST",
    body: { expectedVersion: repAfterNegotiation.quote.version },
  });
  check("quote submission routes or auto-approves", submitted.quote && (submitted.autoApproved || submitted.approvalChain));

  let current = await request(`/quotes/${created._id}`, { token: repToken });
  const managerApprovals = (await request("/approvals", { token: managerToken })).approvals.filter((item) => String(item.quoteId?._id) === String(created._id));
  if (managerApprovals.length) {
    await request(`/approvals/${managerApprovals[0]._id}/review`, {
      token: managerToken,
      method: "POST",
      body: { status: "approve", reason: "Automated workflow test" },
    });
  }
  const financeApprovals = (await request("/approvals", { token: financeToken })).approvals.filter((item) => String(item.quoteId?._id) === String(created._id));
  if (financeApprovals.length) {
    await request(`/approvals/${financeApprovals[0]._id}/review`, {
      token: financeToken,
      method: "POST",
      body: { status: "approve", reason: "Automated workflow test" },
    });
  }
  current = await request(`/quotes/${created._id}`, { token: repToken });
  check("approval state is persisted", current.quote.approvalStatus === "Approved" || current.quote.approvalStatus === "Not Required");

  if (current.quote.approvalStatus !== "Approved") {
    throw new Error(`Quote did not reach an approvable state: ${current.quote.approvalStatus}`);
  }
  const confirmed = (await request(`/quotes/${created._id}/confirm`, {
    token: repToken,
    method: "POST",
    body: { expectedVersion: current.quote.version },
  })).quote;
  check("approved quote can be confirmed", Boolean(confirmed.wonAt));

  const fulfillment = await request(`/quotes/${created._id}/fulfillment`, {
    token: repToken,
    method: "POST",
    body: { expectedVersion: confirmed.version },
  });
  check("fulfillment plan is generated", fulfillment.plan && fulfillment.plan.status);
  const billing = await request(`/quotes/${created._id}/billing`, { token: repToken });
  check("billing preview is generated", billing.billing && billing.billing.billingType && billing.billing.oneTimeInvoice);

  const dashboard = await request("/dashboard", { token: managerToken });
  const intelligence = await request("/dashboard/deal-intelligence", { token: managerToken });
  const dealerIntelligence = await request("/dashboard/dealer-intelligence", { token: managerToken });
  const reports = await request("/reports", { token: managerToken });
  const portalDashboard = await request("/customer/dashboard", { token: customerToken });
  check("manager dashboard endpoints return data", dashboard.stats && intelligence.counts && dealerIntelligence.dealers && reports.report);
  check("customer dashboard reflects the quote", portalDashboard.stats && portalDashboard.recentQuotes.some((quote) => String(quote._id) === String(created._id)));

  const customerQuotes = (await request("/customer/quotes", { token: customerToken })).quotes;
  let counterAccepted = false;
  for (const customerQuote of customerQuotes) {
    const counterDetail = await request(`/customer/quotes/${customerQuote._id}`, { token: customerToken });
    const accepted = counterDetail.negotiations.find((item) => item.status === "Counter Offered");
    if (!accepted) continue;
    await request(`/customer/quotes/${customerQuote._id}/accept-counter`, {
      token: customerToken,
      method: "POST",
      body: { negotiationId: accepted.id, expectedVersion: counterDetail.quote.version },
    });
    counterAccepted = true;
    break;
  }
  if (counterAccepted) check("customer can accept a counter-offer", true);
  else console.log("SKIP customer counter-offer acceptance: seeded data had no counter-offer");

  console.log(`Workflow smoke test passed: ${checks.length} checks`);
}

let seeded = false;
try {
  execFileSync(process.execPath, [seedScript], { cwd: path.resolve(here, "../.."), stdio: "inherit" });
  seeded = true;
  await run();
} catch (error) {
  console.error(`Workflow smoke test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (seeded) {
    try {
      execFileSync(process.execPath, [seedScript, "cleanup"], { cwd: path.resolve(here, "../.."), stdio: "inherit" });
    } catch (cleanupError) {
      console.error(`Workflow cleanup failed: ${cleanupError.message}`);
      process.exitCode = 1;
    }
  }
}
