const num = (v) => (v === null || v === undefined ? v : Number(v));

exports.toUser = (r) => ({
  _id: r.id, id: r.id, name: r.name, email: r.email, role: r.role,
  avatar: r.avatar, address: r.address, phone: r.phone || "", createdAt: r.created_at,
});

exports.toProduct = (r) => ({
  _id: r.id, name: r.name, description: r.description, price: num(r.price),
  category: r.category, images: r.images, stock: r.stock, sizes: r.sizes,
  colors: r.colors, tags: r.tags, featured: r.featured, active: r.active,
  soldCount: r.sold_count, createdAt: r.created_at, updatedAt: r.updated_at,
});

exports.toItem = (r) => ({
  product: r.product_id, name: r.name, price: num(r.price), quantity: r.quantity,
  size: r.size, color: r.color, image: r.image,
});

exports.toOrder = (r, items = []) => ({
  _id: r.id, user: r.user_name !== undefined ? { _id: r.user_id, name: r.user_name || "Deleted account", email: r.user_email || "" } : r.user_id,
  items, shippingAddress: r.shipping_address, deliveryZone: r.delivery_zone,
  pickupLocation: r.pickup_location, subtotal: num(r.subtotal), shippingFee: num(r.shipping_fee),
  total: num(r.total), status: r.status, paymentMethod: r.payment_method,
  paymentStatus: r.payment_status, trackingNumber: r.tracking_number,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
