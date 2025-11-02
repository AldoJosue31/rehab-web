// src/pages/TherapistDashboard.jsx
import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function TherapistDashboard() {
  const { profile, user, logout } = useAuth();

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Panel Terapeuta</h1>
          <div>
            <button onClick={logout} className="px-4 py-2 rounded-full bg-rose-500 text-white">Cerrar sesión</button>
          </div>
        </div>

        <div>
          <p><strong>UID:</strong> {user?.uid}</p>
          <p><strong>Nombre:</strong> {profile?.nombre_completo || user?.displayName || "-"}</p>
          <p><strong>Email:</strong> {profile?.email || user?.email}</p>
          <p><strong>Rol:</strong> {profile?.rol || "—"}</p>
        </div>
      </div>
    </div>
  );
}
