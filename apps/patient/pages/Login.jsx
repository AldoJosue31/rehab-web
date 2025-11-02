// apps/patient/src/pages/Login.jsx
import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../src/firebaseClient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../src/contexts/AuthContext";

const provider = new GoogleAuthProvider();

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [disability, setDisability] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // New states for Google->signup flow
  const [googleSignup, setGoogleSignup] = useState(false); // true si venimos de Google y estamos completando formulario
  const [emailLocked, setEmailLocked] = useState(false);   // true => email está bloqueado y gris

  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const mapAuthError = (code) => {
    if (!code) return "Ocurrió un error.";
    const map = {
      "auth/email-already-in-use": "El correo ya está en uso.",
      "auth/invalid-email": "Correo inválido.",
      "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
      "auth/user-not-found": "Usuario no encontrado.",
      "auth/wrong-password": "Contraseña incorrecta.",
      "auth/popup-closed-by-user": "Cerraste la ventana antes de completar.",
      "auth/network-request-failed": "Problema de red. Revisa tu conexión.",
      "auth/cancelled-popup-request": "Petición de popup cancelada.",
      "auth/operation-not-allowed": "Operación no permitida en Auth.",
      "auth/account-exists-with-different-credential": "La cuenta ya existe con otro proveedor.",
      "auth/unauthorized-domain": "Dominio no autorizado para OAuth (revisa la consola de Firebase).",
    };
    return map[code] || "Error: " + code;
  };

  const validateSignupFields = () => {
    if (!displayName || displayName.trim().length < 2) {
      setError("Ingresa un nombre válido.");
      return false;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("Ingresa un número de celular válido (mínimo 7 dígitos).");
      return false;
    }
    const ageNum = parseInt(age, 10);
    if (Number.isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      setError("Ingresa una edad válida.");
      return false;
    }
    return true;
  };

  // Normaliza email: trim + lowercase. Usa la misma función en toda la app.
  function normalizeEmail(e) {
    if (!e) return "";
    return e.trim().toLowerCase();
  }

  /**
   * Transacción atómica: crea emails/{emailId} y users/{uid} (minimal).
   * Lanza "EMAIL_ALREADY_REGISTERED" si el email ya tenía mapping.
   *
   * Requisitos de reglas:
   * - cliente debe usar email_normalized = normalizeEmail(email)
   * - emails.create sólo permitido por request.auth.uid == uid
   * - users.create exige que get(emails/{email_normalized}).data.uid == userId
   */
  const createEmailMappingAndUser = useCallback(async (uid, emailRaw, userMinimalPayload, userExtraPayload = {}) => {
    const emailId = normalizeEmail(emailRaw);
    const emailRef = doc(db, "emails", emailId);
    const userRef = doc(db, "users", uid);

    await runTransaction(db, async (tx) => {
      const emailSnap = await tx.get(emailRef);
      if (emailSnap.exists()) {
        // otro uid ya registró este email
        throw new Error("EMAIL_ALREADY_REGISTERED");
      }

      // 1) crear mapping emails/{emailId} -> { uid }
      tx.set(emailRef, { uid }, { merge: false });

      // 2) crear users/{uid} con payload mínimo + email_normalized (para reglas)
      tx.set(userRef, {
        ...userMinimalPayload,
        email_normalized: emailId,
        ...userExtraPayload,
      }, { merge: false });
    });

    // refrescar profile local (AuthContext)
    try { await refreshProfile(uid); } catch (_) {}
  }, [refreshProfile]);

  // SAFE: si las reglas no permiten escribir campos extra, primero intentamos la transacción
  // y si falla por permisos distintos a EMAIL_ALREADY_REGISTERED, lo manejamos arriba.
  // -----------------------------------------------------------
  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Google completion flow
    if (googleSignup) {
      if (!validateSignupFields()) {
        setLoading(false);
        return;
      }
      try {
        const current = auth.currentUser;
        if (!current) {
          setError("No hay sesión de Google. Vuelve a intentar 'Continuar con Google'.");
          setLoading(false);
          return;
        }

        // minimal payload requerido por reglas
        const minimal = {
          id: current.uid,
          nombre_completo: displayName || "",
          email: email || "",
        };

        const extra = {
          telefono_celular: phone.replace(/\s+/g, "") || "",
          edad: age ? Number.parseInt(age, 10) : null,
          discapacidad: disability || "",
          // no incluimos rol/estado/created_at (admin/backend)
        };

        // forzar token para evitar race con rules
        try { await auth.currentUser.getIdToken(true); } catch (t) { console.warn("token refresh fallo:", t); }

        // intentar la transacción atómica (crea emails + users)
        try {
          await createEmailMappingAndUser(current.uid, minimal.email, minimal, extra);
          setGoogleSignup(false);
          setEmailLocked(false);
          navigate("/dashboard");
          return;
        } catch (txErr) {
          if (txErr?.message === "EMAIL_ALREADY_REGISTERED") {
            // email ya registrado: aconsejar linkear cuentas
            setError("Este correo ya está registrado. Si es tuyo, inicia sesión y vincula tu proveedor en configuración.");
            setLoading(false);
            return;
          }
          // otros errores: fallback a escribir sólo user (si reglas lo permitían)
          console.error("Transacción fallo (google flow):", txErr);
          setError("No se pudo completar el registro con Google. Revisa consola.");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("handleSignup (google flow) error:", err);
        setError("No se pudo completar el registro con Google. Revisa consola.");
        setLoading(false);
        return;
      }
    }

    // flujo normal email+password
    if (!validateSignupFields()) {
      setLoading(false);
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      try { await updateProfile(cred.user, { displayName }); } catch (uErr) { console.warn("No se pudo actualizar displayName en Auth:", uErr); }

      try { await sendEmailVerification(cred.user); } catch (verErr) { console.warn("Error enviando email de verificación:", verErr); }

      const minimal = {
        id: cred.user.uid,
        nombre_completo: displayName || "",
        email: cred.user.email,
      };
      const extra = {
        telefono_celular: phone.replace(/\s+/g, ""),
        edad: age ? Number.parseInt(age, 10) : null,
        discapacidad: disability || "",
      };

      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (tErr) { console.warn("No se pudo forzar idToken:", tErr); }

      // create mapping + user atomically
      try {
        await createEmailMappingAndUser(cred.user.uid, minimal.email, minimal, extra);
      } catch (txErr) {
        if (txErr?.message === "EMAIL_ALREADY_REGISTERED") {
          // Esto es raro en email flow (email fue creado en paralelo). Borrar auth user para evitar orphan?
          // No lo borramos automáticamente aquí (requiere reauth), pero informamos.
          console.warn("EMAIL_ALREADY_REGISTERED en signup normal:", txErr);
          setError("El correo ya está registrado. Intenta iniciar sesión o recupera tu contraseña.");
        } else {
          console.error("Transacción fallo en signup normal:", txErr);
          // fallback: intentar crear publicProfiles si tus reglas lo permiten
          try {
            const pubRef = doc(db, "publicProfiles", cred.user.uid);
            await setDoc(pubRef, {
              id: cred.user.uid,
              nombre_completo: displayName || "",
              email: cred.user.email,
              avatarUrl: "",
              created_at: serverTimestamp(),
            }, { merge: true });
          } catch (pubErr) {
            console.error("Fallback publicProfiles también falló:", pubErr);
            setError("Usuario creado en Auth, pero no pudimos crear perfil en DB. Revisa consola.");
          }
        }
      }

      alert("Cuenta creada. Revisa tu correo para verificar tu cuenta.");
      setMode("login");
      setEmail("");
      setPassword("");
      setDisplayName("");
      setPhone("");
      setAge("");
      setDisability("");
    } catch (err) {
      console.error("handleSignup error:", err);
      setError(mapAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        setError("Tu correo no está verificado. Revisa tu bandeja y spam.");
        navigate("/verify-email");
        try { await signOut(auth); } catch (_) {}
        setLoading(false);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("handleLogin error:", err);
      setError(mapAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  }

  // Google sign-in: abrir popup y redirigir al formulario de signup con datos rellenados
  async function handleGoogle() {
    setError("");
    setLoading(true);

    try {
      const res = await signInWithPopup(auth, provider);
      const u = res.user;

      // Forzar token por si hay race con reglas
      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (t) { console.warn("token refresh fallo:", t); }

      // Prefill form and lock email
      setMode("signup");
      setGoogleSignup(true);
      setEmail(u.email || "");
      setDisplayName(u.displayName || "");
      setEmailLocked(true);
      setLoading(false);
      return;
    } catch (err) {
      console.warn("signInWithPopup fallo:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana del proveedor antes de completar.");
        setLoading(false);
        return;
      }
      // fallback redirect flow
      try {
        await signInWithRedirect(auth, provider);
      } catch (rErr) {
        console.error("signInWithRedirect error:", rErr);
        setError(mapAuthError(rErr?.code));
        setLoading(false);
      }
    }
  }

  // Redirect result handler (similar behavior: prefill and lock email)
  useEffect(() => {
    let mounted = true;
    async function handleRedirectResult() {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const u = result.user;
          try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (_) {}
          if (!mounted) return;

          setMode("signup");
          setGoogleSignup(true);
          setEmail(u.email || "");
          setDisplayName(u.displayName || "");
          setEmailLocked(true);
          setLoading(false);
        }
      } catch (err) {
        // no es fatal si no hay resultado
        console.log("getRedirectResult:", err?.code || err?.message || err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    handleRedirectResult();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el usuario cambia manualmente a "login", limpiamos estados google
  useEffect(() => {
    if (mode === "login") {
      setGoogleSignup(false);
      setEmailLocked(false);
    }
  }, [mode]);

  // === UI ===
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start py-10 bg-pleasant">
      {/* Decorative SVG shapes (omitted for brevity) */}
      <div className="w-full flex justify-center px-4">
        <div className="max-w-4xl w-full bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-[rgba(234,164,138,0.5)] shadow-lg py-8 px-6 sm:px-12 md:px-20">
          <h1 className="text-3xl md:text-4xl font-light text-center text-[#2b2340]">mHealth</h1>
        </div>
      </div>

      <div className="w-full flex justify-center -mt-12 px-4">
        <div className="w-full max-w-md bg-[#FFF8F3]/95 rounded-2xl shadow-2xl border border-[#EAA48A]/40 p-6 sm:p-8 backdrop-blur-[2px]">
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
            {mode === "login" ? "Inicia sesión" : (googleSignup ? "Completa tu registro" : "Crea tu cuenta")}
          </h2>
          <p className="text-sm text-gray-500 mb-6">Es hora de comenzar a recuperar la movilidad</p>

          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <>
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

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Número de celular</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="55 5555 5555"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Edad</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ej. 45"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Discapacidad (si aplica)</label>
                  <input
                    className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                    value={disability}
                    onChange={(e) => setDisability(e.target.value)}
                    placeholder="Ej. movilidad reducida, visual, ninguna"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-gray-600 mb-2">Correo electrónico</label>
              <input
                type="email"
                className={`w-full rounded-full border-2 px-4 py-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20 ${emailLocked ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-white"}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                disabled={emailLocked}
                aria-disabled={emailLocked}
              />
              {emailLocked && <p className="text-xs text-gray-500 mt-1">Usando correo de Google (no editable).</p>}
            </div>

            {/* Password: hidden for googleSignup flow */}
            {!googleSignup && (
              <div className="relative">
                <label className="block text-sm text-gray-600 mb-2">Contraseña</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required={!googleSignup}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-9 text-gray-500"
                  aria-label="Mostrar contraseña"
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-full py-3 font-semibold shadow-md bg-[#3b2a4f] text-white disabled:opacity-60"
            >
              {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : (googleSignup ? "Completar registro" : "Crear cuenta")}
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
              <button
                onClick={handleGoogle}
                className="flex-1 rounded-full py-2 px-3 border border-[#EAA48A]/45 flex items-center justify-center gap-2 bg-white"
                type="button"
                disabled={loading || googleSignup /* desactivar si estamos en el formulario completando Google */}
              >
                <svg className="h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#000" strokeOpacity="0.08"/></svg>
                <span className="text-sm font-medium">Continuar con Google</span>
              </button>

              <button className="flex-1 rounded-full py-2 px-3 border border-[#EAA48A]/45 flex items-center justify-center gap-2 bg-white" type="button" disabled>
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
