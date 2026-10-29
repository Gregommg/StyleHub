// ── State ─────────────────────────────────────────
let adminProducts = [];
let adminOrders   = [];
let adminCatFilter   = "All";
let adminOrderFilter = "all";
let adminCustomers   = [];
let newProductImages = [];
let editingProductId = null;

// Escape text before putting it into HTML (customer names, emails and addresses are typed by customers)
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// ── Demo data (fallback when API is offline) ──────
const DEMO_ORDERS = [
  { _id:"o1", createdAt: new Date().toISOString(), user:{name:"Amina Osei",email:"amina@example.com"}, items:[{name:"Classic Trench Coat",quantity:1}], total:6550, paymentMethod:"cod", paymentStatus:"unpaid", status:"delivered" },
  { _id:"o2", createdAt: new Date().toISOString(), user:{name:"Carlos Mwangi",email:"carlos@example.com"}, items:[{name:"Wrap Midi Dress",quantity:1}], total:5000, paymentMethod:"cod", paymentStatus:"paid", status:"shipped" },
  { _id:"o3", createdAt: new Date().toISOString(), user:{name:"Sara Njoroge",email:"sara@example.com"}, items:[{name:"Slim Chinos",quantity:2},{name:"Mini Tote Bag",quantity:1}], total:9200, paymentMethod:"cod", paymentStatus:"unpaid", status:"pending" },
  { _id:"o4", createdAt: new Date().toISOString(), user:{name:"James Kamau",email:"james@example.com"}, items:[{name:"Striped Linen Shirt",quantity:1}], total:2450, paymentMethod:"cod", paymentStatus:"paid", status:"delivered" },
  { _id:"o5", createdAt: new Date().toISOString(), user:{name:"Linh Tran",email:"linh@example.com"}, items:[{name:"Oversized Hoodie",quantity:2},{name:"Gold Hoop Earrings",quantity:1},{name:"Pleated Midi Skirt",quantity:1}], total:13750, paymentMethod:"cod", paymentStatus:"paid", status:"processing" },
];

// ── Init ──────────────────────────────────────────
// Admin-only page: confirm with the server that the signed-in user is an admin, otherwise go to the store.
function leaveAdmin() { window.location.replace("index.html"); }

async function requireAdmin() {
  if (!localStorage.getItem("sh_token")) return false;
  try {
    const { user } = await apiFetch("/auth/me");
    if (user.role !== "admin") return false;
    localStorage.setItem("sh_user", JSON.stringify({ id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone || "" }));
    document.getElementById("admin-name").textContent = user.name;
    document.getElementById("admin-avatar").textContent = (user.name || "A").trim().charAt(0).toUpperCase();
    return true;
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await requireAdmin())) { leaveAdmin(); return; }
  document.body.classList.remove("auth-pending");
  // Shorter search hint on phones so it isn't cut off
  const phoneQuery = window.matchMedia("(max-width: 600px)");
  const setSearchHint = () => { document.getElementById("admin-search").placeholder = phoneQuery.matches ? "Search anything…" : "Search products, orders, customers"; };
  setSearchHint(); phoneQuery.addEventListener("change", setSearchHint);
  // Sidebar navigation
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      navigate(link.dataset.page);
    });
  });
  loadDashboard();
});

