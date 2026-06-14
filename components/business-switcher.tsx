"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BusinessSummary } from "@/lib/queries/businesses";

export function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: BusinessSummary[];
  currentId: string;
}) {
  const router = useRouter();

  if (businesses.length <= 1) {
    const b = businesses[0];
    return (
      <div className="text-lg font-semibold tracking-tight">
        {b ? b.name : "Dashboard"}
      </div>
    );
  }

  return (
    <Select
      value={currentId}
      onValueChange={(id) => router.push(`/dashboard?b=${id}`)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select business" />
      </SelectTrigger>
      <SelectContent>
        {businesses.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
