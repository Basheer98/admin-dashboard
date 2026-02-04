"use client";

import { useState } from "react";

type ClientNameFieldProps = {
  uniqueClientNames: string[];
  defaultValue: string;
};

export function ClientNameField({
  uniqueClientNames,
  defaultValue,
}: ClientNameFieldProps) {
  const isExisting = defaultValue && uniqueClientNames.includes(defaultValue);
  const [clientChoice, setClientChoice] = useState<string>(() =>
    isExisting ? defaultValue : ""
  );
  const [newClientName, setNewClientName] = useState<string>(() =>
    !isExisting && defaultValue ? defaultValue : ""
  );

  return (
    <>
      <select
        name="clientChoice"
        value={clientChoice}
        onChange={(e) => setClientChoice(e.target.value)}
        className="w-full h-11 rounded-md border border-slate-300 px-3 text-base leading-tight text-black focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
      >
        <option value="">New client</option>
        {uniqueClientNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {clientChoice === "" && (
        <input
          name="newClientName"
          type="text"
          required
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          placeholder="Enter new client name"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-black placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      )}
      <p className="mt-1 text-sm text-slate-500">
        Pick an existing client or choose &quot;New client&quot; to enter a new one.
      </p>
    </>
  );
}
