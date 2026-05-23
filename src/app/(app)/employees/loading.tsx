import { Skeleton, SkeletonTableRow } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function EmployeesLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-32 rounded-[var(--radius-sm)]" />
      </div>

      <Skeleton className="h-9 w-64 rounded-[var(--radius-sm)]" />

      {/* Desktop table skeleton */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[200, 140, 120, 80, 100, 100].map((w, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton className="h-3" style={{ width: w }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonTableRow key={i} />)}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile card skeleton */}
      <div className="md:hidden grid gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
