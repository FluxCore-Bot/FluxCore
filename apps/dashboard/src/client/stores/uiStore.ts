import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface UiState {
  toasts: Toast[];
  addToast: (message: string, type: "success" | "error") => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
