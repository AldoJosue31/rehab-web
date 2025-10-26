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

/* Inline CSS simple */
const styles = {
  container: {
    fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
    maxWidth: 420,
    margin: "48px auto",
    padding: 20,
    borderRadius: 8,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    background: "#fff"
  },
  title: { marginBottom: 12, fontSize: 20, textAlign: "center" },
  label: { display: "block", fontSize: 13, marginTop: 8, marginBottom: 6 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" },
  btn: {
    width: "100%",
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 600
  },
  alt: { marginTop: 10, textAlign: "center", fontSize: 13 },
  linkBtn: { background: "transparent", border: "none", color: "#2563eb", cursor: "pointer" },
  smallNote: { fontSize: 12, color: "#666", marginTop: 6 }
};

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
      // create user doc in Firestore if not exists
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
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Simple post-login redirect (a Dashboard placeholder)
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={styles.container}>
        <h3 style={styles.title}>{mode === "login" ? "Paciente — Iniciar sesión" : "Paciente — Crear cuenta"}</h3>

        <form onSubmit={mode === "login" ? handleLogin : handleSignup}>
          {mode === "signup" && (
            <>
              <label style={styles.label}>Nombre completo</label>
              <input
                style={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Juan Pérez"
                required
              />
            </>
          )}

          <label style={styles.label}>Correo electrónico</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            required
          />

          <label style={styles.label}>Contraseña</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

        <div style={styles.alt}>
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button style={styles.linkBtn} onClick={() => setMode("signup")}>Crear una</button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button style={styles.linkBtn} onClick={() => setMode("login")}>Inicia sesión</button>
            </>
          )}
        </div>

        <div style={styles.smallNote}>
          Consejo: si estás en modo demo usa un correo real creado desde Firebase Console para probar.
        </div>
      </div>
    </div>
  );
}
