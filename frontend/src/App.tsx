import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Logo from "./components/Logo";
import { ToastProvider } from "./components/Toasts";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setAccessToken, logout } from "./features/auth/authSlice";
import api from "./lib/axios";

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <Logo size={48} />
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        Loading Deep Research Engine…
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
      <Logo size={44} />
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you’re looking for doesn’t exist.</p>
      <Link
        to="/chat"
        className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to chat
      </Link>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const tryRefresh = async () => {
      try {
        // Same-origin refresh (works through nginx and in local dev).
        const res = await api.post("/auth/refresh", {});
        dispatch(setAccessToken(res.data.accessToken));
      } catch {
        dispatch(logout());
      } finally {
        setCheckingAuth(false);
      }
    };
    tryRefresh();
  }, [dispatch]);

  if (checkingAuth) return <BootScreen />;

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<LoginPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
