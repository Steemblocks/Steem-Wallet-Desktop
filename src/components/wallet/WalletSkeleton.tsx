
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const WalletSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header Skeleton */}
      <div className="bg-slate-900 shadow-sm border-b border-slate-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg bg-slate-800" />
              <div>
                <Skeleton className="h-8 w-48 mb-2 bg-slate-800" />
                <Skeleton className="h-4 w-32 bg-slate-800" />
              </div>
            </div>
            <Skeleton className="h-10 w-24 rounded-md bg-slate-800" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="container mx-auto px-4 pt-5 pb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-6">
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 flex-1 rounded-md bg-slate-700" />
            ))}
          </div>
        </div>

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-32 mb-2 bg-slate-700" />
                <Skeleton className="h-4 w-full bg-slate-700" />
                <Skeleton className="h-4 w-3/4 bg-slate-700" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-40 bg-slate-700" />
                <Skeleton className="h-4 w-28 bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletSkeleton;
