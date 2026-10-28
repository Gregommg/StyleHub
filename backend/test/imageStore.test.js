const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { saveImages, signParams } = require("../lib/imageStore");

// Official example from Cloudinary's "manual signature generation" docs
test("signature matches Cloudinary's documented example", () => {
  const sig = signParams({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" }, "abcd");
  assert.strictEqual(sig, "bfd09f95f331f558cbd1320e67aa8d488770583e");
});

test("without Cloudinary settings, images are saved locally", async () => {
  for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) delete process.env[k];
  const [p] = await saveImages([{ buffer: Buffer.from("x"), mimetype: "image/png", originalname: "a.png" }]);
  assert.match(p, /^\/uploads\/products\/\d+-[0-9a-f]+\.png$/);
  fs.rmSync(path.join(__dirname, "../uploads"), { recursive: true, force: true });
});

test("with Cloudinary settings, images are uploaded with a valid signed request", async () => {
  let seen;
  const server = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const field = (n) => (body.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
      seen = { url: req.url, key: field("api_key"), ts: field("timestamp"), folder: field("folder"), sig: field("signature"), hasFile: /name="file"/.test(body) };
      res.setHeader("Content-Type", "application/json");
      const good = seen.sig === signParams({ folder: seen.folder, timestamp: seen.ts }, "SECRET");
      res.statusCode = good ? 200 : 401;
      res.end(JSON.stringify(good ? { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/stylehub/products/x.png" } : { error: { message: "Invalid Signature" } }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "KEY", CLOUDINARY_API_SECRET: "SECRET", CLOUDINARY_API_BASE: `http://127.0.0.1:${server.address().port}` });
  const [url] = await saveImages([{ buffer: Buffer.from("png"), mimetype: "image/png", originalname: "a.png" }]);
  assert.strictEqual(url, "https://res.cloudinary.com/demo/image/upload/v1/stylehub/products/x.png");
  assert.strictEqual(seen.url, "/v1_1/demo/image/upload");
  assert.ok(seen.hasFile && seen.key === "KEY" && seen.folder === "stylehub/products");
  // wrong secret -> clear error
  process.env.CLOUDINARY_API_SECRET = "WRONG";
  await assert.rejects(saveImages([{ buffer: Buffer.from("png"), mimetype: "image/png", originalname: "a.png" }]), /Invalid Signature/);
  server.close();
  for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_API_BASE"]) delete process.env[k];
});
