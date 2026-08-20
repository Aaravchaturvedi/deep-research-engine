import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect ,useState} from "react";
import { useDispatch} from "react-redux";
//import type { RootState } from "./app/store";
import { setAccessToken ,logout} from "./features/auth/authSlice";
import axios from "axios";

export default function App() {
  const dispatch = useDispatch();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const res = await axios.post(
          "http://localhost:5000/api/auth/refresh",
          {},
          { withCredentials: true }
        );
        dispatch(setAccessToken(res.data.accessToken));
      } catch (err) {
        dispatch(logout());
      } finally {
        setCheckingAuth(false);
      }
    };
    tryRefresh();
  }, [dispatch]);

  if (checkingAuth) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    
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
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}