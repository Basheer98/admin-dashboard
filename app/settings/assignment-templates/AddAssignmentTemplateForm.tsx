"use client";

import { useState } from "react";

type Item = {
  fielderName: string;
  ratePerSqft: string;
  commissionPercentage: string;
  isInternal: boolean;
  managerFielderName: string;
  managerRatePerSqft: string;
  managerCommissionShare: string;
};

type AddAssignmentTemplateFormProps = {
  uniqueFielderNames: string[];
};

export function AddAssignmentTemplateForm({
  uniqueFielderNames,
}: AddAssignmentTemplateFormProps) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([
    {
      fielderName: "",
      ratePerSqft: "",
      commissionPercentage: "",
      isInternal: false,
      managerFielderName: "",
      managerRatePerSqft: "",
      managerCommissionShare: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fielderName: "",
        ratePerSqft: "",
        commissionPercentage: "",
        isInternal: false,
        managerFielderName: "",
        managerRatePerSqft: "",
        managerCommissionShare: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        items: items
          .map((it) => ({
            ...it,
            ratePerSqft: it.ratePerSqft ? Number(it.ratePerSqft) : 0,
            commissionPercentage: it.commissionPercentage
              ? Number(it.commissionPercentage) / 100
              : null,
            managerRatePerSqft: it.managerRatePerSqft
              ? Number(it.managerRatePerSqft)
              : null,
            managerCommissionShare: it.managerCommissionShare
              ? Number(it.managerCommissionShare) / 100
              : null,
          }))
          .filter((it) => it.fielderName && it.ratePerSqft > 0),
      };
      const res = await fetch("/api/assignment-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to create template");
      } else {
        // Reload page to show new template
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="label">Template name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard NIVAS team"
          className="input"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2">Fielder</th>
              <th className="px-3 py-2">Rate / SQFT</th>
              <th className="px-3 py-2">Commission %</th>
              <th className="px-3 py-2">Internal</th>
              <th className="px-3 py-2">Manager name</th>
              <th className="px-3 py-2">Manager rate / SQFT</th>
              <th className="px-3 py-2">Manager share %</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2">
                  <input
                    list="fielder-names"
                    value={row.fielderName}
                    onChange={(e) =>
                      updateRow(idx, { fielderName: e.target.value })
                    }
                    required
                    className="input h-9 w-40"
                    placeholder="Fielder"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={row.ratePerSqft}
                    onChange={(e) =>
                      updateRow(idx, { ratePerSqft: e.target.value })
                    }
                    required={!row.isInternal}
                    className="input h-9 w-28"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.commissionPercentage}
                    onChange={(e) =>
                      updateRow(idx, { commissionPercentage: e.target.value })
                    }
                    disabled={row.isInternal || !!row.managerFielderName}
                    className="input h-9 w-24"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={row.isInternal}
                    onChange={(e) =>
                      updateRow(idx, {
                        isInternal: e.target.checked,
                        managerFielderName: e.target.checked
                          ? ""
                          : row.managerFielderName,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    list="fielder-names"
                    value={row.managerFielderName}
                    onChange={(e) =>
                      updateRow(idx, { managerFielderName: e.target.value })
                    }
                    disabled={row.isInternal}
                    className="input h-9 w-40"
                    placeholder="Optional"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={row.managerRatePerSqft}
                    onChange={(e) =>
                      updateRow(idx, { managerRatePerSqft: e.target.value })
                    }
                    disabled={!row.managerFielderName || row.isInternal}
                    className="input h-9 w-28"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={row.managerCommissionShare}
                    onChange={(e) =>
                      updateRow(idx, { managerCommissionShare: e.target.value })
                    }
                    disabled={!row.managerFielderName || row.isInternal}
                    className="input h-9 w-24"
                    placeholder="e.g. 50"
                  />
                </td>
                <td className="px-3 py-2">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="fielder-names">
        {uniqueFielderNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="btn-secondary px-4 py-2 text-sm"
        >
          Add row
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          {submitting ? "Saving..." : "Save template"}
        </button>
      </div>
    </form>
  );
}

