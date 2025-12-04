// apps/therapist/src/components/TherapistProfile.jsx
import React, { useEffect, useState } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAuth } from "../contexts/AuthContext";

/**
 * TherapistProfile
 * Props:
 *  - onBack() optional, callback para volver
 *  - onEdit() optional, callback para editar (si lo quieres)
 */
export default function TherapistProfile({ onBack = () => {}, onEdit = null }) {
  const { user, profile, logout } = useAuth();
  const [data, setData] = useState(profile || null);
  const [loading, setLoading] = useState(!profile && !!user);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      if (profile) {
        setData(profile);
        setLoading(false);
        return;
      }
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!mounted) return;
        if (snap.exists()) setData({ id: snap.id, ...snap.data() });
        else setData(null);
      } catch (err) {
        console.warn("Error fetching therapist profile:", err);
        setError("No se pudo cargar el perfil.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => { mounted = false; };
  }, [user, profile]);

  const formatDate = (ts) => {
    try { return ts?.toDate ? ts.toDate().toLocaleString() : (ts ? String(ts) : "—"); } catch { return "—"; }
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando perfil...</p>;
  if (!data) return <p className="text-sm text-gray-500">Perfil no disponible.</p>;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-gray-600">{(data.nombre_completo || data.nombre || "T").charAt(0)}</span>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold">{data.nombre_completo || data.nombre || "Sin nombre"}</h2>
            <div className="text-sm text-gray-500">{data.rol || "Terapeuta"}</div>
            <div className="text-xs text-gray-400 mt-1">UID: <span className="font-mono text-xs">{data.id || user?.uid}</span></div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1 border rounded">Volver</button>
          {typeof onEdit === "function" && (
            <button onClick={onEdit} className="px-3 py-1 bg-indigo-600 text-white rounded">Editar</button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h4 className="font-medium mb-2">Información</h4>
          <div className="text-sm text-gray-700">
            <div className="mb-2"><span className="text-xs text-gray-400">Email:</span> <div className="font-medium">{data.email || "—"}</div></div>
            <div className="mb-2"><span className="text-xs text-gray-400">Cédula profesional:</span> <div className="font-medium">{data.cedula_profesional || "—"}</div></div>
            <div className="mb-2"><span className="text-xs text-gray-400">Especialidad:</span> <div className="font-medium">{data.especialidad || "—"}</div></div>
            <div className="mb-2"><span className="text-xs text-gray-400">Edad:</span> <div className="font-medium">{data.edad ?? "—"}</div></div>
            <div className="mb-2"><span className="text-xs text-gray-400">Estado:</span> <div className="font-medium">{data.estado || "—"}</div></div>
            <div className="mb-2"><span className="text-xs text-gray-400">Creado:</span> <div className="font-medium">{formatDate(data.created_at)}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h4 className="font-medium mb-2">Biografía / Notas</h4>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {data.bio || data.descripcion || "Sin biografía"}
          </div>

          <div className="mt-6">
            <h5 className="font-medium mb-2">Acciones</h5>
            <div className="flex flex-col gap-2">
              <button onClick={() => logout()} className="px-3 py-2 bg-rose-500 text-white rounded text-left">Cerrar sesión</button>
              {/* aquí puedes añadir más acciones (ej: cambiar foto) */}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}
    </div>
  );
}
