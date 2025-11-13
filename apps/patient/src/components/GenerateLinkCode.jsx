// apps/patient/src/components/GenerateLinkCode.jsx
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";
import { useAuth } from "../contexts/AuthContext";

function randomCode() {
  // genera un código legible: 8 chars alfanum + guion central
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // evitando I,O,0,1 para legibilidad
  const pick = (n) => Array.from({length: n}).map(()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join("");
  return hex;
}

export default function GenerateLinkCode() {
  const { user } = useAuth();
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleGenerate() {
    if (!user?.uid) { setMsg("Debes ingresar"); return; }
    setBusy(true); setMsg("");
    try {
      const c = randomCode();
      const hash = await sha256Hex(c.trim().toUpperCase());
      // expires in 24 hours
      const expires = new Date(Date.now() + 24*60*60*1000);

      // crear doc en 'invitaciones' (o 'solicitudes' segun tu DB)
      await addDoc(collection(db, "invitaciones"), {
        paciente_uid: user.uid,
        code_hash: hash,
        created_at: serverTimestamp(),
        expires_at: expires,
        valid: true,
        used: false,
        attempts: 0
      });

      setCode(c);
      setMsg("Código generado. Compartelo con tu terapeuta.");
    } catch (err) {
      console.error("generate code error:", err);
      setMsg("Error generando código.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {code ? (
        <div className="flex items-center gap-4">
          <div className="px-4 py-3 bg-white rounded-md shadow text-lg font-mono tracking-widest">{code}</div>
          <button onClick={() => { navigator.clipboard?.writeText(code); setMsg("Copiado!"); }} className="px-3 py-2 bg-indigo-600 text-white rounded">{/*copy*/}Copiar</button>
          <button onClick={() => { setCode(null); setMsg(""); }} className="px-3 py-2 border rounded">Generar nuevo</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button onClick={handleGenerate} disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded">{busy ? "Generando..." : "Generar código"}</button>
          <div className="text-sm text-gray-500">El código expira en 24 horas.</div>
        </div>
      )}
      {msg && <div className="mt-2 text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
