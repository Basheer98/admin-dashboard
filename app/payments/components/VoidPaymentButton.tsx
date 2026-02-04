"use client";

export function VoidPaymentButton({ paymentId }: { paymentId: number }) {
  return (
    <form method="POST" action={`/api/payments/${paymentId}/void`} className="inline">
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Void this payment? It will be hidden from totals but kept in the activity log.")) {
            e.preventDefault();
          }
        }}
        className="text-sm text-amber-700 underline hover:text-amber-800"
      >
        Void
      </button>
    </form>
  );
}
