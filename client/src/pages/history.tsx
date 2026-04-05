import * as React from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useListAnalyses, getListAnalysesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Building2, Calendar, FileText } from "lucide-react";

export default function History() {
  const { data: analyses, isLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400";
    return "text-destructive bg-destructive/10";
  };

  return (
    <Layout>
      <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">History</h1>
          <p className="text-muted-foreground mt-2">
            View your past resume analyses and track your progress.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
            ))}
          </div>
        ) : !analyses || analyses.length === 0 ? (
          <Card className="border-dashed bg-secondary/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium">No analyses yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mb-6">
                Run your first resume analysis to see it appear here.
              </p>
              <Link href="/" className="text-sm font-medium text-primary hover:underline">
                Start Analysis →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis, i) => (
              <Link key={analysis.id} href={`/results/${analysis.id}`}>
                <Card className="hover-elevate cursor-pointer border-border transition-colors hover:border-primary/50 group overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center p-5 gap-6">
                      <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-full border border-border bg-card">
                        <span className={`text-xl font-bold ${getScoreColor(analysis.overallScore).split(' ')[0]}`}>
                          {analysis.overallScore}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                          {analysis.jobTitle || "Untitled Role"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {analysis.companyName && (
                            <span className="flex items-center gap-1">
                              <Building2 size={14} />
                              {analysis.companyName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="hidden sm:block flex-1 text-sm text-muted-foreground line-clamp-2 pr-4">
                        {analysis.summary}
                      </div>

                      <div className="flex-shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
