// apps/patient/src/pages/Profile.jsx
import React from "react";
import { useAuth } from "../src/contexts/AuthContext";
import GenerateLinkCode from "../src/components/GenerateLinkCode"; // ruta relativa desde pages
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* BACK header black */}
      <div className="pb-8">
        <div className="max-w-6xl mx-auto pt-6 px-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="text-white/90 p-2 rounded-full hover:bg-white/5"
              aria-label="volver"
            >
              {/* left arrow */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="w-10 h-10" /> {/* placeholder right */}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="rounded-xl overflow-hidden">
            <div className="bg-black text-white py-8 px-6 rounded-t-xl flex flex-col items-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-white overflow-hidden flex items-center justify-center">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-medium text-[#3b2a4f]">{(profile?.nombre_completo?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase()}</span>
                  )}
                </div>
                {/* small badge icon */}
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow">
                  <svg className="w-5 h-5 text-[#3b2a4f]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <h2 className="mt-4 text-2xl font-semibold">{profile?.nombre_completo || user?.displayName || "Sin nombre"}</h2>
              <div className="text-sm text-gray-300 mt-1">{profile?.email || user?.email}</div>

              <div className="mt-6 flex gap-8 items-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">123</div>
                  <div className="text-xs text-gray-400 mt-2">Numero de folio</div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">?</div>
                  <div className="text-xs text-gray-400 mt-2">Reportar</div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">📋</div>
                  <div className="text-xs text-gray-400 mt-2">Historial clínico</div>
                </div>
              </div>
            </div>

            {/* white panel with settings and code */}
            <div className="bg-[#FFF8F3] px-6 py-6 rounded-b-xl shadow-sm border-t border-[#EAA48A]/10">
              <div className="max-w-4xl mx-auto">
                {/* Generate link code (component) */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#3b2a4f]">Código de vinculación</h3>
                  <p className="text-sm text-gray-600 mt-1">Comparte este código con tu terapeuta para que te vincule.</p>
                  <div className="mt-4">
                    <GenerateLinkCode />
                  </div>
                </div>

                {/* Settings list */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                  <h4 className="text-xl font-semibold mb-3">Settings</h4>

                  <ul className="space-y-3">
                    <li className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#EAA48A]/20 flex items-center justify-center">📞</div>
                        <div>
                          <div className="text-sm font-medium">Numero de celular</div>
                          <div className="text-xs text-gray-500">{profile?.telefono_celular || "añadir numero"}</div>
                        </div>
                      </div>
                      <div className="text-sm text-indigo-700 cursor-pointer">editar</div>
                    </li>

                    <li className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#EAA48A]/20 flex items-center justify-center">🌐</div>
                        <div>
                          <div className="text-sm font-medium">Edad</div>
                          <div className="text-xs text-gray-500">{profile?.edad ?? "Edad"}</div>
                        </div>
                      </div>
                      <div className="text-sm text-indigo-700 cursor-pointer">editar</div>
                    </li>

                    <li className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#EAA48A]/20 flex items-center justify-center">♿</div>
                        <div>
                          <div className="text-sm font-medium">Discapacidades</div>
                          <div className="text-xs text-gray-500">{profile?.discapacidad || "No especificado"}</div>
                        </div>
                      </div>
                      <div className="text-sm text-indigo-700 cursor-pointer">editar</div>
                    </li>

                    <li className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#EAA48A]/20 flex items-center justify-center">🔔</div>
                        <div>
                          <div className="text-sm font-medium">Notification Settings</div>
                          <div className="text-xs text-gray-500">Configura push y recordatorios</div>
                        </div>
                      </div>
                      <div className="text-sm text-indigo-700 cursor-pointer">›</div>
                    </li>

                    <li className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#EAA48A]/20 flex items-center justify-center">🚪</div>
                        <div>
                          <div className="text-sm font-medium">Salir de la cuenta</div>
                          <div className="text-xs text-gray-500">Cerrar sesión</div>
                        </div>
                      </div>
                      <button onClick={logout} className="text-sm text-rose-600">Eliminar Cuenta</button>
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
