// apps/patient/src/components/SessionRecorder.jsx
import React, { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  runTransaction
} from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAuth } from "../contexts/AuthContext";

/**
 * SessionRecorder
 * Props:
 *  - asignacionId (string)
 *  - rutinaId (string)
 *  - onSessionCreated (callback(sessionId))
 *
 * Guarda sesión en collection "sesiones", actualiza progreso en "asignaciones"
 * y escribe un documento en "auditoria" (cliente).
 *
 * Muestra un toast breve en pantalla.
 */
export default function SessionRecorder({ asignacionId, rutinaId, onSessionCreated }) {
  const { user, refreshProfile } = useAuth();
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState(null);
  const [duracionMin, setDuracionMin] = useState(0);
  const [percepcion, setPercepcion] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  // toast state
  const [toast, setToast] = useState({ show: false, msg: "", type: "info" });

  useEffect(() => {
    let t;
    if (toast.show) {
      t = setTimeout(() => setToast({ show: false, msg: "", type: "info" }), 3000);
    }
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(msg, type = "info") {
    setToast({ show: true, msg, type });
  }

  function startSession() {
    setStartTs(Date.now());
    setRunning(true);
    showToast("Sesión iniciada", "info");
  }

  function stopSession() {
    if (!running || !startTs) return;
    const deltaMin = Math.max(1, Math.round((Date.now() - startTs) / 60000));
    setDuracionMin(deltaMin);
    setRunning(false);
    showToast(`Sesión detenida: ${deltaMin} min`, "info");
  }

  async function guardarSesion() {
    if (!user) {
      showToast("No autenticado", "error");
      return;
    }
    if (!asignacionId) {
      showToast("Asignación no definida", "error");
      return;
    }

    setLoading(true);
    try {
      // 1) crear sesión
      const sesionesCol = collection(db, "sesiones");
      const sesDocRef = await addDoc(sesionesCol, {
        asignacion_rutina_id: asignacionId,
        paciente_id: user.uid,
        fecha_completada: serverTimestamp(),
        duracion_minutos: duracionMin,
        percepcion_esfuerzo: percepcion,
        feedback_paciente: feedback || "",
        created_by: user.uid,
        created_at: serverTimestamp()
      });

      // 2) actualizar progreso en asignación con transaction (simple incremento)
      const asigRef = doc(db, "asignaciones", asignacionId);
      await runTransaction(db, async (tx) => {
        const asigSnap = await tx.get(asigRef);
        if (!asigSnap.exists()) {
          return;
        }
        const asig = asigSnap.data();
        let progreso = asig.progreso || 0;
        // lógica simple: suma 20% por sesión (ajusta a tu modelo)
        progreso = Math.min(100, progreso + 20);
        const nuevoEstado = progreso >= 100 ? "Completada" : (progreso > 0 ? "En progreso" : asig.estado || "Asignada");
        tx.update(asigRef, { progreso: progreso, estado: nuevoEstado });
      });

      // 3) crear auditoría (cliente) en collection "auditoria"
      try {
        const auditCol = collection(db, "auditoria");
        await addDoc(auditCol, {
          usuario_id: user.uid,
          accion: "SesionCreada",
          entidad_afectada: "sesiones",
          entidad_id: sesDocRef.id,
          datos_previos: null,
          datos_nuevos: {
            asignacion_rutina_id: asignacionId,
            paciente_id: user.uid,
            duracion_minutos: duracionMin,
            percepcion_esfuerzo: percepcion,
            feedback_paciente: feedback || ""
          },
          timestamp: serverTimestamp(),
        });
      } catch (auditErr) {
        console.warn("No se pudo escribir auditoría (cliente):", auditErr);
        // no fatal — informamos al usuario
        showToast("Sesión guardada, pero fallo la auditoría.", "warning");
      }

      // 4) refrescar profile/assignments si es necesario
      try {
        await refreshProfile();
      } catch (rpErr) {
        console.warn("refreshProfile:", rpErr);
      }

      // callback de éxito
      if (onSessionCreated) onSessionCreated(sesDocRef.id);

      showToast("Sesión guardada correctamente 👍", "success");

      // limpiar inputs
      setDuracionMin(0);
      setPercepcion(5);
      setFeedback("");
      setStartTs(null);
    } catch (err) {
      console.error("guardarSesion err", err);
      showToast("Error al guardar la sesión", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-md bg-white">
      <h3 className="font-semibold">Registrar sesión</h3>

      <div className="mt-3 flex gap-2">
        {!running ? (
          <button onClick={startSession} className="px-3 py-2 bg-green-600 text-white rounded">Iniciar</button>
        ) : (
          <button onClick={stopSession} className="px-3 py-2 bg-yellow-500 text-white rounded">Detener</button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Duración: {duracionMin} min</span>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-sm">Percepción de esfuerzo (1-10)</label>
        <input type="range" min="1" max="10" value={percepcion} onChange={(e) => setPercepcion(Number(e.target.value))} />
        <div className="text-sm text-gray-600">Valor: {percepcion}</div>
      </div>

      <div className="mt-3">
        <label className="block text-sm">Comentarios / Feedback</label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={guardarSesion} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
          {loading ? "Guardando..." : "Guardar sesión"}
        </button>
      </div>

      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed right-4 bottom-6 z-50 px-4 py-2 rounded shadow-md text-sm ${
            toast.type === "success" ? "bg-green-600 text-white" :
            toast.type === "error" ? "bg-red-600 text-white" :
            toast.type === "warning" ? "bg-yellow-500 text-black" :
            "bg-gray-800 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
