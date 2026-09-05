import { create } from "zustand";
import api from "../services/api";

const TOKEN_KEY = "df360-token";
const MODE_KEY = "df360-mode";

export const useAuth = create((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(MODE_KEY, "user");
      set({ user: data.user, token: data.token, loading: false });
      return { ok: true, user: data.user };
    } catch (e) {
      set({ loading: false });
      return { ok: false, message: e?.response?.data?.message || "Login failed" };
    }
  },

  register: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(MODE_KEY, "user");
      set({ user: data.user, token: data.token, loading: false });
      return { ok: true, user: data.user };
    } catch (e) {
      set({ loading: false });
      return { ok: false, message: e?.response?.data?.message || "Registration failed" };
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("df360-customer-token");
    localStorage.removeItem(MODE_KEY);
    set({ user: null, token: null });
  },

  hasRole: (...roles) => {
    const u = get().user;
    return u && roles.includes(u.role);
  },
}));

export const useCustomerAuth = create((set, get) => ({
  customer: null,
  token: localStorage.getItem("df360-customer-token") || null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/customer/login", { email, password });
      localStorage.setItem("df360-customer-token", data.token);
      localStorage.setItem(MODE_KEY, "customer");
      set({ customer: data.customer, token: data.token, loading: false });
      return { ok: true, customer: data.customer };
    } catch (e) {
      set({ loading: false });
      return { ok: false, message: e?.response?.data?.message || "Login failed" };
    }
  },

  logout: () => {
    localStorage.removeItem("df360-customer-token");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MODE_KEY);
    set({ customer: null, token: null });
  },
}));