import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/app/components/SidebarLayout";
import { getAllProjects, getTripById } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function EditTripPage({ params, searchParams }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const error = sp.error === "invalid";

  const [trip, projects] = await Promise.all([
    getTripById(id),
    getAllProjects({ includeArchived: true }),
  ]);
  if (!trip) notFound();

  return (
    <SidebarLayout
      title="Edit trip"
      subtitle={trip.name}
      current="trips"
      backLink={{ href: `/trips/${trip.id}`, label: "Trip details" }}
    >
      <div className="flex flex-1 flex-col gap-6">
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Trip updated successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Please check the trip values and try again.
          </div>
        )}

        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Trip details</h2>
            <Link href={`/trips/${trip.id}`} className="text-sm text-slate-700 underline hover:text-slate-900">
              View trip
            </Link>
          </div>
          <form method="POST" action={`/api/trips/${trip.id}`} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="label">Trip name</label>
              <input name="name" defaultValue={trip.name} required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">State</label>
              <input name="state" defaultValue={trip.state} required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">City (optional)</label>
              <input name="city" defaultValue={trip.city ?? ""} className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Team members</label>
              <input name="teamMembers" defaultValue={trip.teamMembers ?? ""} className="input h-11" />
            </div>

            <div className="space-y-1">
              <label className="label">Budget - Car</label>
              <input name="budgetCar" type="number" min="0" step="0.01" defaultValue={trip.budgetCar ?? ""} className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Accommodation</label>
              <input name="budgetAccommodation" type="number" min="0" step="0.01" defaultValue={trip.budgetAccommodation ?? ""} className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Gas</label>
              <input name="budgetGas" type="number" min="0" step="0.01" defaultValue={trip.budgetGas ?? ""} className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">Budget - Tools</label>
              <input name="budgetTools" type="number" min="0" step="0.01" defaultValue={trip.budgetTools ?? ""} className="input h-11" />
            </div>

            <div className="space-y-1">
              <label className="label">Project (optional)</label>
              <select name="projectId" defaultValue={trip.projectId ?? ""} className="select h-11">
                <option value="">Not linked</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} - {p.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Status</label>
              <select name="status" defaultValue={trip.status} className="select h-11">
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Start date</label>
              <input name="startDate" type="date" defaultValue={trip.startDate} required className="input h-11" />
            </div>
            <div className="space-y-1">
              <label className="label">End date (optional)</label>
              <input name="endDate" type="date" defaultValue={trip.endDate ?? ""} className="input h-11" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={3} defaultValue={trip.notes ?? ""} className="input py-2.5" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary px-5 py-2.5">
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </SidebarLayout>
  );
}
