// The API runs on port 5000 of the same machine that served this page, so the site works whether you
// open it as localhost, 127.0.0.1 or your PC's network address. Set window.STYLEHUB_API_BASE before
// this script to point at a deployed backend instead (e.g. "https://api.example.com/api").
const API_BASE =
  window.STYLEHUB_API_BASE ||
  `http://${window.location.protocol.startsWith("http") && window.location.hostname ? window.location.hostname : "localhost"}:5000/api`;

function formatKES(amount) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Category pictures (used on the category cards and as the picture for products that have no photo yet).
// To use your own photos, put them in images/categories/ and change the file names here.
const CATEGORY_IMAGES = {
  Tops:        "images/categories/tops.svg",
  Bottoms:     "images/categories/bottoms.svg",
  Dresses:     "images/categories/dresses.svg",
  Outerwear:   "images/categories/outerwear.svg",
  Accessories: "images/categories/accessories.svg",
};
function categoryImage(category) {
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Tops;
}
// <img> tag for a product: its uploaded photo, or the category picture when it has none.
function productPicture(p, extraClass = "") {
  const photo = p.images && p.images[0];
  const cls = photo ? extraClass : `${extraClass} placeholder-img`.trim();
  const src = photo ? productImageUrl(photo) : categoryImage(p.category);
  return `<img class="${cls}" src="${src}" alt="${String(p.name || p.category || "").replace(/"/g, "&quot;")}" />`;
}
function applyCategoryImages() {
  document.querySelectorAll("img[data-category-img]").forEach(img => {
    img.src = categoryImage(img.dataset.categoryImg);
  });
}

function productImageUrl(image) {
  if (!image || !image.startsWith("/")) return image || "";
  return API_BASE.replace(/\/api$/, "") + image;
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("sh_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ── Demo/offline product data (used when API is unavailable) ──
const DEMO_PRODUCTS = [
  { _id:"p1", name:"Classic Trench Coat",  category:"Outerwear",   price:6500, stock:24,
    images:["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80"],
    sizes:["XS","S","M","L","XL"], description:"A timeless trench coat crafted from premium cotton-blend fabric." },
  { _id:"p2", name:"Wrap Midi Dress",       category:"Dresses",     price:4800, stock:18,
    images:["https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80"],
    sizes:["XS","S","M","L"], description:"Elegant wrap silhouette in flowy satin-touch fabric." },
  { _id:"p3", name:"Slim Chinos",           category:"Bottoms",     price:3200, stock:32,
    images:["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80"],
    sizes:["28","30","32","34","36"], description:"Tailored slim-fit chinos in versatile stretch twill." },
  { _id:"p4", name:"Mini Tote Bag",         category:"Accessories", price:2800, stock:45,
    images:["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80"],
    sizes:[], description:"Compact tote with clean structural silhouette and gold-tone hardware." },
  { _id:"p5", name:"Striped Linen Shirt",   category:"Tops",        price:2400, stock:27,
    images:["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80"],
    sizes:["XS","S","M","L","XL"], description:"Relaxed fit linen shirt with classic block stripes." },
  { _id:"p6", name:"Oversized Hoodie",      category:"Tops",        price:3600, stock:15,
    images:["https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80"],
    sizes:["S","M","L","XL","XXL"], description:"Ultra-soft brushed fleece hoodie in a relaxed drop-shoulder fit." },
  { _id:"p7", name:"Pleated Midi Skirt",    category:"Bottoms",     price:4000, stock:12,
    images:["https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&q=80"],
    sizes:["XS","S","M","L"], description:"Fluid pleated skirt in a midi length." },
  { _id:"p8", name:"Gold Hoop Earrings",    category:"Accessories", price:1600, stock:60,
    images:["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80"],
    sizes:[], description:"Lightweight 18k gold-plated hoop earrings." },
  { _id:"p9", name:"Belted Blazer",         category:"Outerwear",   price:7200, stock:8,
    images:["https://images.unsplash.com/photo-1548454782-15b189d129ab?w=600&q=80"],
    sizes:["XS","S","M","L","XL"], description:"Structured blazer with a self-tie belt." },
];
applyCategoryImages();
