let cart = JSON.parse(localStorage.getItem("sh_cart") || "[]");

function saveCart() {
  localStorage.setItem("sh_cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById("cart-count");
  if (el) { el.textContent = count || ""; el.style.display = count ? "flex" : "none"; }
}

function addToCart(product, size = "", color = "") {
  const key = product._id + size + color;
  const existing = cart.find(i => i.key === key);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      key,
      id:    product._id,
      name:  product.name,
      price: product.price,
      category: product.category || "",
      image: product.images?.[0] || "",
      size,
      color,
      qty: 1,
    });
  }
  saveCart();
  showToast(`${product.name} added to cart ✓`, "success");
  renderCartDrawer();
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  renderCartDrawer();
}

function changeQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(key);
  else { saveCart(); renderCartDrawer(); }
}

function getCartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

function openCart() {
  renderCartDrawer();
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-overlay").classList.remove("hidden");
}

function closeCart() {
  document.getElementById("cart-drawer").classList.remove("open");
  document.getElementById("cart-overlay").classList.add("hidden");
}

function renderCartDrawer() {
  const container = document.getElementById("cart-items");
  const footer    = document.getElementById("cart-footer");
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div><p>Your cart is empty</p></div>`;
    footer?.classList.add("hidden");
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-thumb">
        ${item.image ? `<img src="${productImageUrl(item.image)}" alt="${item.name}" />` : `<img class="placeholder-img" src="${categoryImage(item.category)}" alt="${item.name}" />`}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatKES(item.price)}</div>
        ${item.size  ? `<div class="cart-item-meta">Size: ${item.size}</div>` : ""}
        ${item.color ? `<div class="cart-item-meta">Color: ${item.color}</div>` : ""}
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${item.key}', -1)">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.key}')">✕</button>
    </div>
  `).join("");

  const { subtotal, total } = getCartTotals();
  document.getElementById("cart-subtotal").textContent = formatKES(subtotal);
  document.getElementById("cart-shipping").textContent = "Calculated at checkout";
  document.getElementById("cart-total").textContent    = formatKES(total);
  footer?.classList.remove("hidden");
}

// Initialize
updateCartCount();
