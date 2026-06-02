"use client";

export type ClientOption = {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
};

type Props = {
  clients: ClientOption[];
  clientId: string;
  onClientIdChange: (id: string) => void;
  onClientSelected: (client: ClientOption | null) => void;
  allowManual?: boolean;
};

export function ClientSelectField({
  clients,
  clientId,
  onClientIdChange,
  onClientSelected,
  allowManual = true,
}: Props) {
  return (
    <div className="space-y-1">
      <label className="label">Client</label>
      <select
        className="select h-11 w-full"
        value={clientId}
        onChange={(e) => {
          const id = e.target.value;
          onClientIdChange(id);
          if (!id) {
            onClientSelected(null);
            return;
          }
          const client = clients.find((c) => String(c.id) === id) ?? null;
          onClientSelected(client);
        }}
      >
        <option value="">{allowManual ? "— Type name below or select —" : "— Select client —"}</option>
        {clients.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500">
        <a href="/clients" className="text-emerald-400 hover:underline">
          Manage clients
        </a>
        {" "}
        (names and addresses)
      </p>
    </div>
  );
}
