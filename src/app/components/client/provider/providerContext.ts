"use client";
import { create } from "zustand";

interface FrontEndProviderState {
  currentFrontendProviderIndex: number;
  setCurrentFrontendProviderIndex: (currentFrontendProviderIndex: number) => void;
}

export const useFrontendProvider = create<FrontEndProviderState>()((set) => ({
  currentFrontendProviderIndex: 0,
  setCurrentFrontendProviderIndex: (currentFrontendProviderIndex) =>
    set({ currentFrontendProviderIndex }),
}));
