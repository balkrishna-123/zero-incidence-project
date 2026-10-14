export class ApiError extends Error {
  constructor(message, status, fields, code) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}
let csrfToken = "";
export async function request(url, { method = "GET", body, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  const multipart = body instanceof FormData;
  if (body && !multipart) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`/api${url}`, {
      method,
      headers,
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
      credentials: "same-origin",
      signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError(
      "Unable to connect. Check your connection and try again.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) {
    if (
      response.status === 401 &&
      ["AUTH_REQUIRED", "SESSION_ENDED"].includes(data.code)
    )
      window.dispatchEvent(new CustomEvent("session-ended"));
    if (data.code === "PASSWORD_CHANGE_REQUIRED")
      window.dispatchEvent(new CustomEvent("password-required"));
    throw new ApiError(
      data.error || "Something went wrong. Please try again.",
      response.status,
      data.fields,
      data.code,
    );
  }
  return data;
}
export const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: "POST", body }),
  patch: (url, body) => request(url, { method: "PATCH", body }),
  delete: (url, body) => request(url, { method: "DELETE", body }),
};

// Authenticated binary download; unlike a navigation this keeps API errors in the UI.
export async function downloadFile(url, filename) {
  let response;
  try {
    response = await fetch(`/api${url}`, {
      credentials: "same-origin",
      headers: { Accept: "application/pdf" },
    });
  } catch {
    throw new ApiError(
      "Unable to download. Check the connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401)
      window.dispatchEvent(new CustomEvent("session-ended"));
    if (data.code === "PASSWORD_CHANGE_REQUIRED")
      window.dispatchEvent(new CustomEvent("password-required"));
    throw new ApiError(
      data.error || "The certificate could not be downloaded.",
      response.status,
      data.fields,
      data.code,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/pdf"))
    throw new ApiError(
      "The server did not return a PDF. Refresh the page and try again.",
      502,
    );
  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectURL;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectURL), 15000);
}
