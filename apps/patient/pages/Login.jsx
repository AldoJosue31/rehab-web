// apps/patient/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  // Si este estado no es null significa "flow iniciado desde Google"
  // contiene data mínima obtenida del proveedor y uid (user ya autenticado en Auth)
  const [socialPending, setSocialPending] = useState(null);

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
    };
    return map[code] || "Error: " + code;
  };

  const validateSignupFields = () => {
    if (!displayName || displayName.trim().length < 2) {
      setError("Ingresa un nombre válido.");
      return false;
    }
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 7) {
      setError("Ingresa un número de celular válido (mínimo 7 dígitos) o déjalo vacío.");
      return false;
    }
    if (age) {
      const ageNum = parseInt(age, 10);
      if (Number.isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
        setError("Ingresa una edad válida.");
        return false;
      }
    }
    return true;
  };

  // safeWriteUserDoc: primero intenta escribir campos mínimos (create),
  // luego intenta mergear campos "admin" (rol/estado/created_at). Si falla creación
  // lanza para que el caller haga fallback.
  async function safeWriteUserDoc(uid, minimalFields = {}, extraFields = {}) {
    const userRef = doc(db, "users", uid);

    // 1) write minimal fields (should be allowed by create rule)
    try {
      await setDoc(userRef, minimalFields, { merge: true });
      try { await refreshProfile(uid); } catch (_) {}
    } catch (err) {
      throw { stage: "create", error: err };
    }

    // 2) try to add admin-ish fields (merge). Si falla por reglas, no bloquea.
    if (Object.keys(extraFields).length) {
      try {
        await setDoc(userRef, extraFields, { merge: true });
        try { await refreshProfile(uid); } catch (_) {}
      } catch (err) {
        console.warn("safeWriteUserDoc: no se pudo escribir campos extra (probablemente reglas):", err);
      }
    }
  }

  // SIGNUP (manual or from social)
  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!validateSignupFields()) {
      setLoading(false);
      return;
    }

    // Si socialPending != null -> ya estamos autenticados en Auth con Google.
    // Solo escribimos el documento users/{uid} y navegamos.
    if (socialPending) {
      try {
        // Nos aseguramos de que auth.currentUser coincida con socialPending.uid
        const current = auth.currentUser;
        if (!current || current.uid !== socialPending.uid) {
          // raro, forzamos signIn con redirect fallback? Aquí informamos al usuario
          setError("Error: no estamos logueados con la cuenta social esperada. Vuelve a intentarlo.");
          setLoading(false);
          return;
        }

        // Forzar refresh token (reduce chances de race con rules)
        try { await current.getIdToken(true); } catch (tErr) { console.warn("token refresh fallo:", tErr); }

        const minimal = {
          id: current.uid,
          nombre_completo: displayName || current.displayName || "",
          email: email || current.email || "",
        };

        const extra = {
          telefono_celular: (phone || "").replace(/\s+/g, "") || "",
          edad: age ? Number.parseInt(age, 10) : null,
          discapacidad: disability || "",
          rol: "Paciente",
          estado: "Activo",
          created_at: serverTimestamp(),
        };

        try {
          await safeWriteUserDoc(current.uid, minimal, extra);
        } catch (writeErr) {
          console.warn("safeWriteUserDoc fallo (social flow):", writeErr);
          // fallback: intentar publicProfiles
          try {
            const pubRef = doc(db, "publicProfiles", current.uid);
            await setDoc(pubRef, {
              id: current.uid,
              nombre_completo: minimal.nombre_completo,
              email: minimal.email,
              avatarUrl: socialPending.photoURL || "",
              created_at: serverTimestamp(),
            }, { merge: true });
            try { await refreshProfile(current.uid); } catch (_) {}
          } catch (pubErr) {
            console.error("Fallback publicProfiles también falló:", pubErr);
            setError("Tu cuenta existe en Auth pero no pudimos guardar el perfil en la DB. Revisa consola/reglas.");
            // seguimos adelante (usuario existe en Auth) para no romper UX
          }
        }

        // limpiar estado socialPending y navegar
        setSocialPending(null);
        navigate("/dashboard");
        return;
      } catch (err) {
        console.error("handleSignup (social) error:", err);
        setError("Error guardando perfil social. Revisa consola.");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    // flujo normal: crear cuenta con email+password
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // actualizar displayName en Auth (no crítico)
      try {
        await updateProfile(cred.user, { displayName: displayName });
      } catch (uErr) {
        console.warn("No se pudo actualizar displayName en Auth:", uErr);
      }

      try {
        await sendEmailVerification(cred.user);
      } catch (verErr) {
        console.warn("Error enviando email de verificación:", verErr);
      }

      const minimal = {
        id: cred.user.uid,
        nombre_completo: displayName || "",
        email: cred.user.email,
      };
      const extra = {
        telefono_celular: (phone || "").replace(/\s+/g, ""),
        edad: age ? Number.parseInt(age, 10) : null,
        discapacidad: disability || "",
        rol: "Paciente",
        estado: "Activo",
        created_at: serverTimestamp(),
      };

      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (_) {}

      try {
        await safeWriteUserDoc(cred.user.uid, minimal, extra);
      } catch (writeErr) {
        console.warn("safeWriteUserDoc fallo en signup normal:", writeErr);
        // fallback: publicProfiles
        try {
          const pubRef = doc(db, "publicProfiles", cred.user.uid);
          await setDoc(pubRef, {
            id: cred.user.uid,
            nombre_completo: minimal.nombre_completo,
            email: minimal.email,
            avatarUrl: "",
            created_at: serverTimestamp(),
          }, { merge: true });
        } catch (pubErr) {
          console.error("Fallback publicProfiles también falló:", pubErr);
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

  // --- SOCIAL: Google flow ---
  // Al iniciar con Google vamos a:
  //  - signInWithPopup -> si OK: no escribimos users todavía, guardamos socialPending con los datos
  //  - seteamos el formulario en mode="signup" y rellenamos campos (editables)
  //  - deshabilitamos botones sociales (mientras socialPending != null)
  async function handleGoogle() {
    setError("");
    setLoading(true);

    try {
      const res = await signInWithPopup(auth, provider);
      const u = res.user;
      // refrescar token reduce chances de race con reglas
      try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (t) { /* no crítico */ }

      // Colocamos los datos que sí provee Google (nota: Google no da birthdate por defecto)
      const pending = {
        uid: u.uid,
        displayName: u.displayName || "",
        email: u.email || "",
        phoneNumber: u.phoneNumber || "",
        photoURL: u.photoURL || "",
        providerId: (u.providerData && u.providerData[0] && u.providerData[0].providerId) || "google.com",
      };

      // rellenamos el formulario y forzamos modo signup para que el usuario complete
      setDisplayName(pending.displayName);
      setEmail(pending.email);
      setPhone(pending.phoneNumber || "");
      // age/disability probablemente no disponibles desde Google -> dejar vacíos
      setAge("");
      setDisability("");
      setMode("signup");

      // guardamos estado socialPending para indicar que el form viene desde Google
      setSocialPending(pending);

      // no navegamos a dashboard directamente: queremos que el usuario revise/complete y haga "Crear cuenta"
      setLoading(false);
      return;
    } catch (err) {
      console.warn("signInWithPopup fallo:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana del proveedor antes de completar.");
        setLoading(false);
        return;
      }
      // si popup falla, fallback a redirect
      try {
        await signInWithRedirect(auth, provider);
      } catch (rErr) {
        console.error("signInWithRedirect error:", rErr);
        setError(mapAuthError(rErr?.code));
        setLoading(false);
      }
    }
  }

  // handle redirect result (cuando viene del flujo redirect)
  useEffect(() => {
    let mounted = true;
    async function handleRedirectResult() {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const u = result.user;
          try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (_) {}

          const pending = {
            uid: u.uid,
            displayName: u.displayName || "",
            email: u.email || "",
            phoneNumber: u.phoneNumber || "",
            photoURL: u.photoURL || "",
            providerId: (u.providerData && u.providerData[0] && u.providerData[0].providerId) || "google.com",
          };

          setDisplayName(pending.displayName);
          setEmail(pending.email);
          setPhone(pending.phoneNumber || "");
          setAge("");
          setDisability("");
          setMode("signup");
          setSocialPending(pending);
        }
      } catch (err) {
        console.log("getRedirectResult:", err?.code || err?.message || err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    handleRedirectResult();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI: deshabilitar botones sociales cuando socialPending está activo
  const socialButtonsDisabled = loading || Boolean(socialPending);

  // === UI (tu markup original, con pequeñas adaptaciones) ===
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start py-10 bg-pleasant">
      {/* Decorative SVG shapes */}
      <div className="bg-decor-svg -z-10" aria-hidden>
        <svg className="absolute left-0 top-0 svgFloat" style={{ width: 420, height: 420, transform: "translate(-30%, -10%)" }} viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="70" r="90" fill="#EAA48A" />
          <circle cx="320" cy="140" r="120" fill="#3b2a4f" />
        </svg>
        <svg className="absolute right-0 bottom-0 svgFloat" style={{ width: 560, height: 560, transform: "translate(10%, 20%)", animationDelay: "1.5s" }} viewBox="0 0 560 560" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="280" cy="280" rx="200" ry="120" fill="#A6D7FF" />
        </svg>
      </div>

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
              onClick={() => { setMode("signup"); setSocialPending(null); }}
              type="button"
              disabled={loading}
            >
              Crear cuenta
            </button>
            <button
              className={`text-sm font-medium pb-2 ${mode === "login" ? "border-b-2 border-[#3b2a4f] text-[#3b2a4f]" : "text-gray-400"}`}
              onClick={() => { setMode("login"); setSocialPending(null); }}
              type="button"
              disabled={loading}
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
                className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                // si viene de social, permitimos editar el correo (según pediste)
              />
            </div>

            {/* contraseña solo visible en flow manual */}
            {mode === "login" || !socialPending ? (
              <div className="relative">
                <label className="block text-sm text-gray-600 mb-2">Contraseña</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-full border-2 border-[#EAA48A]/45 px-4 py-3 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2a4f]/20 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required={mode !== "signup" || !socialPending}
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
            ) : null}

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
                <button onClick={() => { setMode("signup"); setSocialPending(null); }} className="text-[#3b2a4f] font-medium" type="button">
                  Crear una
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button onClick={() => { setMode("login"); setSocialPending(null); }} className="text-[#3b2a4f] font-medium" type="button">
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
                disabled={socialButtonsDisabled}
                aria-disabled={socialButtonsDisabled}
                title={socialButtonsDisabled ? "Completá el formulario antes de usar otro proveedor" : "Continuar con Google"}
              >
                <svg className="h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#000" strokeOpacity="0.08"/></svg>
                <span className="text-sm font-medium">Continuar con Google</span>
              </button>

              <button
                className="flex-1 rounded-full py-2 px-3 border border-[#EAA48A]/45 flex items-center justify-center gap-2 bg-white"
                type="button"
                disabled
              >
                {/* Placeholder Apple button (sin implementar) */}
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
