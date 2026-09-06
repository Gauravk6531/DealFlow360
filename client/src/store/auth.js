import { create } from "zustand";
import api from "../services/api";

const TOKEN_KEY = "df360-token";
const USER_KEY = "df360-user";
const CUSTOMER_KEY = "df360-customer";
const MODE_KEY = "df360-mode";

const readStored = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export const useAuth = create((set, get) => ({
  user: readStored(USER_KEY),
  token: localStorage.getItem(TOKEN_KEY) || null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
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
  customer: readStored(CUSTOMER_KEY),
  token: localStorage.getItem("df360-customer-token") || null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/customer/login", { email, password });
      localStorage.setItem("df360-customer-token", data.token);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
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
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MODE_KEY);
    set({ customer: null, token: null });
  },
}));