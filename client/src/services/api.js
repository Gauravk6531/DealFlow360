import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const mode = localStorage.getItem("df360-mode") || "user";
  const key = mode === "customer" ? "df360-customer-token" : "df360-token";
  const token = localStorage.getItem(key);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const mode = localStorage.getItem("df360-mode") || "user";
      const key = mode === "customer" ? "df360-customer-token" : "df360-token";
      localStorage.removeItem(key);
      if (!window.location.pathname.includes("/portal")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || "Something went wrong";

export default api;