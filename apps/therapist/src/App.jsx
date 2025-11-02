// src/App.jsx
import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import { useAuth } from "./contexts/AuthContext";
import TherapistDashboard from "./pages/Dashboard";

// Protected route que exige rol Terapeuta (usa useEffect para redirigir una sola vez)
function ProtectedTherapist({ children }) {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile || profile.rol !== "Terapeuta") {
      if (!redirectedRef.current) {
        redirectedRef.current = true;
        navigate("/login", { replace: true });
      }
    } else {
      redirectedRef.current = false;
    }
  }, [loading, user, profile, navigate]);

  if (loading) return <div className="p-6">Comprobando sesión...</div>;
  if (!user || !profile || profile.rol !== "Terapeuta") return null; // mientras redirige, no renderices nada

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedTherapist>
              <TherapistDashboard />
            </ProtectedTherapist>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
