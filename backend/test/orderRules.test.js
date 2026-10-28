const test = require("node:test");
const assert = require("node:assert");
const { validateOrderInput, calcTotals } = require("../lib/orderRules");

const base = {
  items: [{ productId: "x", quantity: 1 }],
  shippingAddress: { name: "A", phone: "0700", email: "a@b.co", street: "Langata Rd" },
  deliveryZone: "langata",
  paymentMethod: "cod",
};

test("valid cash order passes", () => assert.strictEqual(validateOrderInput(base), null));
test("mpesa rejected for now", () =>
  assert.match(validateOrderInput({ ...base, paymentMethod: "mpesa" }), /Cash on delivery/));
test("empty cart rejected", () => assert.match(validateOrderInput({ ...base, items: [] }), /empty/));
test("pickup needs a valid point", () =>
  assert.match(validateOrderInput({ ...base, deliveryZone: "nairobi-pickup", pickupLocation: "Nowhere" }), /pickup/i));
test("outside Nairobi needs county/town", () =>
  assert.match(validateOrderInput({ ...base, deliveryZone: "outside-nairobi" }), /County/));
test("totals add shipping", () =>
  assert.deepStrictEqual(calcTotals([{ price: 1000, quantity: 2 }], "outside-nairobi"),
    { subtotal: 2000, shippingFee: 200, total: 2200 }));
