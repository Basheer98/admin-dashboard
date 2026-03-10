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
        className="w-full h-11 rounded-md border border-zinc-600 px-3 text-base leading-tight text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
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
          className="mt-2 w-full rounded-md border border-zinc-600 px-3 py-2.5 text-base text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-900"
        />
      )}
      <p className="mt-1 text-sm text-zinc-500">
        Pick an existing client or choose &quot;New client&quot; to enter a new one.
      </p>
    </>
  );
}
