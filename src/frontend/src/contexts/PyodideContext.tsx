import { createContext, useContext, useEffect, useRef, useState } from "react";

interface PyodideContextType {
  pyodide: any;
  isLoading: boolean;
  loadingMessage: string;
  loadError: string | null;
}

const PyodideContext = createContext<PyodideContextType>({
  pyodide: null,
  isLoading: true,
  loadingMessage: "Loading Python...",
  loadError: null,
});

export function PyodideProvider({ children }: { children: React.ReactNode }) {
  const [pyodide, setPyodide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(
    "Loading Python runtime...",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
    script.async = true;

    script.onload = async () => {
      try {
        setLoadingMessage("Initializing Python environment...");
        const py = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        });
        setPyodide(py);
        setLoadingMessage("Ready");
        setIsLoading(false);
      } catch (e: any) {
        setLoadError(e?.message ?? "Failed to initialize Pyodide");
        setIsLoading(false);
      }
    };

    script.onerror = () => {
      setLoadError("Failed to load Pyodide from CDN. Check your connection.");
      setIsLoading(false);
    };

    document.head.appendChild(script);
  }, []);

  return (
    <PyodideContext.Provider
      value={{ pyodide, isLoading, loadingMessage, loadError }}
    >
      {children}
    </PyodideContext.Provider>
  );
}

export function usePyodide() {
  return useContext(PyodideContext);
}
