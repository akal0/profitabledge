"use client";

import { Badge } from "@/components/ui/badge";
import { trpcOptions } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null) return "N/A";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount / 100);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatInvoiceReference(orderId: string) {
  if (orderId.length <= 12) return orderId;
  return `${orderId.slice(0, 8)}...${orderId.slice(-4)}`;
}

function getStatusBadgeClassName(status: string, paid: boolean) {
  if (paid || status === "paid") {
    return "ring ring-emerald-500/20 bg-emerald-500/12 text-emerald-200";
  }

  if (status === "refunded" || status === "canceled") {
    return "ring ring-rose-500/20 bg-rose-500/12 text-rose-200";
  }

  if (status === "pending") {
    return "ring ring-amber-500/20 bg-amber-500/12 text-amber-200";
  }

  return "ring ring-white/10 bg-white/5 text-white/65";
}

export function InvoiceHistoryTable() {
  const invoiceHistoryQuery = useQuery(
    trpcOptions.billing.getInvoiceHistory.queryOptions()
  );

  const rows = invoiceHistoryQuery.data ?? [];

  return (
    <div className="px-6 py-5 sm:px-8">
      <div className="mb-4">
        <p className="text-sm font-medium tracking-[-0.04em] text-white/35">
          Invoice history
        </p>
        <p className="mt-1 text-xs text-white/35">
          Recent Polar orders mirrored to your account history
        </p>
      </div>

      <div className="rounded-sm ring ring-white/5 bg-sidebar p-1.5">
        <div className="overflow-hidden rounded-sm bg-sidebar-accent">
          {invoiceHistoryQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-sm bg-sidebar ring ring-white/5"
                />
              ))}
            </div>
          ) : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs text-white/75">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                    <th className="px-4 py-3 font-medium">Tax</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 align-top text-white/65">
                        {formatDate(invoice.paidAt ?? invoice.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <p
                            className="font-medium text-white"
                            title={invoice.polarOrderId}
                          >
                            {formatInvoiceReference(invoice.polarOrderId)}
                          </p>
                          <p className="text-[11px] text-white/30">
                            {invoice.polarOrderId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-white">
                          {invoice.planTitle}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            getStatusBadgeClassName(invoice.status, invoice.paid)
                          )}
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-white/65">
                        {formatCurrency(
                          invoice.subtotalAmount,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-white/65">
                        {formatCurrency(invoice.taxAmount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-medium text-white">
                        {formatCurrency(invoice.totalAmount, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                No invoices recorded yet. Paid checkout history will appear here
                after your first Polar order sync
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