function navigate(page) {
  document.querySelectorAll(".admin-page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  const linkEl = document.querySelector(`[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add("active");
  if (linkEl) linkEl.classList.add("active");

  const titles = { dashboard:"Dashboard", products:"Products", "add-product":"Add product", orders:"Orders", customers:"Customers" };
  document.getElementById("page-title").textContent = titles[page] || page;
  document.getElementById("nav-toggle-label").textContent = titles[page] || page;
  toggleAdminMenu(false);

  if (page === "add-product" && !editingProductId) resetProductForm();
  if (page === "products")   return loadAdminProducts();
  if (page === "orders")     return loadAdminOrders();
  if (page === "customers")  return loadAdminCustomers();
  if (page === "dashboard")  return loadDashboard();
  return Promise.resolve();
}

// ── Menu (drop-down on phones / small screens) ────
function toggleAdminMenu(force) {
  const nav = document.getElementById("sidebar-nav");
  const btn = document.getElementById("nav-toggle");
  const open = typeof force === "boolean" ? force : !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  btn.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
}
document.addEventListener("click", e => { if (!e.target.closest(".admin-sidebar")) toggleAdminMenu(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape") toggleAdminMenu(false); });

// ── Dashboard ─────────────────────────────────────
async function loadDashboard() {
  // Load products count
  try {
    const data = await apiFetch("/products?limit=100");
    adminProducts = data.products;
    document.getElementById("stat-products").textContent = data.total;
    renderTopProducts(adminProducts.sort((a,b) => b.soldCount - a.soldCount).slice(0,5));
  } catch {
    adminProducts = DEMO_PRODUCTS;
    document.getElementById("stat-products").textContent = DEMO_PRODUCTS.length;
    renderTopProducts(DEMO_PRODUCTS.slice(0,5));
  }

  // Load orders stats
  try {
    const data = await apiFetch("/orders/stats/summary");
    document.getElementById("stat-revenue").textContent = formatKES(data.revenue);
    document.getElementById("stat-orders").textContent  = data.ordersCount;
  } catch {
    document.getElementById("stat-revenue").textContent = "—";
    document.getElementById("stat-orders").textContent  = "—";
  }

  // Customer count
  try {
    const data = await apiFetch("/users?limit=1");
    document.getElementById("stat-customers").textContent = data.total;
  } catch {
    document.getElementById("stat-customers").textContent = "—";
  }

  // Load recent orders
  try {
    const data = await apiFetch("/orders?limit=5");
    adminOrders = data.orders;
  } catch {
    adminOrders = DEMO_ORDERS;
  }
  renderRecentOrders(adminOrders.slice(0,5));
}

function renderTopProducts(products) {
  const tbody = document.getElementById("top-products-body");
  if (!products.length) { tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No data</td></tr>`; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><span class="prod-cell"><img class="prod-thumb" src="${p.images && p.images[0] ? productImageUrl(p.images[0], 120) : categoryImage(p.category)}" alt="" />${esc(p.name)}</span></td>
      <td>${esc(p.category)}</td>
      <td>${p.soldCount || 0}</td>
      <td>${formatKES((p.soldCount || 0) * p.price)}</td>
    </tr>
  `).join("");
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById("recent-orders-body");
  if (!orders.length) { tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No orders yet</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><code style="font-size:12px">#${o._id.slice(-6).toUpperCase()}</code></td>
      <td>${esc(o.user?.name || "Guest")}</td>
      <td>${formatKES(o.total)}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
    </tr>
  `).join("");
}

// ── Products ──────────────────────────────────────
async function loadAdminProducts() {
  try {
    const data = await apiFetch("/products?limit=100");
    adminProducts = data.products;
  } catch {
    adminProducts = DEMO_PRODUCTS;
  }
  renderAdminProducts();
}

function renderAdminProducts() {
  const tbody = document.getElementById("products-table-body");
  let list = adminCatFilter === "All" ? adminProducts : adminProducts.filter(p => p.category === adminCatFilter);

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No products found</td></tr>`; return; }
  tbody.innerHTML = list.map(p => `
    <tr data-id="${p._id}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img class="prod-thumb" src="${p.images?.[0] ? productImageUrl(p.images[0], 120) : categoryImage(p.category)}" alt="" />
          <div>
            <div style="font-weight:500">${esc(p.name)}</div>
            <div style="font-size:11px;color:#7C7469">${esc(p.sizes?.join(", ") || "One size")}</div>
          </div>
        </div>
      </td>
      <td>${esc(p.category)}</td>
      <td>${formatKES(p.price)}</td>
      <td>
        <span style="color:${p.stock < 5 ? "#C0392B" : "#2E7D52"}">${p.stock}</span>
        ${p.stock < 5 ? '<span style="font-size:11px;color:#C0392B;margin-left:4px">Low</span>' : ""}
      </td>
      <td><span class="status-badge ${p.active!==false ? "status-active" : "status-inactive"}">${p.active!==false ? "Active" : "Inactive"}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="tbl-btn" onclick="editProduct('${p._id}')">Edit</button>
          <button class="tbl-btn danger" onclick="deleteProduct('${p._id}')">Remove</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function filterAdminCat(cat, btn) {
  adminCatFilter = cat;
  document.querySelectorAll("#cat-filter-tabs .tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAdminProducts();
}

function editProduct(id) {
  const p = adminProducts.find(x => x._id === id);
  if (!p) return;
  editingProductId = id;
  newProductImages = [];
  navigate("add-product");
  document.getElementById("new-name").value  = p.name;
  document.getElementById("new-cat").value   = p.category;
  document.getElementById("new-price").value = p.price;
  document.getElementById("new-stock").value = p.stock;
  document.getElementById("new-desc").value  = p.description || "";
  document.getElementById("new-sizes").value = p.sizes?.join(", ") || "";
  document.getElementById("new-tags").value  = p.tags?.join(", ") || "";
  document.getElementById("new-featured").checked = Boolean(p.featured);
  document.getElementById("product-form-title").textContent = "Edit product";
  document.getElementById("submit-product-btn").textContent = "Save changes";
  document.getElementById("image-previews").innerHTML = (p.images || []).map(image =>
    `<img class="preview-thumb" src="${productImageUrl(image, 300)}" alt="Current product image" />`
  ).join("");
}

async function deleteProduct(id) {
  const name = adminProducts.find(p => p._id === id)?.name || "this product";
  if (!confirm(`Remove "${name}" from the store?`)) return;
  try {
    await apiFetch(`/products/${id}`, { method: "DELETE" });
  } catch (err) {
    adminToast(err.message || "Could not remove product", "error");
    return;
  }
  adminProducts = adminProducts.filter(p => p._id !== id);
  renderAdminProducts();
  adminToast(`"${name}" removed`);
}

// ── Add Product ───────────────────────────────────
function handleImagePreview(input) {
  newProductImages = Array.from(input.files);
  const product = adminProducts.find(item => item._id === editingProductId);
  if (newProductImages.some(file => file.size > 5 * 1024 * 1024)) {
    newProductImages = [];
    input.value = "";
    adminToast("Each image must be 5MB or smaller", "error");
    return;
  }
  if (newProductImages.length + (product?.images?.length || 0) > 5) {
    newProductImages = [];
    input.value = "";
    adminToast("A product can have up to 5 images", "error");
    return;
  }
  const container = document.getElementById("image-previews");
  const existingImages = product?.images || [];
  container.innerHTML = [...existingImages.map(image =>
    `<img class="preview-thumb" src="${productImageUrl(image, 300)}" alt="Current product image" />`
  ), ...newProductImages.map(f =>
    `<img class="preview-thumb" src="${URL.createObjectURL(f)}" alt="preview" />`
  )].join("");
}

async function submitProduct() {
  const name = document.getElementById("new-name").value.trim();
  const category = document.getElementById("new-cat").value;
  const price = Number(document.getElementById("new-price").value);
  const stock = Number(document.getElementById("new-stock").value);
  const description = document.getElementById("new-desc").value.trim();
  const sizes = document.getElementById("new-sizes").value.split(",").map(value => value.trim()).filter(Boolean);
  const tags = document.getElementById("new-tags").value.split(",").map(value => value.trim()).filter(Boolean);
  const featured = document.getElementById("new-featured").checked;
  const message = document.getElementById("add-product-msg");
  const existingProduct = adminProducts.find(product => product._id === editingProductId);
  message.className = "form-msg";
  message.textContent = "";

  if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
    message.className = "form-msg error";
    message.textContent = "Enter a product name, a price greater than zero and valid stock.";
    return;
  }
  if (!editingProductId && newProductImages.length === 0) {
    message.className = "form-msg error";
    message.textContent = "Add at least one product image before publishing.";
    return;
  }
  if (newProductImages.length + (existingProduct?.images?.length || 0) > 5) {
    message.className = "form-msg error";
    message.textContent = "A product can have up to 5 images.";
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("category", category);
  formData.append("price", price);
  formData.append("stock", stock);
  formData.append("description", description);
  formData.append("featured", featured);
  sizes.forEach(size => formData.append("sizes", size));
  tags.forEach(tag => formData.append("tags", tag));
  newProductImages.forEach(image => formData.append("images", image));

  try {
    const token = localStorage.getItem("sh_token");
    const response = await fetch(`${API_BASE}/products${editingProductId ? `/${editingProductId}` : ""}`, {
      method: editingProductId ? "PUT" : "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not save product");

    message.textContent = editingProductId ? "Product updated." : "Product published.";
    adminToast(editingProductId ? "Product updated successfully" : "Product published successfully", "success");
    resetProductForm();
    setTimeout(() => navigate("products"), 800);
  } catch (err) {
    message.className = "form-msg error";
    message.textContent = err.message || "Could not save product. Check your connection and try again.";
  }
}

function resetProductForm() {
  editingProductId = null;
  newProductImages = [];
  document.getElementById("new-name").value = "";
  document.getElementById("new-cat").selectedIndex = 0;
  document.getElementById("new-price").value = "";
  document.getElementById("new-stock").value = "";
  document.getElementById("new-desc").value = "";
  document.getElementById("new-sizes").value = "";
  document.getElementById("new-tags").value = "";
  document.getElementById("new-featured").checked = false;
  document.getElementById("image-input").value = "";
  document.getElementById("image-previews").innerHTML = "";
  document.getElementById("product-form-title").textContent = "Product details";
  document.getElementById("submit-product-btn").textContent = "Add product";
  document.getElementById("add-product-msg").textContent = "";
}

// ── Orders ────────────────────────────────────────
async function loadAdminOrders() {
  try {
    const data = await apiFetch("/orders?limit=50");
    adminOrders = data.orders;
  } catch {
    adminOrders = DEMO_ORDERS;
  }
  renderAdminOrders();
}

function renderAdminOrders() {
  const tbody = document.getElementById("orders-table-body");
  let list = adminOrderFilter === "all" ? adminOrders : adminOrders.filter(o => o.status === adminOrderFilter);

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No orders found</td></tr>`; return; }
  tbody.innerHTML = list.map(o => `
    <tr data-id="${o._id}">
      <td><code style="font-size:12px">#${o._id.slice(-6).toUpperCase()}</code></td>
      <td>
        <div>${esc(o.user?.name || "Guest")}</div>
        <div style="font-size:11px;color:#7C7469">${esc(o.user?.email || "")}</div>
      </td>
      <td>${o.items?.length || 1} item${o.items?.length !== 1 ? "s" : ""}</td>
      <td>${formatKES(o.total)}</td>
      <td><span class="status-badge ${o.paymentStatus==="paid" ? "status-paid" : "status-unpaid"}">${o.paymentStatus || "unpaid"}</span></td>
      <td>
        <select class="tbl-status-select" onchange="updateOrderStatus('${o._id}', this.value)" style="font-size:12px;padding:3px 8px;border:1px solid #E5E0D8;border-radius:4px;background:none;cursor:pointer">
          ${["pending","processing","shipped","delivered","cancelled"].map(s =>
            `<option value="${s}" ${o.status===s?"selected":""}>${s}</option>`
          ).join("")}
        </select>
      </td>
      <td>
        <button class="tbl-btn" onclick="viewOrderDetail('${o._id}')">View</button>
      </td>
    </tr>
  `).join("");
}

function filterOrders(status, btn) {
  adminOrderFilter = status;
  document.querySelectorAll("#page-orders .tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAdminOrders();
}

async function updateOrderStatus(id, status) {
  const order = adminOrders.find(item => item._id === id);
  try {
    await apiFetch(`/orders/${id}`, { method:"PATCH", body: JSON.stringify({ status }) });
  } catch (err) {
    adminToast(err.message || "Could not update order status", "error");
    renderAdminOrders();
    return;
  }
  if (order) order.status = status;
  adminToast(`Order status updated to ${status}`);
}

function viewOrderDetail(id) {
  const o = adminOrders.find(x => x._id === id);
  if (!o) return;
  document.getElementById("order-modal-content").innerHTML = `
    <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;margin-bottom:20px">
      Order #${o._id.slice(-6).toUpperCase()}
    </h3>
    <div class="order-detail-row"><span class="order-detail-label">Customer</span><span>${esc(o.user?.name || "Guest")}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Email</span><span>${esc(o.user?.email || "—")}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Date</span><span>${new Date(o.createdAt).toLocaleDateString()}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Status</span><span class="status-badge status-${o.status}">${o.status}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Payment</span><span>${esc(o.paymentMethod)} — <span class="status-badge ${o.paymentStatus==="paid"?"status-paid":"status-unpaid"}">${o.paymentStatus}</span></span></div>
    <div style="margin:16px 0;font-weight:500;font-size:13px">Items</div>
    ${(o.items||[]).map(item=>`
      <div class="order-detail-row">
        <span>${esc(item.name)}${item.size?" ("+esc(item.size)+")":""} × ${item.quantity}</span>
        <span>${formatKES(item.price * item.quantity)}</span>
      </div>
    `).join("")}
    <div class="order-detail-row"><span class="order-detail-label">Delivery fee</span><span>${formatKES(o.shippingFee || 0)}</span></div>
    <div class="order-detail-row" style="font-weight:500"><span class="order-detail-label">Total</span><span>${formatKES(o.total)}</span></div>
    ${o.shippingAddress ? `
      <div style="margin-top:12px;font-size:12px;color:#7C7469">
        <strong>${o.deliveryZone === "nairobi-pickup" ? "Pickup point" : "Delivery location"}:</strong>
        ${[o.pickupLocation || o.shippingAddress.street, o.shippingAddress.city, o.shippingAddress.country].filter(Boolean).map(esc).join(", ")}
        ${o.shippingAddress.county ? `<br />${esc(o.shippingAddress.county)} County · ${esc(o.shippingAddress.town)}` : ""}
        <br /><strong>Phone:</strong> ${esc(o.shippingAddress.phone || "—")} · ${esc(o.shippingAddress.email || "")}
      </div>
    ` : ""}
  `;
  document.getElementById("order-modal").classList.remove("hidden");
  document.getElementById("order-modal-overlay").classList.remove("hidden");
}

function closeOrderModal() {
  document.getElementById("order-modal").classList.add("hidden");
  document.getElementById("order-modal-overlay").classList.add("hidden");
}

// ── Customers ─────────────────────────────────────
async function loadAdminCustomers() {
  const tbody = document.getElementById("customers-table-body");
  try {
    const data = await apiFetch("/users?limit=200");
    adminCustomers = data.customers;
    document.getElementById("stat-customers").textContent = data.total;
  } catch (err) {
    adminCustomers = [];
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Could not load customers. ${esc(err.message || "")}</td></tr>`;
    return;
  }
  renderCustomers();
}

function renderCustomers() {
  const tbody = document.getElementById("customers-table-body");
  if (!adminCustomers.length) { tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No customers yet</td></tr>`; return; }
  tbody.innerHTML = adminCustomers.map(c => `
    <tr data-id="${c._id}">
      <td>
        <div style="font-weight:500">${esc(c.name)}</div>
        <div style="font-size:11px;color:#7C7469">${esc(c.email)}</div>
      </td>
      <td>${esc(c.phone) || "—"}</td>
      <td>${c.ordersCount}</td>
      <td>${formatKES(c.totalSpent)}</td>
      <td>${new Date(c.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join("");
}

// ── Search (products, orders, customers) ──────────
let searchTimer = null;
let searchSeq   = 0;
let searchHits  = [];
let searchActive = -1;

function hideSearchResults() {
  document.getElementById("admin-search-results").classList.add("hidden");
  searchActive = -1;
}

function handleAdminSearch(val) {
  const q = val.trim();
  clearTimeout(searchTimer);
  searchSeq++;                                   // ignore any search that is still loading
  if (q.length < 2) { hideSearchResults(); return; }
  searchTimer = setTimeout(() => runAdminSearch(q), 250);
}

async function runAdminSearch(q) {
  const seq = searchSeq;
  const box = document.getElementById("admin-search-results");
  box.classList.remove("hidden");
  box.innerHTML = `<div class="sr-empty">Searching…</div>`;
  const enc = encodeURIComponent(q);
  const [p, o, c] = await Promise.allSettled([
    apiFetch(`/products?search=${enc}&limit=5`),
    apiFetch(`/orders?q=${enc}&limit=5`),
    apiFetch(`/users?q=${enc}&limit=5`),
  ]);
  if (seq !== searchSeq) return;                 // a newer search started
  renderSearchResults({
    products:  p.status === "fulfilled" ? p.value.products  : [],
    orders:    o.status === "fulfilled" ? o.value.orders    : [],
    customers: c.status === "fulfilled" ? c.value.customers : [],
  }, q);
}

function renderSearchResults(r, q) {
  const box = document.getElementById("admin-search-results");
  searchHits = [
    ...r.products.map(obj => ({ type: "product", id: obj._id, obj })),
    ...r.orders.map(obj => ({ type: "order", id: obj._id, obj })),
    ...r.customers.map(obj => ({ type: "customer", id: obj._id, obj })),
  ];
  searchActive = -1;
  if (!searchHits.length) { box.innerHTML = `<div class="sr-empty">No results for “${esc(q)}”</div>`; return; }

  let html = "", i = 0;
  const group = (label, items, row) => {
    if (!items.length) return;
    html += `<div class="sr-group">${label}</div>`;
    items.forEach(obj => { html += `<button type="button" class="sr-item" role="option" data-hit="${i}" onclick="openSearchHit(${i})">${row(obj)}</button>`; i++; });
  };
  group("Products", r.products, p => `
    <img class="sr-thumb" src="${p.images && p.images[0] ? productImageUrl(p.images[0], 80) : categoryImage(p.category)}" alt="" />
    <span class="sr-text"><b>${esc(p.name)}</b><small>${esc(p.category)} · ${formatKES(p.price)} · ${p.stock} in stock</small></span>`);
  group("Orders", r.orders, o => `
    <span class="sr-icon">#</span>
    <span class="sr-text"><b>#${o._id.slice(-6).toUpperCase()} · ${esc(o.user?.name || "Guest")}</b><small>${formatKES(o.total)} · ${esc(o.status)}</small></span>`);
  group("Customers", r.customers, c => `
    <span class="sr-icon">${esc((c.name || "?").trim().charAt(0).toUpperCase())}</span>
    <span class="sr-text"><b>${esc(c.name)}</b><small>${esc(c.email)}</small></span>`);
  box.innerHTML = html;
}

function highlightRow(tbodyId, id) {
  const tr = document.querySelector(`#${tbodyId} tr[data-id="${id}"]`);
  if (!tr) return;
  tr.scrollIntoView({ block: "center", behavior: "smooth" });
  tr.classList.add("row-flash");
  setTimeout(() => tr.classList.remove("row-flash"), 2600);
}

// Take the admin to the chosen item
async function openSearchHit(index) {
  const hit = searchHits[index];
  if (!hit) return;
  hideSearchResults();
  const input = document.getElementById("admin-search");
  input.value = ""; input.blur();
  searchSeq++;

  if (hit.type === "product") {
    await navigate("products");
    highlightRow("products-table-body", hit.id);
  } else if (hit.type === "order") {
    await navigate("orders");
    if (!adminOrders.some(o => o._id === hit.id)) adminOrders.unshift(hit.obj);
    highlightRow("orders-table-body", hit.id);
    viewOrderDetail(hit.id);
  } else {
    await navigate("customers");
    highlightRow("customers-table-body", hit.id);
  }
}

function adminSearchKey(e) {
  const items = [...document.querySelectorAll("#admin-search-results .sr-item")];
  if (e.key === "Escape") { hideSearchResults(); e.target.blur(); return; }
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    searchActive = (searchActive + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle("active", n === searchActive));
    items[searchActive].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    openSearchHit(searchActive >= 0 ? searchActive : 0);
  }
}
document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) hideSearchResults(); });

// ── Toast ─────────────────────────────────────────
function adminToast(msg, type = "") {
  const el = document.getElementById("admin-toast");
  el.textContent = msg;
  el.className = `admin-toast ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

function adminLogout() {
  localStorage.removeItem("sh_token");
  localStorage.removeItem("sh_user");
  window.location.href = "index.html";
}
