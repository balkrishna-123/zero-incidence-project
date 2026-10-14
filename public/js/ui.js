import { icon } from "./icons.js";
export const esc = (value = "") =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const initials = (user) =>
  `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
export const fullName = (user) =>
  `${user.firstName || ""} ${user.lastName || ""}`.trim();
export const avatar = (user, size = "", index = 0) =>
  `<span class="avatar ${size} avatar-${Math.abs((user.firstName || "").charCodeAt(0) || index) % 5}">${esc(initials(user))}</span>`;
export const statusBadge = (status) =>
  `<span class="badge ${status === "active" ? "green" : "gray"}"><i></i>${status === "active" ? "Active" : "Inactive"}</span>`;
export const progressBadge = (status) => {
  const labels = {
    complete: ["green", "Training complete"],
    "in-progress": ["blue", "In progress"],
    retake: ["amber", "Retake needed"],
    "not-started": ["gray", "Not started"],
  };
  const [tone, label] = labels[status] || labels["not-started"];
  return `<span class="badge ${tone}">${esc(label)}</span>`;
};
export const formatDate = (date, opts = {}) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...opts,
      })
    : "Not yet";
export function timeAgo(date) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
export function notify(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.setAttribute("role", type === "error" ? "alert" : "status");
  item.innerHTML = `${icon(type === "error" ? "alert" : "checkCircle", 19)}<span>${esc(message)}</span><button class="icon-button" aria-label="Dismiss notification">${icon("close", 16)}</button>`;
  item.querySelector("button").onclick = () => item.remove();
  document.querySelector("#toast-root").append(item);
  setTimeout(() => item.remove(), 6500);
}
let closeCurrent;
export function closeModal() {
  closeCurrent?.();
}
export function modal({
  title,
  subtitle = "",
  content,
  footer = "",
  className = "",
  onMount,
  onClose,
}) {
  closeModal();
  const previous = document.activeElement;
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="modal-header"><div><h2 id="dialog-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div><button class="icon-button" data-close-modal aria-label="Close dialog">${icon("close")}</button></header><div class="modal-body">${content}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}</section></div>`;
  document.body.classList.add("modal-open");
  const element = root.querySelector(".modal");
  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const focusable = [
      ...element.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
      ),
    ].filter((e) => e.offsetParent !== null);
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  function close() {
    document.removeEventListener("keydown", onKey);
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    closeCurrent = null;
    onClose?.();
    previous?.focus?.();
  }
  closeCurrent = close;
  document.addEventListener("keydown", onKey);
  root
    .querySelectorAll("[data-close-modal]")
    .forEach((b) => b.addEventListener("click", close));
  root.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) close();
  });
  bindPasswordToggles(element);
  onMount?.(element, close);
  requestAnimationFrame(() =>
    (
      element.querySelector("[autofocus]") ||
      element.querySelector("input") ||
      element.querySelector("button")
    )?.focus(),
  );
  return { element, close };
}
export function formError(form, error) {
  form.querySelectorAll(".field-error").forEach((e) => e.remove());
  form
    .querySelectorAll("[aria-invalid]")
    .forEach((e) => e.removeAttribute("aria-invalid"));
  let alert = form.querySelector(".form-alert");
  if (!alert) {
    alert = document.createElement("div");
    alert.className = "form-alert";
    form.prepend(alert);
  }
  alert.setAttribute("role", "alert");
  alert.hidden = false;
  alert.innerHTML = `${icon("alert", 17)}<span>${esc(error.message)}</span>`;
  for (const [field, message] of Object.entries(error.fields || {})) {
    const input = form.elements.namedItem(field);
    if (!input?.closest) continue;
    input.setAttribute("aria-invalid", "true");
    const msg = document.createElement("small");
    msg.className = "field-error";
    msg.textContent = message;
    input.closest(".field")?.append(msg);
  }
  (form.querySelector("[aria-invalid]") || alert).scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
}
export function busy(button, pending, label = "Saving…") {
  if (!button) return;
  if (pending) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${esc(label)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml)
      button.innerHTML = button.dataset.originalHtml;
  }
}
export function bindPasswordToggles(root = document) {
  root.querySelectorAll("[data-toggle-password]").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.innerHTML = icon(show ? "eyeOff" : "eye", 18);
      button.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
      button.setAttribute("aria-pressed", String(show));
    });
  });
}
export function passwordField(
  name,
  label,
  {
    placeholder = "Enter password",
    required = true,
    autocomplete = "new-password",
    id = name,
  } = {},
) {
  return `<div class="field"><label for="${id}">${label}${required ? "<b>*</b>" : ""}</label><div class="input-wrap"><input type="password" name="${name}" id="${id}" placeholder="${placeholder}" ${required ? "required" : ""} maxlength="128" autocomplete="${autocomplete}"><button type="button" class="password-toggle" data-toggle-password="${id}" aria-label="Show password" aria-pressed="false">${icon("eye", 18)}</button></div></div>`;
}
export function passwordChecklist(id = "newPassword") {
  return `<div class="password-checklist" data-password-checklist="${id}"><span data-rule="length">${icon("circle", 14)}8–128 characters</span><span data-rule="uppercase">${icon("circle", 14)}One uppercase letter</span><span data-rule="number">${icon("circle", 14)}One number</span></div>`;
}
export function bindChecklist(root = document) {
  root.querySelectorAll("[data-password-checklist]").forEach((list) => {
    const input = document.getElementById(list.dataset.passwordChecklist);
    if (!input) return;
    const update = () => {
      const rules = {
        length: input.value.length >= 8 && input.value.length <= 128,
        uppercase: /[A-Z]/.test(input.value),
        number: /[0-9]/.test(input.value),
      };
      for (const [key, valid] of Object.entries(rules)) {
        const item = list.querySelector(`[data-rule="${key}"]`);
        item.classList.toggle("valid", valid);
        item.querySelector("svg").outerHTML = icon(
          valid ? "checkCircle" : "circle",
          14,
        );
      }
    };
    input.addEventListener("input", update);
    update();
  });
}
export function generatePassword() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  const random = crypto.getRandomValues(new Uint32Array(14));
  const result = ["Z", "i", "7", "!"];
  for (const value of random)
    result.push(characters[value % characters.length]);
  return result.join("");
}
export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied to clipboard.");
  } catch {
    notify(
      "Clipboard access is unavailable. Select and copy the text manually.",
      "error",
    );
  }
}
export const empty = (title, description, symbol = "users") =>
  `<div class="empty-state"><span class="empty-icon">${icon(symbol, 28)}</span><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`;
export const moduleMeta = {
  "manual-handling": {
    color: "mint",
    icon: "package",
    short: "Manual handling",
  },
  "working-at-height": {
    color: "blue",
    icon: "ladder",
    short: "Working at height",
  },
  "hazard-perception": {
    color: "amber",
    icon: "alert",
    short: "Hazard perception",
  },
};
