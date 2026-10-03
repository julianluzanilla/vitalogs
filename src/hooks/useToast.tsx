import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  msg: string;
  action?: ToastAction;
  key: number;
}

const Ctx = createContext<(msg: string, action?: ToastAction) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((msg: string, action?: ToastAction) => {
    clearTimeout(timer.current);
    setToast({ msg, action, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 2200);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.msg}
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
