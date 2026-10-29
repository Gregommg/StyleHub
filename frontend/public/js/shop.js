let allProducts  = [];
let activeCategory = "All";
let activeSortKey  = "newest";
let searchQuery    = "";
let selectedProductImages = [];
let selectedProductImage = 0;
let wishlist = JSON.parse(localStorage.getItem("sh_wishlist") || "[]");

async function loadProducts() {
  try {
    const data = await apiFetch("/products?limit=50");
    allProducts = data.products;
  } catch {
    // Fallback to demo data when API is offline
    allProducts = DEMO_PRODUCTS;
  }
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  let list = [...allProducts];

  // Filter by category
  if (activeCategory !== "All")
    list = list.filter(p => p.category === activeCategory);

  // Filter by search
  if (searchQuery)
    list = list.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery)
    );

  // Sort
  if (activeSortKey === "price-asc")  list.sort((a, b) => a.price - b.price);
  if (activeSortKey === "price-desc") list.sort((a, b) => b.price - a.price);

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:#7C7469">No products found</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="product-card" onclick="openProduct('${p._id}')">
      <div class="product-img">
        ${productPicture(p)}
      </div>
      <div class="product-body">
        <div class="product-cat">${p.category}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">${formatKES(p.price)}</div>
        <div class="product-actions">
          <button class="add-to-cart" ${p.stock < 1 ? "disabled" : ""} onclick="event.stopPropagation(); quickAddToCart('${p._id}')">
            ${p.stock < 1 ? "Sold out" : "Add to cart"}
          </button>
          <button class="wishlist-btn ${wishlist.includes(p._id) ? "saved" : ""}" title="Save to wishlist" aria-label="Save ${p.name}" onclick="event.stopPropagation(); toggleWishlist('${p._id}')">
            ${wishlist.includes(p._id) ? "♥" : "♡"}
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function quickAddToCart(id) {
  const p = allProducts.find(x => x._id === id);
  if (p) addToCart(p, p.sizes?.[0] || "");
}

function filterByCategory(cat, el) {
  activeCategory = cat;
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  const selectedPill = el || [...document.querySelectorAll(".filter-pill")]
    .find(pill => pill.textContent.trim() === cat);
  if (selectedPill) selectedPill.classList.add("active");
  renderProducts();
}

function sortProducts(val) {
  activeSortKey = val;
  renderProducts();
}

function handleSearch(val) {
  searchQuery = val.toLowerCase();
  renderProducts();
}

function toggleSearch() {
  const bar = document.getElementById("search-bar");
  bar.classList.toggle("hidden");
  if (!bar.classList.contains("hidden")) document.getElementById("search-input").focus();
}

function scrollToShop() {
  document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
}

// Product detail modal
function openProduct(id) {
  const p = allProducts.find(x => x._id === id);
  if (!p) return;

  let selectedSize = p.sizes?.[0] || "";
  selectedProductImages = p.images || [];
  selectedProductImage = 0;

  document.getElementById("product-modal-content").innerHTML = `
    <div class="pm-grid">
      <div class="pm-image-wrap">
        <div class="pm-image" id="pm-image">
        ${selectedProductImages[0]
          ? `<img src="${productImageUrl(selectedProductImages[0], 900)}" alt="${p.name}" />`
          : productPicture(p)}
        </div>
        ${selectedProductImages.length > 1 ? `
          <button class="gallery-arrow gallery-prev" aria-label="Previous image" onclick="changeProductImage(-1)">‹</button>
          <button class="gallery-arrow gallery-next" aria-label="Next image" onclick="changeProductImage(1)">›</button>
          <div class="gallery-dots">${selectedProductImages.map((_, i) =>
            `<button class="gallery-dot ${i === 0 ? "active" : ""}" aria-label="Show image ${i + 1}" onclick="showProductImage(${i})"></button>`
          ).join("")}</div>
        ` : ""}
      </div>
      <div class="pm-info">
        <div class="pm-cat">${p.category}</div>
        <div class="pm-name">${p.name}</div>
        <div class="pm-price">${formatKES(p.price)}</div>
        <div class="pm-desc">${p.description || "A stylish piece for your wardrobe."}</div>
        ${p.sizes?.length ? `
          <div class="pm-label">Size</div>
          <div class="size-grid" id="size-grid">
            ${p.sizes.map(s => `
              <button class="size-btn ${s === selectedSize ? "selected" : ""}"
                onclick="selectSize('${s}', this)">${s}</button>
            `).join("")}
          </div>
        ` : ""}
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn-primary" style="flex:1" ${p.stock < 1 ? "disabled" : ""}
            onclick="addToCart(allProducts.find(x=>x._id==='${p._id}'),
              document.querySelector('.size-btn.selected')?.textContent||'')">
            ${p.stock < 1 ? "Sold out" : "Add to cart"}
          </button>
        </div>
        <div style="margin-top:16px;font-size:13px;color:#7C7469">
          ${p.stock > 0 ? `✓ ${p.stock} in stock` : "⚠ Out of stock"}
        </div>
      </div>
    </div>
  `;

  document.getElementById("product-modal").classList.remove("hidden");
  document.getElementById("product-overlay").classList.remove("hidden");
}

function showProductImage(index) {
  if (!selectedProductImages[index]) return;
  selectedProductImage = index;
  document.getElementById("pm-image").innerHTML =
    `<img src="${productImageUrl(selectedProductImages[index], 900)}" alt="Product image ${index + 1}" />`;
  document.querySelectorAll(".gallery-dot").forEach((dot, i) =>
    dot.classList.toggle("active", i === index)
  );
}

function changeProductImage(direction) {
  if (!selectedProductImages.length) return;
  const next = (selectedProductImage + direction + selectedProductImages.length) % selectedProductImages.length;
  showProductImage(next);
}

function toggleWishlist(id) {
  wishlist = wishlist.includes(id) ? wishlist.filter(item => item !== id) : [...wishlist, id];
  localStorage.setItem("sh_wishlist", JSON.stringify(wishlist));
  renderProducts();
}

function selectSize(size, btn) {
  document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  document.getElementById("product-overlay").classList.add("hidden");
}

// Toast helper
function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// Init
loadProducts();
