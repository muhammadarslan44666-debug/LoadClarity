// Talks to the LoadClarity server (see /server). Same shape the pages already use:
//   api.entities.Load.filter({ company_id }, '-created_date', 100)
//   api.auth.me() / login() / register() / logout()
const TOKEN_KEY = 'loadclarity_token';

export const getToken = () => {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked */ }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Make sure it is running (npm run dev).', 0);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
  }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data);
  return data;
}

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
};

const entityApi = (name) => ({
  list: (sort, limit) => request('GET', `/entities/${name}${qs({ sort, limit })}`),
  filter: (query = {}, sort, limit) => request('GET', `/entities/${name}${qs({ q: JSON.stringify(query || {}), sort, limit })}`),
  get: (id) => request('GET', `/entities/${name}/${encodeURIComponent(id)}`),
  create: (data) => request('POST', `/entities/${name}`, data),
  update: (id, data) => request('PATCH', `/entities/${name}/${encodeURIComponent(id)}`, data),
  delete: (id) => request('DELETE', `/entities/${name}/${encodeURIComponent(id)}`),
});

const cache = {};
const entities = new Proxy({}, {
  get: (_, name) => (typeof name === 'string' ? (cache[name] ||= entityApi(name)) : undefined),
});

const auth = {
  isAuthenticated: async () => {
    if (!getToken()) return false;
    try { await request('GET', '/auth/me'); return true; } catch { return false; }
  },
  me: () => request('GET', '/auth/me'),
  updateMe: (data) => request('PATCH', '/auth/me', data),
  register: async (email, password, full_name) => {
    const r = await request('POST', '/auth/register', { email, password, full_name });
    setToken(r.token);
    return r.user;
  },
  login: async (email, password) => {
    const r = await request('POST', '/auth/login', { email, password });
    setToken(r.token);
    return r.user;
  },
  logout: (redirectTo = '/login') => {
    setToken(null);
    if (redirectTo) window.location.href = redirectTo;
  },
  resetPasswordRequest: (email) => request('POST', '/auth/reset-request', { email }),
  resetPassword: ({ resetToken, newPassword }) => request('POST', '/auth/reset', { resetToken, newPassword }),
};

const ai = {
  extractOffer: (text) => request('POST', '/ai/extract-offer', { text }),
};

const billing = {
  status: () => request('GET', '/billing/status'),
  reserveRateConUpload: () => request('POST', '/billing/ratecon-usage/reserve', {}),
  releaseRateConUpload: () => request('POST', '/billing/ratecon-usage/release', {}),
};

const parse = async (res) => {
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; } }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data);
  return data;
};

const documents = {
  upload: async (file, { load_id, doc_type }) => {
    let res;
    try {
      res = await fetch(`/api/documents/upload${qs({ load_id, doc_type, name: file.name })}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
    } catch {
      throw new ApiError('Cannot reach the server. Make sure it is running (npm run dev).', 0);
    }
    return parse(res);
  },
  // Opens the file in a new tab. The file needs the sign-in token, so it is fetched first.
  open: async (id) => {
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}/file`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) await parse(res);
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  },
  remove: (id) => request('DELETE', `/documents/${encodeURIComponent(id)}`),
};

export const api = { entities, auth, ai, billing, documents };
