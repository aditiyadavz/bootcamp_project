// Small pop-up messages. Any page can call showToast('Saved', 'success').
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const showToast = useCallback((text, kind = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => <p key={toast.id} className={`toast ${toast.kind}`}>{toast.text}</p>)}
      </div>
    </ToastContext.Provider>
  );
}
