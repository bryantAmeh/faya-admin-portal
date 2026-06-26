"use client";

/**
 * Global portal UI state — current view, selected country/staff/case, sidebar.
 */
import { create } from "zustand";

export type PortalView =
  | "dashboard"
  | "staff"
  | "departments"
  | "countries"
  | "country_detail"
  | "compliance"
  | "risk"
  | "devices"
  | "finance"
  | "support"
  | "disputes"
  | "audit"
  | "approvals";

interface PortalState {
  view: PortalView;
  selectedCountryCode: string | null;
  selectedStaffId: string | null;
  selectedCaseId: string | null;
  sidebarCollapsed: boolean;

  setView: (view: PortalView) => void;
  selectCountry: (code: string | null) => void;
  selectStaff: (id: string | null) => void;
  selectCase: (id: string | null) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  view: "dashboard",
  selectedCountryCode: null,
  selectedStaffId: null,
  selectedCaseId: null,
  sidebarCollapsed: false,

  setView: (view) => set({ view }),
  selectCountry: (code) => set({ selectedCountryCode: code }),
  selectStaff: (id) => set({ selectedStaffId: id }),
  selectCase: (id) => set({ selectedCaseId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  reset: () =>
    set({
      view: "dashboard",
      selectedCountryCode: null,
      selectedStaffId: null,
      selectedCaseId: null,
    }),
}));
