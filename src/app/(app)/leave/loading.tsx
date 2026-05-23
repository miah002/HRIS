import { Skeleton, SkeletonTableRow } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LeaveLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--border)]">
              {[160, 100, 80, 80, 60].map((w, i) => (
                <th key={i} className="px-4 py-3 text-left"><Skeleton className="h-3" style={{ width: w }} /></th>
              ))}
            </tr></thead>
            <tbody>{[1, 2, 3, 4, 5].map((i) => <SkeletonTableRow key={i} />)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
