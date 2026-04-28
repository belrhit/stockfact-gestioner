import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-card shadow-lg px-4 py-2 animate-in fade-in slide-in-from-bottom-4">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium pr-2 border-r">
        {count} sélectionné{count > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}
