import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Loader2, Zap, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { enterpriseApi, type BulkJob, type BulkJobResult, type ResumeProfile, type JobDescription } from "@/lib/enterprise-api";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pending: <Clock className="h-4 w-4 text-yellow-500" />,
  Running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  Complete: <CheckCircle className="h-4 w-4 text-green-500" />,
  Failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Running: "bg-blue-100 text-blue-700",
  Complete: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
};

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>;
  const color = score >= 70 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";
  return <span className={`font-bold text-sm ${color}`}>{score}</span>;
}

function BulkJobDetail({ jobId }: { jobId: number }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["enterprise", "bulk-jobs", jobId],
    queryFn: () => enterpriseApi.bulkJobs.get(jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.job.status;
      return (status === "Running" || status === "Pending") ? 3000 : false;
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  const { job, results } = data;
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {STATUS_ICON[job.status]}
          <Badge className={STATUS_BADGE[job.status] || ""}>{job.status}</Badge>
          <span className="text-sm text-muted-foreground">{job.processed}/{job.total} processed · {job.failed} failed</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          <a href={enterpriseApi.bulkJobs.exportUrl(jobId)} download>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          </a>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Rank</th>
            <th className="pb-2 font-medium">Candidate</th>
            <th className="pb-2 font-medium">Score</th>
            <th className="pb-2 font-medium">Status</th>
          </tr></thead>
          <tbody>{results.map((r: BulkJobResult, i: number) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-4">
                <p className="font-medium">{r.candidate?.candidateName || `Candidate #${r.resumeProfileId}`}</p>
                {r.candidate?.candidateEmail && <p className="text-xs text-muted-foreground">{r.candidate.candidateEmail}</p>}
              </td>
              <td className="py-2 pr-4"><ScoreBar score={r.overallScore} /></td>
              <td className="py-2">{STATUS_ICON[r.status]}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function NewBulkJobDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [jdId, setJdId] = React.useState<string>("");
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const { data: jobs = [] } = useQuery({ queryKey: ["enterprise", "jobs"], queryFn: () => enterpriseApi.jobs.list() });
  const { data: profiles = [] } = useQuery({ queryKey: ["enterprise", "resumes"], queryFn: () => enterpriseApi.resumes.list() });

  const toggle = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!jdId || selectedIds.length === 0) { toast({ variant: "destructive", title: "Select a job and at least one candidate" }); return; }
    setLoading(true);
    try {
      await enterpriseApi.bulkJobs.create({ jobDescriptionId: parseInt(jdId), resumeProfileIds: selectedIds });
      toast({ title: "Bulk job submitted!", description: `Analysing ${selectedIds.length} candidates` });
      setOpen(false); setJdId(""); setSelectedIds([]);
      onCreated();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : "Error" });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New Bulk Job</Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Submit Bulk Analysis Job</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Target Job Description</Label>
            <Select value={jdId} onValueChange={setJdId}>
              <SelectTrigger><SelectValue placeholder="Select a job..." /></SelectTrigger>
              <SelectContent>{jobs.map((j: JobDescription) => <SelectItem key={j.id} value={String(j.id)}>{j.title}{j.company ? ` — ${j.company}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Select Candidates ({selectedIds.length} selected)</Label>
            <div className="border rounded-lg max-h-[200px] overflow-y-auto divide-y">
              {profiles.length === 0 && <p className="text-sm text-muted-foreground p-3">No candidates in pool yet</p>}
              {profiles.map((p: ResumeProfile) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <div><p className="text-sm font-medium">{p.candidateName || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{p.candidateType}</p></div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={submit} disabled={loading || !jdId || selectedIds.length === 0}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : `Analyse ${selectedIds.length} Candidates`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BulkJobs() {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<number | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["enterprise", "bulk-jobs"],
    queryFn: () => enterpriseApi.bulkJobs.list(),
    refetchInterval: 5000,
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bulk Analysis</h1>
            <p className="text-muted-foreground mt-1">Match multiple candidates against a job description at once</p>
          </div>
          <NewBulkJobDialog onCreated={() => qc.invalidateQueries({ queryKey: ["enterprise", "bulk-jobs"] })} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : jobs.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No bulk jobs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Submit your first bulk analysis to rank a group of candidates</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: BulkJob) => {
              const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
              return (
                <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(selected === job.id ? null : job.id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {STATUS_ICON[job.status]}
                        <div>
                          <CardTitle className="text-base">Bulk Job #{job.id}</CardTitle>
                          <CardDescription>{new Date(job.createdAt).toLocaleString()}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_BADGE[job.status] || ""}>{job.status}</Badge>
                        <span className="text-sm text-muted-foreground">{job.processed}/{job.total}</span>
                      </div>
                    </div>
                  </CardHeader>
                  {(job.status === "Running" || job.status === "Pending") && (
                    <CardContent className="pt-0 pb-4"><Progress value={pct} className="h-1.5" /></CardContent>
                  )}
                  {selected === job.id && (
                    <CardContent className="pt-0 border-t mt-2"><BulkJobDetail jobId={job.id} /></CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
