// Product image storage.
//  - Cloudinary configured (CLOUDINARY_* env vars)  -> images go to Cloudinary and survive restarts/redeploys.
//  - Not configured                                  -> images are saved to backend/uploads (fine on your own PC,
//                                                       but lost on free hosts such as Render).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "../uploads/products");
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };

const cloudinaryConfig = () => ({
  cloud: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
  base: (process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com").replace(/\/$/, ""),
});

function isCloudinaryConfigured() {
  const c = cloudinaryConfig();
  return !!(c.cloud && c.key && c.secret);
}

// Cloudinary signature: sort params alphabetically, join as key=value with "&", append the API secret, SHA-1 (hex).
function signParams(params, secret) {
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(toSign + secret).digest("hex");
}

async function uploadToCloudinary(file) {
  const c = cloudinaryConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = "stylehub/products";
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "image");
  form.append("api_key", c.key);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signParams({ folder, timestamp }, c.secret));

  let res, data;
  try {
    res = await fetch(`${c.base}/v1_1/${encodeURIComponent(c.cloud)}/image/upload`, { method: "POST", body: form });
    data = await res.json();
  } catch (err) {
    throw new Error("Could not reach the image service. Please try again.");
  }
  if (!res.ok || !data.secure_url)
    throw new Error(`Image upload failed: ${data?.error?.message || res.status}`);
  return data.secure_url;
}

function saveLocally(file) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext = EXT[file.mimetype] || path.extname(file.originalname || "").toLowerCase() || ".img";
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(uploadDir, name), file.buffer);
  return `/uploads/products/${name}`;
}

// files: multer memory-storage files -> array of URLs/paths to store in the products table
async function saveImages(files = []) {
  if (isCloudinaryConfigured()) return Promise.all(files.map(uploadToCloudinary));
  return files.map(saveLocally);
}

module.exports = { saveImages, isCloudinaryConfigured, signParams, uploadDir };
