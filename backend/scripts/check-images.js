// Usage: npm run check-images   -> uploads a tiny test image using the CLOUDINARY_* values in .env
require("dotenv").config();
const { saveImages, isCloudinaryConfigured } = require("../lib/imageStore");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
(async () => {
  if (!isCloudinaryConfigured()) {
    console.log("Cloudinary is NOT configured. Fill CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env");
    process.exitCode = 1; return;
  }
  try {
    const [url] = await saveImages([{ buffer: PNG, mimetype: "image/png", originalname: "stylehub-test.png" }]);
    console.log("✅ Cloudinary works. Test image uploaded:\n   " + url);
  } catch (err) {
    console.error("❌ " + err.message); process.exitCode = 1;
  }
})();
