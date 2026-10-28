// ── State ─────────────────────────────────────────
let adminProducts = [];
let adminOrders   = [];
let adminCatFilter   = "All";
let adminOrderFilter = "all";
let adminSearchVal   = "";
let newProductImages = [];
let editingProductId = null;

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

  if (page === "add-product" && !editingProductId) resetProductForm();
  if (page === "products")   loadAdminProducts();
  if (page === "orders")     loadAdminOrders();
  if (page === "dashboard")  loadDashboard();
}

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
      <td><span class="prod-cell"><img class="prod-thumb" src="${p.images && p.images[0] ? productImageUrl(p.images[0]) : categoryImage(p.category)}" alt="" />${p.name}</span></td>
      <td>${p.category}</td>
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
      <td>${o.user?.name || "Guest"}</td>
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
  if (adminSearchVal) list = list.filter(p => p.name.toLowerCase().includes(adminSearchVal));

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No products found</td></tr>`; return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img class="prod-thumb" src="${p.images?.[0] ? productImageUrl(p.images[0]) : categoryImage(p.category)}" alt="" />
          <div>
            <div style="font-weight:500">${p.name}</div>
            <div style="font-size:11px;color:#7C7469">${p.sizes?.join(", ") || "One size"}</div>
          </div>
        </div>
      </td>
      <td>${p.category}</td>
      <td>${formatKES(p.price)}</td>
      <td>
        <span style="color:${p.stock < 5 ? "#C0392B" : "#2E7D52"}">${p.stock}</span>
        ${p.stock < 5 ? '<span style="font-size:11px;color:#C0392B;margin-left:4px">Low</span>' : ""}
      </td>
      <td><span class="status-badge ${p.active!==false ? "status-active" : "status-inactive"}">${p.active!==false ? "Active" : "Inactive"}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="tbl-btn" onclick="editProduct('${p._id}')">Edit</button>
          <button class="tbl-btn danger" onclick="deleteProduct('${p._id}','${p.name}')">Remove</button>
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
    `<img class="preview-thumb" src="${productImageUrl(image)}" alt="Current product image" />`
  ).join("");
}

async function deleteProduct(id, name) {
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
    `<img class="preview-thumb" src="${productImageUrl(image)}" alt="Current product image" />`
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
  if (adminSearchVal) list = list.filter(o =>
    o._id.includes(adminSearchVal) || o.user?.name?.toLowerCase().includes(adminSearchVal)
  );

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No orders found</td></tr>`; return; }
  tbody.innerHTML = list.map(o => `
    <tr>
      <td><code style="font-size:12px">#${o._id.slice(-6).toUpperCase()}</code></td>
      <td>
        <div>${o.user?.name || "Guest"}</div>
        <div style="font-size:11px;color:#7C7469">${o.user?.email || ""}</div>
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
    <div class="order-detail-row"><span class="order-detail-label">Customer</span><span>${o.user?.name || "Guest"}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Email</span><span>${o.user?.email || "—"}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Date</span><span>${new Date(o.createdAt).toLocaleDateString()}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Status</span><span class="status-badge status-${o.status}">${o.status}</span></div>
    <div class="order-detail-row"><span class="order-detail-label">Payment</span><span>${o.paymentMethod} — <span class="status-badge ${o.paymentStatus==="paid"?"status-paid":"status-unpaid"}">${o.paymentStatus}</span></span></div>
    <div style="margin:16px 0;font-weight:500;font-size:13px">Items</div>
    ${(o.items||[]).map(item=>`
      <div class="order-detail-row">
        <span>${item.name}${item.size?" ("+item.size+")":""} × ${item.quantity}</span>
        <span>${formatKES(item.price * item.quantity)}</span>
      </div>
    `).join("")}
    <div class="order-detail-row"><span class="order-detail-label">Delivery fee</span><span>${formatKES(o.shippingFee || 0)}</span></div>
    <div class="order-detail-row" style="font-weight:500"><span class="order-detail-label">Total</span><span>${formatKES(o.total)}</span></div>
    ${o.shippingAddress ? `
      <div style="margin-top:12px;font-size:12px;color:#7C7469">
        <strong>${o.deliveryZone === "nairobi-pickup" ? "Pickup point" : "Delivery location"}:</strong>
        ${o.pickupLocation || o.shippingAddress.street}, ${o.shippingAddress.city}, ${o.shippingAddress.country}
        ${o.shippingAddress.county ? `<br />${o.shippingAddress.county} County · ${o.shippingAddress.town}` : ""}
        <br /><strong>Phone:</strong> ${o.shippingAddress.phone || "—"} · ${o.shippingAddress.email || ""}
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

// ── Search ────────────────────────────────────────
function handleAdminSearch(val) {
  adminSearchVal = val.toLowerCase();
  const activePage = document.querySelector(".admin-page.active")?.id;
  if (activePage === "page-products") renderAdminProducts();
  if (activePage === "page-orders")   renderAdminOrders();
}

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
