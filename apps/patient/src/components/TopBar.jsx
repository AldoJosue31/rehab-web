// apps/patient/src/components/TopBar.jsx
import React from "react";

export default function TopBar({ user }) {
  return (
    <header className="bg-[#0a0a0a] text-white py-3 px-4 flex items-center justify-between">
      <div className="text-center w-full">
        <h2 className="font-semibold text-lg md:text-xl">Buenos días</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-sm">{user?.email}</div>
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
          {/* Si tienes avatar en DB, úsalo: user.avatarUrl */}
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-[#3b2a4f]">E</div>
          )}
        </div>
      </div>
    </header>
  );
}
