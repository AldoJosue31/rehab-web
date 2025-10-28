// apps/patient/src/pages/Login.jsx
import React, { useState } from "react";
import { auth, db } from "../src/firebaseClient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
      const userRef = doc(db, "users", cred.user.uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        await setDoc(userRef, {
          id: cred.user.uid,
          nombre_completo: displayName || "",
          email: cred.user.email,
          rol: "Paciente",
          created_at: new Date().toISOString()
        });
      }
      alert("Cuenta creada. Ya puedes iniciar sesión.");
      setMode("login");
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start py-10 bg-pleasant">
      {/* Decorative SVG shapes (subtle, animated) */}
      <div className="bg-decor-svg -z-10" aria-hidden>
        <svg className="absolute left-0 top-0 svgFloat" style={{ width: 420, height: 420, transform: "translate(-30%, -10%)" }} viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="70" r="90" fill="#EAA48A" />
          <circle cx="320" cy="140" r="120" fill="#3b2a4f" />
        </svg>

        <svg className="absolute right-0 bottom-0 svgFloat" style={{ width: 560, height: 560, transform: "translate(10%, 20%)", animationDelay: "1.5s" }} viewBox="0 0 560 560" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="280" cy="280" rx="200" ry="120" fill="#A6D7FF" />
        </svg>
      </div>

      {/* Banner superior */}
      <div className="w-full flex justify-center px-4">
        <div className="max-w-4xl w-full bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-[rgba(234,164,138,0.5)] shadow-lg py-8 px-6 sm:px-12 md:px-20">
          <h1 className="text-3xl md:text-4xl font-light text-center text-[#2b2340]">mHealth</h1>
        </div>
      </div>

      {/* Card */}
      <div className="w-full flex justify-center -mt-12 px-4">
        <div className="w-full max-w-md bg-[#FFF8F3]/95 rounded-2xl shadow-2xl border border-[#EAA48A]/40 p-6 sm:p-8 backdrop-blur-[2px]">
          {/* Tabs */}
          <div className="flex gap-6 justify-center mb-4">
            <button
              className={`text-sm font-medium pb-2 ${mode === "signup" ? "border-b-2 border-[#3b2a4f] text-[#3b2a4f]" : "text-gray-400"}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Crear cuenta
            </button>
            <button
              className={`text-sm font-medium pb-2 ${mode === "login" ? "border-b-2 border-[#3b2a4f] text-[#3b2a4f]" : "text-gray-400"}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Iniciar sesión
            </button>
          </div>

          <h2 className="text-2xl font-semibold text-[#2b2340] mb-1">
            {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">Es hora de comenzar a recuperar la movilidad</p>

          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm text-gray-600 mb-2">Nombre completo</label>
                <input
                  className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Juan Pérez"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-600 mb-2">Correo electrónico</label>
              <input
                type="email"
                className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div className="relative">
              <label className="block text-sm text-gray-600 mb-2">Contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20 pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-9 text-gray-500"
                aria-label="Mostrar contraseña"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3-11-7 1.02-2.06 2.58-3.86 4.5-5.06m3.38-1.7A9.955 9.955 0 0112 5c5 0 9.27 3 11 7-1.02 2.06-2.58 3.86-4.5 5.06M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18M10.58 10.58A3 3 0 0113.42 13.42M9.5 9.5a3 3 0 004 4" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-full py-3 font-semibold shadow-md bg-[#3b2a4f] text-white disabled:opacity-60"
            >
              {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

          <div className="text-center text-sm text-gray-500 mt-4">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button onClick={() => setMode("signup")} className="text-[#3b2a4f] font-medium" type="button">
                  Crear una
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button onClick={() => setMode("login")} className="text-[#3b2a4f] font-medium" type="button">
                  Inicia sesión
                </button>
              </>
            )}
          </div>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-400 text-center mb-3">regístrate con:</p>
            <div className="flex gap-3">
              <button className="flex-1 rounded-full py-2 px-3 border border-[#EAA48A]/45 flex items-center justify-center gap-2 bg-white">
                <svg className="h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#000" strokeOpacity="0.08"/></svg>
                <span className="text-sm font-medium">Continuar con Google</span>
              </button>
              <button className="flex-1 rounded-full py-2 px-3 border border-[#EAA48A]/45 flex items-center justify-center gap-2 bg-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16 7c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM12 2C6.48 2 2 6.48 2 12c0 3.31 1.61 6.26 4.09 8.17.49.38 1.21.28 1.57-.23.64-.94 1.53-1.7 2.6-2.24.63-.33.86-1.12.48-1.69C9.08 13.53 9 12.8 9 12c0-3.87 3.13-7 7-7s7 3.13 7 7c0 .8-.08 1.53-.22 2.21-.21.95.01 1.98.58 2.74.37.48.99.66 1.57.44C23.75 18.36 26 15.36 26 12 26 6.48 21.52 2 16 2z"/></svg>
                <span className="text-sm font-medium">Continuar con Apple</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">Consejo: si estás en modo demo usa un correo real creado desde Firebase Console para probar.</p>
        </div>
      </div>
    </div>
  );
}
