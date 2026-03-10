import { SidebarLayout } from "@/app/components/SidebarLayout";
import Link from "next/link";
import { AdditionalWorkForm } from "../components/AdditionalWorkForm";

export default function NewAdditionalWorkPage() {
  return (
    <SidebarLayout title="Add additional work" current="additional">
      <div className="flex flex-1 flex-col gap-6">
        <nav className="text-sm">
          <Link href="/additional-work" className="text-zinc-300 hover:underline hover:text-zinc-100">
            ← Back to additional work
          </Link>
        </nav>
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-100">
            Add additional fielding or correction
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
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
