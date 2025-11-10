// apps/therapist/src/components/InvitePatient.jsx
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient"; // en tu Dashboard ya usas ../firebaseClient
import { generateCode, sha256Hex } from "../utils/crypto";

export default function InvitePatient({ therapistId }) {
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);
  const [email, setEmail] = useState("");

  async function handleCreateInvite(e) {
    e?.preventDefault && e.preventDefault();
    setBusy(true);
    try {
      const code = generateCode(8); // 8 caracteres alfanum
      const codeHash = await sha256Hex(code);

      // expiración: usa cliente (ej: 7 días). Si prefieres otro valor, cambia aquí.
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

      const payload = {
        terapeuta_id: therapistId,
        code_hash: codeHash,
        created_at: serverTimestamp(),
        expires_at: expiresAt, // nota: cliente-side date (ok sin Cloud Functions)
        valid: true,
        attempts: 0,
        last_attempt_by: null,
        claimed_by: null,
        claimed_at: null,
        // opcional
        email: email?.trim()?.toLowerCase() || null
      };

      const ref = await addDoc(collection(db, "invitaciones"), payload);

      // mostrar el code TEXTUAL solo al terapeuta (no lo almacenamos en BD)
      setLastInvite({ id: ref.id, code });
    } catch (err) {
      console.error("Crear invitación error", err);
      alert("No se pudo crear la invitación. Revisa consola.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 border rounded bg-white">
      <form onSubmit={handleCreateInvite} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Email (opcional, para referencia)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="mail@paciente.com" />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="px-3 py-2 bg-indigo-600 text-white rounded">
            {busy ? "Creando..." : "Generar código de vinculación"}
          </button>
        </div>
      </form>

      {lastInvite && (
        <div className="mt-3 bg-gray-50 border p-3 rounded">
          <div className="text-sm text-gray-600">Código creado (comparte con tu paciente)</div>
          <div className="font-mono text-lg mt-1">{lastInvite.code}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(lastInvite.code)} className="px-2 py-1 border rounded text-sm">Copiar</button>
          </div>
        </div>
      )}
    </div>
  );
}
