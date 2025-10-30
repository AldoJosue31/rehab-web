// apps/patient/src/pages/VerifyEmail.jsx
import React, { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../src/firebaseClient";

export default function VerifyEmail() {
  const [status, setStatus] = useState("");

  const handleResend = async () => {
    setStatus("");
    try {
      if (!auth.currentUser) {
        setStatus("No hay usuario autenticado.");
        return;
      }
      await sendEmailVerification(auth.currentUser);
      setStatus("Correo de verificación reenviado. Revisa bandeja y spam.");
    } catch (err) {
      console.error(err);
      setStatus("Error al reenviar correo. Intenta más tarde.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold">Verifica tu correo</h2>
        <p className="mt-2 text-gray-600">
          Debes verificar tu correo para continuar. Revisa la bandeja y spam.
        </p>

        <div className="mt-4 flex gap-2">
          <button onClick={handleResend} className="px-4 py-2 bg-blue-600 text-white rounded">
            Reenviar correo de verificación
          </button>
        </div>

        {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
      </div>
    </div>
  );
}
