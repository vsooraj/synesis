import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Briefcase, Loader2, Building } from "lucide-react";
import { enterpriseApi, type JobDescription, type Department } from "@/lib/enterprise-api";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-yellow-100 text-yellow-700",
  Active: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-700",
};

interface JDFormProps {
  initial?: Partial<JobDescription & { descriptionText: string }>;
  onSave: (data: { title: string; company: string; descriptionText: string; status: string; departmentId?: number | null }) => Promise<void>;
  onClose: () => void;
  loading: boolean;
  departments: Department[];
}

function JDForm({ initial, onSave, onClose, loading, departments }: JDFormProps) {
  const [title, setTitle] = React.useState(initial?.title || "");
  const [company, setCompany] = React.useState(initial?.company || "");
  const [descriptionText, setDescriptionText] = React.useState(initial?.descriptionText || "");
  const [status, setStatus] = React.useState(initial?.status || "Draft");
  const [departmentId, setDepartmentId] = React.useState(initial?.departmentId ? String(initial.departmentId) : "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Job Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior Backend Engineer" /></div>
        <div><Label>Company</Label><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {departments.length > 0 && (
          <div>
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label>Job Description *</Label>
        <Textarea value={descriptionText} onChange={e => setDescriptionText(e.target.value)} placeholder="Paste full job description here..." className="min-h-[200px]" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={() => onSave({ title, company, descriptionText, status, departmentId: departmentId ? parseInt(departmentId) : null })} disabled={loading || !title || !descriptionText}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Job"}
        </Button>
      </div>
    </div>
  );
}

export default function JobDescriptions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<JobDescription | null>(null);
  const [saving, setSaving] = React.useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["enterprise", "jobs"],
    queryFn: () => enterpriseApi.jobs.list(),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => enterpriseApi.departments.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.jobs.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enterprise", "jobs"] }); toast({ title: "Job removed" }); },
    onError: (err) => toast({ variant: "destructive", title: "Delete failed", description: err.message }),
  });

  const handleCreate = async (data: { title: string; company: string; descriptionText: string; status: string; departmentId?: number | null }) => {
    setSaving(true);
    try {
      await enterpriseApi.jobs.create(data);
      qc.invalidateQueries({ queryKey: ["enterprise", "jobs"] });
      toast({ title: "Job description created" });
      setShowCreate(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : "Error" });
    } finally { setSaving(false); }
  };

  const handleEdit = async (data: { title: string; company: string; descriptionText: string; status: string; departmentId?: number | null }) => {
    if (!editing) return;
    setSaving(true);
    try {
      await enterpriseApi.jobs.update(editing.id, data);
      qc.invalidateQueries({ queryKey: ["enterprise", "jobs"] });
      toast({ title: "Job description updated" });
      setEditing(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : "Error" });
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Descriptions</h1>
            <p className="text-muted-foreground mt-1">Manage open roles for analysis and bulk matching</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Job</Button>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Create Job Description</DialogTitle></DialogHeader>
            <JDForm onSave={handleCreate} onClose={() => setShowCreate(false)} loading={saving} departments={departments} />
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Edit Job Description</DialogTitle></DialogHeader>
            {editing && <JDForm initial={editing} onSave={handleEdit} onClose={() => setEditing(null)} loading={saving} departments={departments} />}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : jobs.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No job descriptions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a JD to start running bulk analyses</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((jd: JobDescription) => (
              <Card key={jd.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{jd.title}</CardTitle>
                        {jd.company && <CardDescription className="flex items-center gap-1 mt-0.5"><Building className="h-3 w-3" />{jd.company}</CardDescription>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(jd)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(jd.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge className={STATUS_COLORS[jd.status] || "bg-gray-100 text-gray-700"}>{jd.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(jd.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
