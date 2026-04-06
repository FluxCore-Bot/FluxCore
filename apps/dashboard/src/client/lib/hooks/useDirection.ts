import { createContext, useContext, useState, useCallback } from "react";

type Direction = "ltr" | "rtl";

interface DirectionContextValue {
  dir: Direction;
  setDir: (dir: Direction) => void;
}

export const AppDirectionContext = createContext<DirectionContextValue>({
  dir: "ltr",
  setDir: () => {},
});

export function useAppDirection() {
  return useContext(AppDirectionContext);
}

export function useDirectionState(initial: Direction): DirectionContextValue {
  const [dir, setDirState] = useState<Direction>(initial);

  const setDir = useCallback((newDir: Direction) => {
    setDirState(newDir);
    document.documentElement.dir = newDir;
  }, []);

  return { dir, setDir };
}
