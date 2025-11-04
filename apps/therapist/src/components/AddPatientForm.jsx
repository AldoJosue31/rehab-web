import React, { useState } from "react";

/**
 * Form para añadir paciente.
 * Props:
 *  - onSubmit(form) => async
 *  - onCancel()
 *  - busy, error
 */
export default function AddPatientForm({ onSubmit = () => {}, onCancel = () => {}, busy = false, error = "" }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tutor, setTutor] = useState("");
  const [nivel, setNivel] = useState("Moderado");

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ nombre, telefono, tutor, nivel });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-600">Nombre completo</label>
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Ej. Juan Pérez" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Teléfono de emergencia</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="55 5555 5555" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Nombre del tutor</label>
            <input value={tutor} onChange={(e) => setTutor(e.target.value)} className="w-full border rounded px-4 py-2" placeholder="Nombre del encargado" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Nivel de movilidad</label>
          <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="w-full border rounded px-4 py-2">
            <option>Alto</option>
            <option>Moderado</option>
            <option>Bajo</option>
            <option>Sin movilidad</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded">{busy ? "Guardando..." : "Guardar paciente"}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">Cancelar</button>
        </div>

        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}
