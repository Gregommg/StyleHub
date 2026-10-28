// Pure checkout rules (no DB) so they can be unit tested.
const VALID_ZONES = ["langata", "nairobi-pickup", "outside-nairobi"];
const VALID_PICKUPS = [
  "Langata China Square",
  "Langata Hub",
  "Development House, Nairobi CBD",
  "Carrefour Ngong Road",
  "National Library",
];
const SHIPPING_FEES = { langata: 50, "nairobi-pickup": 0, "outside-nairobi": 200 };

// Cash only for now. Add "mpesa" here once STK push is implemented.
const PAYMENT_METHODS = ["cod"];

function validateOrderInput({ items, shippingAddress, deliveryZone, pickupLocation, paymentMethod }) {
  if (!Array.isArray(items) || !items.length) return "Your cart is empty";
  if (!shippingAddress?.name || !shippingAddress?.phone || !shippingAddress?.email)
    return "Customer name, phone and email are required";
  if (!VALID_ZONES.includes(deliveryZone)) return "Choose a valid delivery option";
  if (!PAYMENT_METHODS.includes(paymentMethod)) return "Cash on delivery is the only payment method for now";
  if (deliveryZone === "langata" && !shippingAddress.street)
    return "Enter your Langata delivery location or map pin";
  if (deliveryZone === "nairobi-pickup" && !VALID_PICKUPS.includes(pickupLocation))
    return "Choose a valid Nairobi pickup point";
  if (deliveryZone === "outside-nairobi" &&
      (!shippingAddress.county || !shippingAddress.town || !shippingAddress.street))
    return "County, town and nearby location are required";
  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)
      return "Each order item needs a product and valid quantity";
  }
  return null;
}

function calcTotals(lines, deliveryZone) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shippingFee = SHIPPING_FEES[deliveryZone] ?? 0;
  return { subtotal, shippingFee, total: subtotal + shippingFee };
}

module.exports = { VALID_ZONES, VALID_PICKUPS, SHIPPING_FEES, PAYMENT_METHODS, validateOrderInput, calcTotals };
