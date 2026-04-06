import { createContext, useContext } from "react";

interface MobileSidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const MobileSidebarContext = createContext<MobileSidebarContextValue>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
