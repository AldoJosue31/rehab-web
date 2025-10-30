// apps/patient/src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../src/firebaseClient";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("Email de recuperación enviado. Revisa tu bandeja.");
    } catch (err) {
      console.error(err);
      setMsg("No se pudo enviar el email. Revisa el correo e intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-2">Recuperar contraseña</h2>
        <form onSubmit={handleReset} className="space-y-3">
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded">Enviar</button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
