// apps/therapist/src/components/LinkPatientByCode.jsx
import React, { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  setDoc,
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAuth } from "../contexts/AuthContext";

// SHA256 helper (cliente) — si ya tienes sha256Hex importado, puedes eliminar esta impl.
async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join("");
}

export default function LinkPatientByCode({ onLinked = () => {}, therapistId: propTherapistId = null }) {
  const { user } = useAuth();
  const therapistId = propTherapistId || user?.uid || null;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function prettyDate(ts) {
    try {
      return ts && typeof ts.toDate === "function" ? ts.toDate().toLocaleString() : (ts ? new Date(ts).toLocaleString() : "n/a");
    } catch (e) { return String(ts); }
  }

  async function handleLink(e) {
    e?.preventDefault && e.preventDefault();
    setMsg(null);

    const trimmed = (code || "").trim();
    if (!trimmed) { setMsg("Ingresa el código."); return; }
    if (!therapistId) { setMsg("No hay terapeuta autenticado."); return; }

    setBusy(true);
    try {
      console.log("[LinkPatient DEBUG] start handleLink", { therapistId, input: trimmed, uid: user?.uid });

      const chash = await sha256Hex(trimmed.toUpperCase());
      const chashLower = chash.toLowerCase();
      const chashUpper = chash.toUpperCase();
      console.log("[LinkPatient DEBUG] chash:", chash, { chashLower, chashUpper });

      const now = new Date();

      // 1) Intento diagnóstico: buscar por code_hash solo (sin filtros) — para ver si hay doc con ese hash
      async function findByHash(hash) {
        const q = query(collection(db, "invitaciones"), where("code_hash", "==", hash));
        const snap = await getDocs(q);
        return snap;
      }

      let snap = await findByHash(chash);
      console.log("[LinkPatient DEBUG] search by chash size:", snap.size);
      if (snap.size === 0 && chash !== chashLower) {
        snap = await findByHash(chashLower);
        console.log("[LinkPatient DEBUG] search by chashLower size:", snap.size);
      }
      if (snap.size === 0 && chash !== chashUpper) {
        snap = await findByHash(chashUpper);
        console.log("[LinkPatient DEBUG] search by chashUpper size:", snap.size);
      }

      if (snap.empty) {
        // Nada encontrado: explicar causas probables y cómo verificar manualmente
        console.warn("[LinkPatient DEBUG] No se encontró ninguna invitación con ese code_hash.");
        setMsg(`No se encontró invitación. Posibles causas: código pegado incorrecto (espacios/hyphens), hash generado distinto al guardado, o invitación fue eliminada. Revisa en Firebase Console la colección 'invitaciones' y compara el campo code_hash con este valor: ${chashLower}`);
        setBusy(false);
        return;
      }

      // Si llegamos aquí, hay al menos 1 doc con ese hash — evaluar cada doc y ver si cumple los filtros
      let candidate = null;
      for (const d of snap.docs) {
        const data = d.data();
        console.log(`[LinkPatient DEBUG] found doc ${d.id}`, data);

        const usedFlag = !!data.used;
        const validFlag = data.valid === true;
        const expiresAt = data.expires_at;
        const expiresDate = expiresAt && typeof expiresAt.toDate === "function" ? expiresAt.toDate() : (expiresAt ? new Date(expiresAt) : null);
        const expired = expiresDate ? (expiresDate <= now) : false;

        console.log(`[LinkPatient DEBUG] doc ${d.id} -> used:${usedFlag}, valid:${validFlag}, expires_at:${prettyDate(expiresAt)}, expired:${expired}`);

        if (!usedFlag && validFlag && !expired) {
          candidate = { id: d.id, ref: d.ref, data };
          break;
        }
      }

      if (!candidate) {
        // Ningún doc cumple las condiciones de la consulta completa: informar por qué
        const diagnostics = snap.docs.map(d => {
          const data = d.data();
          const usedFlag = !!data.used;
          const validFlag = data.valid === true;
          const expiresAt = data.expires_at;
          const expiresDate = expiresAt && typeof expiresAt.toDate === "function" ? expiresAt.toDate() : (expiresAt ? new Date(expiresAt) : null);
          const expired = expiresDate ? (expiresDate <= now) : false;
          return { id: d.id, used: usedFlag, valid: validFlag, expires_at: prettyDate(expiresAt), expired };
        });
        console.warn("[LinkPatient DEBUG] Ningún documento disponible para vincular. Diagnostics:", diagnostics);
        setMsg("Se encontró la invitación, pero está inválida/expirada/o ya usada. Mira la consola para detalles.");
        setBusy(false);
        return;
      }

      // candidate existe: proceder con la transacción (marcar usado + crear/merge patients)
      console.log("[LinkPatient DEBUG] candidate to link:", candidate.id, candidate.data);

      // Transacción: marcar invitación como usada
      try {
        await runTransaction(db, async (tx) => {
          const s = await tx.get(candidate.ref);
          if (!s.exists()) throw new Error("Invitación desapareció (concurrency).");
          const current = s.data();
          // re-chequear
          if (!current.valid) throw new Error("Invitación inválida (current.valid=false).");
          if (current.used) throw new Error("Código ya utilizado (current.used=true).");
          const exp = current.expires_at && typeof current.expires_at.toDate === "function" ? current.expires_at.toDate() : (current.expires_at ? new Date(current.expires_at) : null);
          if (exp && exp <= new Date()) throw new Error("Código expirado (current.expires_at <= now).");

          tx.update(candidate.ref, {
            used: true,
            terapeuta_id: therapistId,
            used_at: serverTimestamp(),
            attempts: current.attempts || 0,
            ...(current.claimed_by ? { claimed_by: current.claimed_by, claimed_at: current.claimed_at } : {})
          });
        });
        console.log("[LinkPatient DEBUG] updateDoc succeeded for", candidate.id);
      } catch (txErr) {
        console.error("[LinkPatient DEBUG] transaction failed:", txErr);
        throw txErr;
      }

      // Mergear patients/{uid} con datos desde users/{uid}
      const patientUid = candidate.data.paciente_uid;
      let userData = {};
      try {
        const userSnap = await getDoc(doc(db, "users", patientUid));
        if (userSnap.exists()) {
          userData = userSnap.data();
          console.log("[LinkPatient DEBUG] users/{uid} fetched:", userData);
        } else {
          console.warn("[LinkPatient DEBUG] users/{uid} no existe:", patientUid);
        }
      } catch (errUserFetch) {
        console.warn("[LinkPatient DEBUG] error leyendo users/{uid}:", errUserFetch);
      }

      const patientPayload = {
        id: patientUid,
        usuario_uid: patientUid,
        terapeuta_id: therapistId,
        created_by_terapeuta: therapistId,
        linked_at: serverTimestamp(),
        ...(userData.nombre_completo ? { nombre_completo: userData.nombre_completo } : {}),
        ...(userData.email ? { email: userData.email } : {}),
        ...(userData.telefono_celular ? { telefono_emergencia: userData.telefono_celular } : {}),
        ...(userData.edad || userData.edad === 0 ? { edad: userData.edad } : {}),
        ...(userData.discapacidad ? { discapacidad: userData.discapacidad } : {})
      };

      try {
        await setDoc(doc(db, "patients", patientUid), patientPayload, { merge: true });
        console.log("[LinkPatient DEBUG] patients/{uid} written OK:", patientUid, patientPayload);
        setMsg("Paciente vinculado correctamente.");
        onLinked(patientUid);
      } catch (errSet) {
        console.error("[LinkPatient DEBUG] fallo creando/mergeando patients/{uid}:", errSet);
        setMsg("Código marcado como usado, pero no fue posible crear/actualizar patients/{uid} (ver consola).");
        onLinked(patientUid);
      }

    } catch (err) {
      console.error("[LinkPatient DEBUG] Error vinculando paciente (outer):", err);
      if (err && (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission")))) {
        setMsg("Permisos insuficientes: revisa reglas (invitaciones.update / patients.create).");
      } else {
        setMsg(err && err.message ? err.message : "Error vinculando paciente.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border rounded p-4 max-w-md">
      <form onSubmit={handleLink} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 font-medium">Código del paciente</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border rounded px-3 py-2 mt-1"
            placeholder="EJ: A1B2C3"
            autoComplete="off"
          />
          <div className="text-xs text-gray-400 mt-1">Pega el código que el paciente genera en su app.</div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-60">
            {busy ? "Vinculando..." : "Vincular paciente"}
          </button>
          <button type="button" onClick={() => { setCode(""); setMsg(null); }} className="px-3 py-2 border rounded">
            Limpiar
          </button>
        </div>
      </form>
      {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
