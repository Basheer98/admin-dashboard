import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { AdditionalWorkForm } from "../components/AdditionalWorkForm";

export default function NewAdditionalWorkPage() {
  return (
    <SidebarLayout title="Add additional work" current="additional">
      <div className="flex flex-1 flex-col gap-6">
        <nav className="text-sm">
          <Link href="/additional-work" className="text-slate-700 hover:underline hover:text-slate-900">
            ← Back to additional work
          </Link>
        </nav>
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Add additional fielding or correction
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Track additional fielding jobs or corrections (for our projects or external). Enter the project number and use Look up to see who did the project so you can assign the correction to that fielder.
          </p>
          <AdditionalWorkForm
            mode="add"
            action="/api/additional-work"
            submitLabel="Save"
          />
        </section>
      </div>
    </SidebarLayout>
  );
}
