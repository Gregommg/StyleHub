// Cash on delivery is the only payment method for now (M-Pesa STK push comes in a later update).
const selectedPayment = "cod";
let selectedDeliveryZone = "langata";

const DELIVERY_FEES = {
  langata: 50,
  "nairobi-pickup": 0,
  "outside-nairobi": 200,
};

function goCheckout() {
  if (!cart.length) { showToast("Your cart is empty", "error"); return; }
  if (!localStorage.getItem("sh_token")) {
    closeCart();
    showToast("Sign in or create an account to place an order", "error");
    toggleAuth();
    return;
  }
  closeCart();
  const nameField = document.getElementById("sh-name");
  const emailField = document.getElementById("sh-email");
  if (currentUser) {
    nameField.value = currentUser.name || "";
    emailField.value = currentUser.email || "";
  }
  renderCheckoutSummary();
  document.getElementById("checkout-page").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function closeCheckout() {
  document.getElementById("checkout-page").classList.add("hidden");
}

function renderCheckoutSummary() {
  const itemsEl = document.getElementById("checkout-items");
  const totalsEl = document.getElementById("checkout-totals");
  if (!itemsEl || !totalsEl) return;

  itemsEl.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <div class="checkout-item-thumb">
        ${item.image ? `<img src="${productImageUrl(item.image, 160)}" loading="lazy" decoding="async" alt="${item.name}" />` : `<img class="placeholder-img" src="${categoryImage(item.category)}" alt="${item.name}" />`}
      </div>
      <div class="checkout-item-name">${item.name} × ${item.qty}${item.size ? ` (${item.size})` : ""}</div>
      <div class="checkout-item-price">${formatKES(item.price * item.qty)}</div>
    </div>
  `).join("");

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = DELIVERY_FEES[selectedDeliveryZone];
  totalsEl.innerHTML = `
    <div class="row"><span>Subtotal</span><span>${formatKES(subtotal)}</span></div>
    <div class="row"><span>Delivery</span><span>${shipping === 0 ? "Free" : formatKES(shipping)}</span></div>
    <div class="row total"><span>Total</span><span>${formatKES(subtotal + shipping)}</span></div>
  `;
}

function selectDeliveryZone(zone) {
  selectedDeliveryZone = zone;
  document.getElementById("langata-fields").classList.toggle("hidden", zone !== "langata");
  document.getElementById("pickup-fields").classList.toggle("hidden", zone !== "nairobi-pickup");
  document.getElementById("outside-fields").classList.toggle("hidden", zone !== "outside-nairobi");
  document.getElementById("sh-delivery-location").required = zone === "langata";
  document.getElementById("sh-pickup").required = zone === "nairobi-pickup";
  document.getElementById("sh-county").required = zone === "outside-nairobi";
  document.getElementById("sh-town").required = zone === "outside-nairobi";
  document.getElementById("sh-outside-location").required = zone === "outside-nairobi";
  renderCheckoutSummary();
}

function useCurrentLocation() {
  const locationField = document.getElementById("sh-delivery-location");
  if (!navigator.geolocation) {
    showToast("Location is not available in this browser", "error");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      locationField.value = `https://maps.google.com/?q=${latitude},${longitude}`;
    },
    () => showToast("Could not get your location. Enter a landmark or map pin instead.", "error"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function normalizeKenyanPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return "";
}

async function placeOrder() {
  const msgEl = document.getElementById("checkout-msg");
  const submitButton = document.getElementById("place-order-btn");
  msgEl.textContent = "";

  const name = document.getElementById("sh-name").value.trim();
  const phoneInput = document.getElementById("sh-phone").value.trim();
  const email = document.getElementById("sh-email").value.trim();
  const phone = normalizeKenyanPhone(phoneInput);
  if (!name || !phone || !email) {
    msgEl.textContent = "Enter your name, a valid Kenyan phone number and email address.";
    return;
  }

  let shippingAddress;
  let pickupLocation = "";
  if (selectedDeliveryZone === "langata") {
    const deliveryLocation = document.getElementById("sh-delivery-location").value.trim();
    if (!deliveryLocation) { msgEl.textContent = "Enter your Langata delivery location or map pin."; return; }
    shippingAddress = { name, phone, email, street: deliveryLocation, city: "Langata, Nairobi", country: "Kenya" };
  } else if (selectedDeliveryZone === "nairobi-pickup") {
    pickupLocation = document.getElementById("sh-pickup").value;
    if (!pickupLocation) { msgEl.textContent = "Choose a Nairobi pickup location."; return; }
    shippingAddress = { name, phone, email, street: pickupLocation, city: "Nairobi", country: "Kenya" };
  } else {
    const county = document.getElementById("sh-county").value.trim();
    const town = document.getElementById("sh-town").value.trim();
    const deliveryLocation = document.getElementById("sh-outside-location").value.trim();
    if (!county || !town || !deliveryLocation) {
      msgEl.textContent = "Enter your county, town and a nearby landmark or courier point.";
      return;
    }
    shippingAddress = { name, phone, email, street: deliveryLocation, city: town, country: "Kenya", county, town };
  }

  const items = cart.map(item => ({
    productId: item.id,
    quantity: item.qty,
    size: item.size,
    color: item.color,
  }));

  submitButton.disabled = true;
  submitButton.textContent = "Placing order…";
  let order;
  try {
    const data = await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        items,
        shippingAddress,
        deliveryZone: selectedDeliveryZone,
        pickupLocation,
        paymentMethod: selectedPayment,
      }),
    });
    order = data.order;

    const confirmationMessage = "Your order is confirmed. Please pay cash when you receive or pick it up.";

    cart = [];
    saveCart();
    document.getElementById("checkout-page").classList.add("hidden");
    document.getElementById("confirmation-message").textContent = confirmationMessage;
    document.getElementById("confirmation-reference").textContent = `Order reference: ${order._id.slice(-8).toUpperCase()}`;
    document.getElementById("confirmation-page").classList.remove("hidden");
    window.scrollTo(0, 0);
  } catch (err) {
    msgEl.textContent = err.message || "Could not place your order. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Place order";
  }
}

function continueShopping() {
  document.getElementById("confirmation-page").classList.add("hidden");
  window.scrollTo(0, 0);
}

selectDeliveryZone(selectedDeliveryZone);
