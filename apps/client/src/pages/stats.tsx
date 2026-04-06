import * as React from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetResumeStats, getGetResumeStatsQueryKey } from "@workspace/api-client-react";
import { FileText, Target, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";

export default function Stats() {
  const { data: stats, isLoading } = useGetResumeStats({
    query: { queryKey: getGetResumeStatsQueryKey() },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-xl mt-8" />
        </div>
      </Layout>
    );
  }

  if (!stats) return null;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of your resume matching performance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalAnalyses}</div>
              <p className="text-xs text-muted-foreground mt-1">All time records</p>
            </CardContent>
          </Card>
          
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Target className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(stats.averageScore)}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all jobs</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.highestScore}</div>
              <p className="text-xs text-muted-foreground mt-1">Best match</p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Lowest Score</CardTitle>
              <ArrowDownRight className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.lowestScore}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs improvement</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm col-span-full">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest resume analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentAnalyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <div className="space-y-0">
                {stats.recentAnalyses.map((analysis, i) => (
                  <div 
                    key={analysis.id} 
                    className={`flex items-center justify-between py-4 ${i !== stats.recentAnalyses.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="flex flex-col">
                      <Link href={`/results/${analysis.id}`} className="font-medium hover:text-primary hover:underline">
                        {analysis.jobTitle || "Untitled Role"}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {analysis.companyName ? `${analysis.companyName} • ` : ''}
                        {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block text-sm text-muted-foreground max-w-xs truncate">
                        {analysis.summary}
                      </div>
                      <div className={`font-bold px-2 py-1 rounded-md text-sm ${
                        analysis.overallScore >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        analysis.overallScore >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {analysis.overallScore}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
