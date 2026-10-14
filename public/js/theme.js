// Appearance preferences only. Authentication stays in the server-side session.
// Admin and employee workspaces each remember their choice in this browser.
const defaults = { admin: "dark", employee: "light", trainer: "light" };
const preferences = new Map();
const prefix = "zero-incident.appearance.";
const valid = (value) => value === "light" || value === "dark";

export function getWorkspaceTheme(role) {
  if (preferences.has(role)) return preferences.get(role);
  try {
    const saved = localStorage.getItem(prefix + role);
    if (valid(saved)) {
      preferences.set(role, saved);
      return saved;
    }
  } catch {
    // Private/restricted browsers can still change theme for the current visit.
  }
  return defaults[role] || "light";
}

function setDocumentTheme(theme, role) {
  document.body.dataset.theme = theme;
  document.body.dataset.role = role;
  document.documentElement.style.colorScheme =
    theme === "dark" ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#111214" : "#f4f6f9");
}

export function applyWorkspaceTheme(role) {
  const theme = getWorkspaceTheme(role);
  setDocumentTheme(theme, role);
  return theme;
}

export function applyLoginTheme() {
  // Keep the established light sign-in design without overwriting preferences.
  setDocumentTheme("login", "guest");
}

export function toggleWorkspaceTheme(role) {
  const next = getWorkspaceTheme(role) === "dark" ? "light" : "dark";
  preferences.set(role, next);
  try {
    localStorage.setItem(prefix + role, next);
  } catch {
    // No authentication data is stored here; an in-memory preference is sufficient.
  }
  applyWorkspaceTheme(role);
  return next;
}

export function acceptThemeStorageEvent(event) {
  // Keep already-open tabs consistent when another tab changes the preference.
  if (event.key === null) {
    preferences.clear();
    return true;
  }
  if (!event.key?.startsWith(prefix)) return false;
  const role = event.key.slice(prefix.length);
  if (valid(event.newValue)) preferences.set(role, event.newValue);
  else preferences.delete(role);
  return true;
}
