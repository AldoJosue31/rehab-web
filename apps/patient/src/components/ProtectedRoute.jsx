// apps/patient/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * ProtectedRoute: envuelve rutas que requieren autenticación.
 * Si no hay user -> redirige a /login
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-6">Comprobando sesión...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
