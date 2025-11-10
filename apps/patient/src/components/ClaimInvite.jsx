// apps/patient/src/components/ClaimInvite.jsx
import React, { useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient"; // tu Dashboard patient usa ../src/firebaseClient
import { sha256Hex } from "../utils/crypto";
import { useAuth } from "../contexts/AuthContext";

export default function ClaimInvite() {
  const { user, profile } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleClaim(e) {
    e?.preventDefault && e.preventDefault();
    if (!user?.uid) {
      setMessage("Inicia sesión primero.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const codeInput = code.trim().toUpperCase();
      if (!codeInput) { setMessage("Ingresa un código."); setBusy(false); return; }

      const codeHash = await sha256Hex(codeInput);
      const q = query(collection(db, "invitaciones"), where("code_hash", "==", codeHash), where("valid", "==", true));
      const snap = await getDocs(q);
      if (snap.empty) {
        setMessage("Código inválido o expirado.");
        setBusy(false);
        return;
      }

      const invDoc = snap.docs[0];
      const inv = invDoc.data();

      // comprobaciones cliente (las reglas server-side validan también)
      const expiresAt = inv.expires_at && inv.expires_at.toDate ? inv.expires_at.toDate() : (inv.expires_at ? new Date(inv.expires_at) : null);
      if (expiresAt && expiresAt < new Date()) {
        setMessage("Este código ya expiró.");
        setBusy(false);
        return;
      }
      if (inv.claimed_by) {
        setMessage("Este código ya fue reclamado.");
        setBusy(false);
        return;
      }

      // Intento atómico: actualizar claimed_by (las reglas impiden si ya fue reclamado)
      await updateDoc(invDoc.ref, {
        claimed_by: user.uid,
        claimed_at: serverTimestamp()
      });

      // Actualizar users/{uid} (merge) para guardar terapeuta_id
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        terapeuta_id: inv.terapeuta_id,
        email: user.email || profile?.email || null,
        nombre_completo: profile?.nombre_completo || "",
        created_at: serverTimestamp()
      }, { merge: true });

      // Crear/merge patients/{uid} para mantener info clínica
      await setDoc(doc(db, "patients", user.uid), {
        id: user.uid,
        usuario_uid: user.uid,
        nombre_completo: profile?.nombre_completo || "",
        created_by_terapeuta: inv.terapeuta_id,
        created_at: serverTimestamp()
      }, { merge: true });

      setMessage("Vinculación completada correctamente.");
    } catch (err) {
      console.error("Error reclamando invitación:", err);
      setMessage("Error reclamando invitación. Revisa consola.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 border rounded bg-white max-w-md">
      <form onSubmit={handleClaim} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Código de vinculación</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="EJ: A1B2C3" />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="px-3 py-2 bg-emerald-600 text-white rounded">{busy ? "Reclamando..." : "Reclamar código"}</button>
        </div>
      </form>

      {message && <div className="mt-3 text-sm text-gray-700">{message}</div>}
    </div>
  );
}
