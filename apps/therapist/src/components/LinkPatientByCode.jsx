// apps/therapist/src/components/LinkPatientByCode.jsx
import React, { useState } from "react";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";
import { sha256Hex } from "../utils/crypto";

export default function LinkPatientByCode({ onLinked = () => {} , therapistId }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleLink(e) {
    e?.preventDefault && e.preventDefault();
    setMsg(null);
    if (!code.trim()) { setMsg("Ingresa el código"); return; }
    setBusy(true);
    try {
      const chash = await sha256Hex(code.trim().toUpperCase());
      // Buscar solicitudes generadas por paciente
      const q = query(collection(db, "solicitudes"), where("code_hash", "==", chash), where("used", "==", false));
      const snap = await getDocs(q);
      if (snap.empty) {
        setMsg("Código inválido o ya utilizado.");
        setBusy(false);
        return;
      }
      const reqDoc = snap.docs[0];
      const req = reqDoc.data();
      const patientUid = req.paciente_uid;
      if (!patientUid) {
        setMsg("Solicitud inválida: falta paciente_uid.");
        setBusy(false);
        return;
      }

      // Marcar solicitud como usada
      await updateDoc(reqDoc.ref, { used: true, used_by_therapist: therapistId, used_at: serverTimestamp() });

      // Crear/Merge users/{uid} y patients/{uid} con el terapeuta vinculado
      await setDoc(doc(db, "users", patientUid), {
        id: patientUid,
        terapeuta_id: therapistId,
        updated_at: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "patients", patientUid), {
        id: patientUid,
        usuario_uid: patientUid,
        created_by_terapeuta: therapistId,
        created_at: serverTimestamp()
      }, { merge: true });

      setMsg("Paciente vinculado correctamente.");
      onLinked(patientUid);
    } catch (err) {
      console.error("Error vinculando paciente:", err);
      setMsg("Error vinculando paciente. Revisa consola.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border rounded p-4 max-w-md">
      <form onSubmit={handleLink} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Código del paciente</label>
          <input value={code} onChange={(e)=>setCode(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="EJ: A1B2C3" />
          <div className="text-xs text-gray-400 mt-1">Pega el código que el paciente genera en su app.</div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="px-3 py-2 bg-emerald-600 text-white rounded">{busy ? "Vinculando..." : "Vincular paciente"}</button>
        </div>
      </form>
      {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
