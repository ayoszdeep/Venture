const API_BASE = "/api/v1";

const listeners = new Set();
let sequence = 0;

export function onApiCall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function api(method, path, { body, token } = {}) {
  const startedAt = performance.now();

  let status = 0;
  let payload = null;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    status = response.status;
    payload = await response.json().catch(() => null);
  } catch (error) {
    sequence += 1;
    const failed = {
      id: sequence,
      method,
      path: `${API_BASE}${path}`,
      status: 0,
      ms: Math.round(performance.now() - startedAt),
      note: "backend unreachable",
    };
    listeners.forEach((listener) => listener(failed));

    return {
      ok: false,
      status: 0,
      message: "Could not reach the backend. Is it running on port 4000?",
    };
  }

  sequence += 1;
  const entry = {
    id: sequence,
    method,
    path: `${API_BASE}${path}`,
    status,
    ms: Math.round(performance.now() - startedAt),
    cache: payload?.meta?.cache,
  };
  listeners.forEach((listener) => listener(entry));

  return {
    ok: status >= 200 && status < 300,
    status,
    data: payload?.data,
    meta: payload?.meta,
    message: payload?.message,
  };
}
