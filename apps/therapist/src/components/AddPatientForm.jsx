// apps/therapist/src/components/AddPatientForm.jsx
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient"; // asegúrate que la ruta funcione desde components
import { generateCode, sha256Hex } from "../utils/crypto";
import { useAuth } from "../contexts/AuthContext";

/**
 * Form para añadir paciente o generar invitación.
 * Props:
 *  - onSubmit(form) => async  // para crear paciente inmediatamente (como antes)
 *  - onCancel()
 *  - busy, error
 */
export default function AddPatientForm({ onSubmit = () => {}, onCancel = () => {}, busy = false, error = "" }) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tutor, setTutor] = useState("");
  const [nivel, setNivel] = useState("Moderado");

  // --- invitación states ---
  const [useInvite, setUseInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);
  const [inviteError, setInviteError] = useState("");

  async function handleCreateInvite(e) {
    e?.preventDefault && e.preventDefault();
    setInviteError("");
    if (!user?.uid) {
      setInviteError("Inicia sesión primero.");
      return;
    }
    setCreatingInvite(true);
    try {
      // generar código y su hash
      const code = generateCode(8);
      const codeHash = await sha256Hex(code);

      // expiración cliente-side (7 días)
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

      const payload = {
        terapeuta_id: user.uid,
        code_hash: codeHash,
        created_at: serverTimestamp(),
        expires_at: expiresAt,
        valid: true,
        attempts: 0,
        last_attempt_by: null,
        claimed_by: null,
        claimed_at: null,
        email: inviteEmail?.trim()?.toLowerCase() || null
      };

      const ref = await addDoc(collection(db, "invitaciones"), payload);

      // devolvemos el code para que el terapeuta lo comparta (no guardamos plain-code en la BD)
      setLastInvite({ id: ref.id, code });
    } catch (err) {
      console.error("Crear invitación error", err);
      setInviteError("No se pudo crear la invitación. Revisa la consola.");
    } finally {
      setCreatingInvite(false);
    }
  }

  // Submit general: si useInvite está ON, generamos invitación; si está OFF, llamamos onSubmit para crear paciente
  async function handleSubmit(e) {
    e?.preventDefault && e.preventDefault();
    setInviteError("");
    if (useInvite) {
      // genera invitación y muestra código (no crea paciente)
      await handleCreateInvite();
      return;
    }
    // comportamiento original: crear paciente ahora (llama al prop onSubmit)
    await onSubmit({ nombre, telefono, tutor, nivel });
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={useInvite} onChange={(e) => setUseInvite(e.target.checked)} className="mr-2" />
            <span className="text-sm text-gray-700">Crear invitación (enviar código al paciente)</span>
          </label>
          <div className="text-xs text-gray-400 ml-auto">Si activas, se generará un código en vez de crear paciente ahora</div>
        </div>

        {useInvite ? (
          <>
            <div>
              <label className="block text-sm text-gray-600">Email del paciente (opcional)</label>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="mail@paciente.com (opcional)" />
              <p className="text-xs text-gray-500 mt-1">Si indicas email, te servirá como referencia para buscarle o vincular más tarde.</p>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={creatingInvite} className="px-4 py-2 bg-indigo-600 text-white rounded">
                {creatingInvite ? "Creando invitación..." : "Generar invitación"}
              </button>
              <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
            </div>

            {inviteError && <p className="text-sm text-rose-600 mt-2">{inviteError}</p>}

            {lastInvite && (
              <div className="mt-3 bg-gray-50 border p-3 rounded">
                <div className="text-sm text-gray-600">Código creado — compártelo con el paciente:</div>
                <div className="font-mono text-lg mt-1">{lastInvite.code}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(lastInvite.code)} className="px-2 py-1 border rounded text-sm">Copiar código</button>
                  <button onClick={() => { navigator.clipboard.writeText(`Tu código para vincular con el terapeuta: ${lastInvite.code}`); alert("Texto copiado: pega el mensaje donde quieras compartirlo"); }} className="px-2 py-1 border rounded text-sm">Copiar mensaje</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-600">Nombre completo</label>
              <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Ej. Juan Pérez" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Teléfono de emergencia</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="55 5555 5555" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nombre del tutor</label>
                <input value={tutor} onChange={(e) => setTutor(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Nombre del encargado" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600">Nivel de movilidad</label>
              <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="w-full border rounded px-4 py-2">
                <option>Alto</option>
                <option>Moderado</option>
                <option>Bajo</option>
                <option>Sin movilidad</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded">{busy ? "Guardando..." : "Guardar paciente"}</button>
              <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
            </div>

            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </>
        )}
      </form>
    </div>
  );
}
