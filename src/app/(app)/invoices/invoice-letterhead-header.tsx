import type { InvoiceLetterheadRow } from "@/lib/supabase/types";

export function InvoiceLetterheadHeader({
  letterhead,
}: {
  letterhead: InvoiceLetterheadRow | null;
}) {
  if (!letterhead) return null;

  return (
    <div className="flex items-center gap-4 border-b pb-4">
      {letterhead.logo_data_url && (
        // eslint-disable-next-line @next/next/no-img-element -- inline data URL, next/image can't optimize it
        <img
          src={letterhead.logo_data_url}
          alt={`${letterhead.business_name} logo`}
          className="h-14 w-14 shrink-0 rounded-md border object-contain"
        />
      )}
      <div>
        <p className="font-semibold">{letterhead.business_name}</p>
        {letterhead.address && (
          <p className="text-muted-foreground text-sm">{letterhead.address}</p>
        )}
      </div>
    </div>
  );
}
