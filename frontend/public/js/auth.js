let currentUser = JSON.parse(localStorage.getItem("sh_user") || "null");

// Single place that changes page, so it is easy to adjust later.
function goTo(url) { window.location.href = url; }

// ── Account button / dropdown ───────────────────────
function toggleAuth() {
  if (currentUser) { toggleAccountMenu(); return; }
  showLogin();
  openAuthModal();
}

function openAuthModal() {
  closeAccountMenu();
  document.getElementById("auth-modal").classList.remove("hidden");
  document.getElementById("auth-overlay").classList.remove("hidden");
}

function closeAuth() {
  document.getElementById("auth-modal").classList.add("hidden");
  document.getElementById("auth-overlay").classList.add("hidden");
}

function toggleAccountMenu() {
  const menu = document.getElementById("account-menu");
  const open = menu.classList.toggle("hidden") === false;
  document.getElementById("auth-btn").setAttribute("aria-expanded", String(open));
}

function closeAccountMenu() {
  const menu = document.getElementById("account-menu");
  if (menu) menu.classList.add("hidden");
  const btn = document.getElementById("auth-btn");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".account-wrap")) closeAccountMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeAccountMenu(); closeAuth(); }
});

// Show the right look for signed-in / signed-out
function updateAuthUI() {
  const btn = document.getElementById("auth-btn");
  if (!btn) return;
  btn.classList.toggle("signed-in", !!currentUser);
  btn.title = currentUser ? `${currentUser.name} — account` : "Sign in";
  if (currentUser) {
    document.getElementById("account-menu-name").textContent = currentUser.name;
    document.getElementById("account-menu-email").textContent = currentUser.email;
    document.getElementById("menu-admin").classList.toggle("hidden", currentUser.role !== "admin");
  } else {
    closeAccountMenu();
  }
}

// ── Modal panels ───────────────────────────────────
function showAuthPanel(id) {
  ["auth-login", "auth-register", "auth-details", "auth-password", "auth-delete"].forEach(p =>
    document.getElementById(p).classList.toggle("hidden", p !== id));
  document.querySelectorAll("#auth-modal .auth-error").forEach(el => (el.textContent = ""));
}
function showLogin()    { showAuthPanel("auth-login"); }
function showRegister() { showAuthPanel("auth-register"); }

// ── Sign in / register ─────────────────────────────
async function login() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("login-error");
  errEl.textContent = "";
  if (!email || !password) { errEl.textContent = "Please fill in all fields."; return; }
  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body:   JSON.stringify({ email, password }),
    });
    setUser(data.token, data.user);
    closeAuth();
    // Role-based landing: admins go straight to the admin dashboard, customers stay in the store.
    if (data.user.role === "admin") { goTo("admin.html"); return; }
    showToast(`Welcome back, ${data.user.name}!`, "success");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function register() {
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("reg-error");
  errEl.textContent = "";
  if (!name || !email || !password) { errEl.textContent = "Please fill in all fields."; return; }
  try {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body:   JSON.stringify({ name, email, password }),
    });
    setUser(data.token, data.user);
    closeAuth();
    showToast(`Welcome, ${data.user.name}!`, "success");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function setUser(token, user) {
  if (token) localStorage.setItem("sh_token", token);
  localStorage.setItem("sh_user", JSON.stringify(user));
  currentUser = user;
  updateAuthUI();
}

function clearSession() {
  localStorage.removeItem("sh_token");
  localStorage.removeItem("sh_user");
  currentUser = null;
  updateAuthUI();
}

function signOut() {
  closeAccountMenu();
  clearSession();
  showToast("Signed out");
}
// kept for older code paths
function logout() { signOut(); }

// ── Update your details ────────────────────────────
function openDetails() {
  if (!currentUser) return;
  showAuthPanel("auth-details");
  document.getElementById("det-name").value  = currentUser.name  || "";
  document.getElementById("det-email").value = currentUser.email || "";
  document.getElementById("det-phone").value = currentUser.phone || "";
  openAuthModal();
}

async function saveDetails() {
  const errEl = document.getElementById("det-error");
  errEl.textContent = "";
  const name  = document.getElementById("det-name").value.trim();
  const email = document.getElementById("det-email").value.trim();
  const phone = document.getElementById("det-phone").value.trim();
  if (!name || !email) { errEl.textContent = "Name and email are required."; return; }
  try {
    const data = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name, email, phone }) });
    setUser(null, data.user);
    closeAuth();
    showToast("Details updated", "success");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

// ── Change password ────────────────────────────────
function openPassword() {
  if (!currentUser) return;
  showAuthPanel("auth-password");
  ["pw-current", "pw-new", "pw-confirm"].forEach(id => (document.getElementById(id).value = ""));
  openAuthModal();
}

async function savePassword() {
  const errEl = document.getElementById("pw-error");
  errEl.textContent = "";
  const currentPassword = document.getElementById("pw-current").value;
  const newPassword     = document.getElementById("pw-new").value;
  const confirm         = document.getElementById("pw-confirm").value;
  if (!currentPassword || !newPassword) { errEl.textContent = "Please fill in all fields."; return; }
  if (newPassword.length < 6) { errEl.textContent = "New password must be at least 6 characters."; return; }
  if (newPassword !== confirm) { errEl.textContent = "The new passwords don't match."; return; }
  try {
    const data = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (data.token) localStorage.setItem("sh_token", data.token);   // keep this device signed in
    closeAuth();
    showToast("Password updated", "success");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

// ── Delete account ─────────────────────────────────
function openDelete() {
  if (!currentUser) return;
  showAuthPanel("auth-delete");
  document.getElementById("del-password").value = "";
  openAuthModal();
}

async function confirmDelete() {
  const errEl = document.getElementById("del-error");
  errEl.textContent = "";
  const password = document.getElementById("del-password").value;
  if (!password) { errEl.textContent = "Enter your password to confirm."; return; }
  try {
    await apiFetch("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) });
    clearSession();
    closeAuth();
    showToast("Your account was deleted");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

// ── Keep the saved session honest ──────────────────
// If the account was deleted, the password was changed elsewhere, or the role changed, sync it.
async function refreshSession() {
  if (!localStorage.getItem("sh_token")) { if (currentUser) clearSession(); return; }
  try {
    const { user } = await apiFetch("/auth/me");
    setUser(null, { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone || "" });
  } catch (err) {
    // Only sign out when the server says the session is invalid, not when it's merely offline.
    if (/not authenticated|invalid token|user not found|password was changed/i.test(err.message)) clearSession();
  }
}

updateAuthUI();
refreshSession();
