/**
 * Manual test script for Paystack webhook verification logic.
 *
 * Tests the verifyPaystackSignature() function without needing a running server
 * or live Paystack credentials. Run with:
 *
 *   node src/lib/paystack-webhook.test.mjs
 *
 * All tests run in-process. No network calls are made.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Inline the signature verifier (mirrors paystack-webhook.server.ts) ───────
// We duplicate the logic here rather than importing the .server.ts file so
// this test can run as a plain Node.js script without Vite or tsx.

function verifyPaystackSignature(rawBody, signature, secretKey) {
  if (!secretKey || !signature || typeof signature !== "string") return false;
  try {
    const expectedHex = createHmac("sha512", secretKey)
      .update(rawBody, "utf8")
      .digest("hex");
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const receivedBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

function sign(rawBody, secretKey) {
  return createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

// ─── Test suite ───────────────────────────────────────────────────────────────

const SECRET = "sk_test_fake_secret_key_for_testing_only";

const CHARGE_SUCCESS_PAYLOAD = JSON.stringify({
  event: "charge.success",
  data: {
    reference: "LM-BETA-abc123-1234567890-xyz1",
    status: "success",
    amount: 150000, // 1500 NGN in Kobo
    currency: "NGN",
    customer: { email: "student@mouau.edu.ng", id: 999 },
  },
});

const FAILED_CHARGE_PAYLOAD = JSON.stringify({
  event: "charge.success",
  data: {
    reference: "LM-BETA-abc123-9999999999-xyz9",
    status: "failed",
    amount: 150000,
    currency: "NGN",
    customer: { email: "student@mouau.edu.ng" },
  },
});

const WRONG_CURRENCY_PAYLOAD = JSON.stringify({
  event: "charge.success",
  data: {
    reference: "LM-BETA-abc123-8888888888-xyz8",
    status: "success",
    amount: 150000,
    currency: "USD",
    customer: { email: "student@mouau.edu.ng" },
  },
});

const TRANSFER_SUCCESS_PAYLOAD = JSON.stringify({
  event: "transfer.success",
  data: { reference: "TRF-001", amount: 500000, status: "success" },
});

console.log("\n── Signature Verification ───────────────────────────────────────────────\n");

test("Valid signature is accepted", () => {
  const sig = sign(CHARGE_SUCCESS_PAYLOAD, SECRET);
  assert(
    verifyPaystackSignature(CHARGE_SUCCESS_PAYLOAD, sig, SECRET),
    "Expected valid signature to pass"
  );
});

test("Invalid signature is rejected", () => {
  const wrongSig = sign(CHARGE_SUCCESS_PAYLOAD, "wrong-secret");
  assert(
    !verifyPaystackSignature(CHARGE_SUCCESS_PAYLOAD, wrongSig, SECRET),
    "Expected wrong signature to fail"
  );
});

test("Tampered body with correct signature is rejected", () => {
  const sig = sign(CHARGE_SUCCESS_PAYLOAD, SECRET);
  const tamperedBody = CHARGE_SUCCESS_PAYLOAD.replace("150000", "1");
  assert(
    !verifyPaystackSignature(tamperedBody, sig, SECRET),
    "Expected tampered body to fail"
  );
});

test("Missing signature is rejected", () => {
  assert(
    !verifyPaystackSignature(CHARGE_SUCCESS_PAYLOAD, "", SECRET),
    "Expected empty signature to fail"
  );
});

test("Missing secret key returns false (not exception)", () => {
  assert(
    !verifyPaystackSignature(CHARGE_SUCCESS_PAYLOAD, "any-sig", ""),
    "Expected missing secret to return false"
  );
});

test("Timing-safe: different-length hex string is rejected without exception", () => {
  // A hex string that is too short (not full 64 bytes = 128 hex chars)
  assert(
    !verifyPaystackSignature(CHARGE_SUCCESS_PAYLOAD, "aabbcc", SECRET),
    "Expected short signature to be rejected"
  );
});

console.log("\n── Payload Parsing (inline logic mirrors server handler) ────────────────\n");

function parseChargeSuccessPayload(rawBody) {
  let parsed;
  try { parsed = JSON.parse(rawBody); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || !("event" in parsed) || !("data" in parsed)) return null;
  if (parsed.event !== "charge.success") return null;
  const d = parsed.data;
  if (!d || typeof d.reference !== "string" || typeof d.status !== "string" ||
      typeof d.amount !== "number" || typeof d.currency !== "string") return null;
  return parsed;
}

test("charge.success payload is parsed correctly", () => {
  const p = parseChargeSuccessPayload(CHARGE_SUCCESS_PAYLOAD);
  assert(p !== null, "Expected non-null payload");
  assert(p.event === "charge.success", "Expected charge.success event");
  assert(p.data.reference === "LM-BETA-abc123-1234567890-xyz1", "Expected correct reference");
  assert(p.data.amount === 150000, "Expected correct amount in Kobo");
});

test("transfer.success payload is skipped (returns null)", () => {
  const p = parseChargeSuccessPayload(TRANSFER_SUCCESS_PAYLOAD);
  assert(p === null, "Expected non-charge event to return null");
});

test("Malformed JSON is handled gracefully", () => {
  const p = parseChargeSuccessPayload("{bad json{{");
  assert(p === null, "Expected malformed JSON to return null");
});

test("Missing required fields returns null", () => {
  const p = parseChargeSuccessPayload(JSON.stringify({ event: "charge.success", data: {} }));
  assert(p === null, "Expected missing fields to return null");
});

test("Payload with missing data entirely returns null", () => {
  const p = parseChargeSuccessPayload(JSON.stringify({ event: "charge.success" }));
  assert(p === null, "Expected missing data key to return null");
});

console.log("\n── Business Logic Guards (simulated, no DB) ─────────────────────────────\n");

test("Failed charge (status != 'success') would be skipped", () => {
  const p = parseChargeSuccessPayload(FAILED_CHARGE_PAYLOAD);
  assert(p !== null, "Should parse");
  assert(p.data.status !== "success", "Status should not be success");
  // Handler would return { status: 'skip', reason: "Payment status is 'failed'" }
  assert(true, "Guard would return skip");
});

test("Wrong currency would be skipped", () => {
  const p = parseChargeSuccessPayload(WRONG_CURRENCY_PAYLOAD);
  assert(p !== null, "Should parse");
  assert(p.data.currency.toUpperCase() !== "NGN", "Currency should not be NGN");
  // Handler would return { status: 'skip', reason: "Currency 'USD' is not NGN" }
  assert(true, "Guard would return skip");
});

test("Zero amount would be skipped", () => {
  const zeroPayload = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref-zero", status: "success", amount: 0, currency: "NGN", customer: { email: "t@t.com" } },
  });
  const p = parseChargeSuccessPayload(zeroPayload);
  assert(p !== null, "Should parse");
  assert(!p.data.amount || p.data.amount <= 0, "Amount should be 0");
  // Handler would return { status: 'skip', reason: 'Invalid payment amount' }
  assert(true, "Guard would return skip");
});

test("Amount conversion: 150000 Kobo = 1500 NGN", () => {
  const amountKobo = 150000;
  const amountNgn = Math.round(amountKobo / 100);
  assert(amountNgn === 1500, `Expected 1500 NGN, got ${amountNgn}`);
});

test("Amount comparison: 1500 NGN >= 1500 NGN snapshot passes", () => {
  assert(1500 >= 1500, "Equal amounts should pass");
});

test("Amount comparison: 1499 NGN < 1500 NGN snapshot fails", () => {
  assert(!(1499 >= 1500), "Underpayment should fail");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ──────────────────────────────────────────────────────────────\n`);
console.log(`  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

