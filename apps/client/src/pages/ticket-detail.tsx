import * as React from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseApi, type TicketDetail, type InterviewSlot, type Department, TICKET_STATUSES, TICKET_PRIORITIES, CANDIDATE_STAGES, PRIORITY_COLORS, SLA_BADGE } from "@/lib/enterprise-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScheduleInterviewDialog } from "@/pages/interviews";
import {
  ArrowLeft, Clock, AlertTriangle, User, MapPin, Building2, Calendar, Briefcase,
  MessageSquare, History, Plus, Loader2, ChevronRight, X, ExternalLink, Users,
  CalendarDays, Video, Phone, CheckCircle2, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout";

const INTERVIEW_TYPE_ICON: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-3 h-3" />,
  Video: <Video className="w-3 h-3" />,
  Technical: <span className="text-xs font-bold font-mono">{`</>`}</span>,
  Onsite: <Building2 className="w-3 h-3" />,
  Panel: <Users className="w-3 h-3" />,
};

const INTERVIEW_STATUS_CLS: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-400",
  "No-show": "bg-red-100 text-red-600",
};

function SlaBadge({ sla }: { sla: TicketDetail["ticket"]["sla"] }) {
  if (!sla) return null;
  const cfg = SLA_BADGE[sla.slaStatus];
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full", cfg.cls)}>
      {sla.slaBreach ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      {sla.slaBreach ? `${Math.abs(sla.daysRemaining)}d overdue` : `${sla.daysRemaining}d until deadline`}
    </span>
  );
}

function ActivityFeed({ activity }: { activity: TicketDetail["activity"] }) {
  return (
    <div className="space-y-3">
      {activity.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>}
      {activity.map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-1 shrink-0">
            {item.type === "comment"
              ? <MessageSquare className="w-4 h-4 text-blue-500" />
              : <History className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{item.authorName}</p>
            {item.type === "comment"
              ? <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{item.content}</p>
              : <p className="text-sm text-gray-500 mt-0.5">
                  Changed <strong>{item.field}</strong> from <span className="line-through text-gray-400">{item.oldValue ?? "—"}</span>{" "}
                  to <strong className="text-gray-700">{item.newValue ?? "—"}</strong>
                </p>}
            <p className="text-xs text-gray-400 mt-1">{new Date(item.at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = parseInt(id!);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<TicketDetail>({
    queryKey: ["ticket", ticketId],
    queryFn: () => enterpriseApi.tickets.get(ticketId),
  });

  const [comment, setComment] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [addCandidateOpen, setAddCandidateOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (data?.ticket) {
      const t = data.ticket;
      const assignees: string[] = JSON.parse(t.assignedTo ?? "[]");
      setForm({
        title: t.title,
        priority: t.priority,
        departmentId: t.departmentId ? String(t.departmentId) : "",
        department: t.department ?? "",
        location: t.location ?? "",
        salaryRange: t.salaryRange ?? "",
        openings: String(t.openings),
        targetStartDate: t.targetStartDate ?? "",
        description: t.description ?? "",
        assignedTo: assignees.join(", "),
      });
    }
  }, [data]);

  const statusMutation = useMutation({
    mutationFn: ({ status, closeReason }: { status: string; closeReason?: string }) =>
      enterpriseApi.tickets.setStatus(ticketId, status, closeReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", ticketId] }); qc.invalidateQueries({ queryKey: ["tickets"] }); setCloseOpen(false); },
  });

  const editMutation = useMutation({
    mutationFn: () => enterpriseApi.tickets.update(ticketId, {
      ...form,
      openings: parseInt(form.openings) || 1,
      departmentId: form.departmentId ? parseInt(form.departmentId) : null,
      assignedTo: form.assignedTo.split(",").map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", ticketId] }); qc.invalidateQueries({ queryKey: ["tickets"] }); setEditOpen(false); },
  });

  const commentMutation = useMutation({
    mutationFn: () => enterpriseApi.tickets.addComment(ticketId, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", ticketId] }); setComment(""); },
  });

  const removeCandMutation = useMutation({
    mutationFn: (tcId: number) => enterpriseApi.tickets.removeCandidate(ticketId, tcId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const updateCandStageMutation = useMutation({
    mutationFn: ({ tcId, stage }: { tcId: number; stage: string }) => enterpriseApi.tickets.updateCandidateStage(ticketId, tcId, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const [scheduleForCandidate, setScheduleForCandidate] = React.useState<{ tcId: number; rpId: number | null; name: string } | null>(null);

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => enterpriseApi.departments.list(),
  });

  const { data: interviews = [] } = useQuery<InterviewSlot[]>({
    queryKey: ["interviews", "ticket", ticketId],
    queryFn: () => enterpriseApi.interviews.list({ ticketId }),
    enabled: !!ticketId,
  });

  const cancelInterviewMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interviews", "ticket", ticketId] }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (error || !data) return <div className="p-8 text-red-500">Failed to load ticket</div>;

  const { ticket, jd, candidates, activity } = data;
  const assignees: string[] = JSON.parse(ticket.assignedTo ?? "[]");
  const STATUS_LIST = TICKET_STATUSES.filter(s => s !== ticket.status);

  return (
    <Layout>
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/tickets"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> Board</Button></Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{ticket.title}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{ticket.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={cn("text-sm", PRIORITY_COLORS[ticket.priority])} variant="outline">{ticket.priority}</Badge>
                <Badge variant="secondary">{ticket.status}</Badge>
                <SlaBadge sla={ticket.sla} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
              {ticket.status !== "Closed" && (
                <>
                  <Select onValueChange={(status) => {
                    if (status === "Closed") setCloseOpen(true);
                    else statusMutation.mutate({ status });
                  }}>
                    <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Move to…" /></SelectTrigger>
                    <SelectContent>{STATUS_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {ticket.department && <div className="flex items-center gap-1.5 text-gray-600"><Building2 className="w-4 h-4 text-gray-400" />{ticket.department}</div>}
            {ticket.location && <div className="flex items-center gap-1.5 text-gray-600"><MapPin className="w-4 h-4 text-gray-400" />{ticket.location}</div>}
            {ticket.salaryRange && <div className="flex items-center gap-1.5 text-gray-600"><Briefcase className="w-4 h-4 text-gray-400" />{ticket.salaryRange}</div>}
            {ticket.targetStartDate && <div className="flex items-center gap-1.5 text-gray-600"><Calendar className="w-4 h-4 text-gray-400" />{ticket.targetStartDate}</div>}
            <div className="flex items-center gap-1.5 text-gray-600"><Users className="w-4 h-4 text-gray-400" />{ticket.openings} opening{ticket.openings !== 1 ? "s" : ""} ({ticket.filled} filled)</div>
            {assignees.length > 0 && <div className="flex items-center gap-1.5 text-gray-600 col-span-2"><User className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{assignees.join(", ")}</span></div>}
          </div>

          {ticket.description && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{ticket.description}</p>}
          {jd && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Linked JD:</span>
              <Link href={`/job-descriptions`}>
                <span className="text-blue-600 hover:underline inline-flex items-center gap-1">{jd.title} <ExternalLink className="w-3 h-3" /></span>
              </Link>
              <Badge variant="outline" className="text-xs">{jd.status}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Candidate Pipeline</h2>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setAddCandidateOpen(true)}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <div className="p-4 space-y-2">
              {candidates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No candidates linked yet</p>}
              {candidates.map(tc => (
                <div key={tc.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tc.candidate?.candidateName ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400 truncate">{tc.candidate?.candidateEmail ?? tc.candidate?.fileName ?? ""}</p>
                  </div>
                  <Select value={tc.stage} onValueChange={(stage) => updateCandStageMutation.mutate({ tcId: tc.id, stage })}>
                    <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CANDIDATE_STAGES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-blue-500 border-blue-200 hover:bg-blue-50"
                    title="Schedule Interview"
                    onClick={() => setScheduleForCandidate({ tcId: tc.id, rpId: tc.candidate?.id ?? null, name: tc.candidate?.candidateName ?? "Candidate" })}>
                    <CalendarDays className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeCandMutation.mutate(tc.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-blue-500" /> Interviews
                {interviews.length > 0 && <Badge variant="outline" className="text-xs">{interviews.length}</Badge>}
              </h2>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                onClick={() => setScheduleForCandidate({ tcId: 0, rpId: null, name: "" })}>
                <Plus className="w-3 h-3" /> Schedule
              </Button>
            </div>
            <div className="p-4 space-y-2">
              {interviews.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No interviews scheduled</p>}
              {interviews.map(iv => {
                const d = new Date(iv.scheduledAt);
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div key={iv.id} className={cn("flex items-center gap-3 py-2 border-b border-gray-50 last:border-0",
                    iv.status === "Cancelled" && "opacity-50")}>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{iv.candidate?.candidateName ?? "—"}</span>
                        <span className={cn("inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium", INTERVIEW_STATUS_CLS[iv.status])}>
                          {iv.status}
                        </span>
                      </div>
                      <p className={cn("text-xs flex items-center gap-1", isToday ? "text-blue-600 font-medium" : "text-gray-400")}>
                        {INTERVIEW_TYPE_ICON[iv.type]}
                        {iv.type} · {isToday ? "Today" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ({iv.durationMinutes}m)
                      </p>
                      {iv.interviewers?.length > 0 && <p className="text-xs text-gray-400 truncate">{iv.interviewers.join(", ")}</p>}
                    </div>
                    {iv.meetingLink && (
                      <a href={iv.meetingLink} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="icon" className="h-6 w-6 text-blue-500 border-blue-200"><Video className="w-3 h-3" /></Button>
                      </a>
                    )}
                    {iv.status === "Scheduled" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-400"
                        onClick={() => cancelInterviewMutation.mutate(iv.id)}>
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Activity</h2>
            </div>
            <div className="p-4">
              <ActivityFeed activity={activity} />
              <Separator className="my-4" />
              <div className="space-y-2">
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Leave a comment…"
                  rows={2}
                  className="text-sm"
                />
                <Button size="sm" className="w-full" disabled={!comment.trim() || commentMutation.isPending} onClick={() => commentMutation.mutate()}>
                  {commentMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Post Comment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Title</Label><Input value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Openings</Label><Input type="number" value={form.openings ?? "1"} onChange={e => setForm(f => ({ ...f, openings: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Select value={form.departmentId ?? ""} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Location</Label><Input value={form.location ?? ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            </div>
            <div><Label>Salary Range</Label><Input value={form.salaryRange ?? ""} onChange={e => setForm(f => ({ ...f, salaryRange: e.target.value }))} placeholder="e.g. $120k–$160k" /></div>
            <div><Label>Target Start Date</Label><Input type="date" value={form.targetStartDate ?? ""} onChange={e => setForm(f => ({ ...f, targetStartDate: e.target.value }))} /></div>
            <div><Label>Assignees (comma separated)</Label><Input value={form.assignedTo ?? ""} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="alice@co.com, bob@co.com" /></div>
            <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloseDialog open={closeOpen} onOpenChange={setCloseOpen}
        onConfirm={(reason) => statusMutation.mutate({ status: "Closed", closeReason: reason })}
        isPending={statusMutation.isPending} />

      <AddCandidateDialog open={addCandidateOpen} onOpenChange={setAddCandidateOpen} ticketId={ticketId} />

      {scheduleForCandidate != null && (
        <ScheduleInterviewDialog
          open
          onOpenChange={(v) => { if (!v) setScheduleForCandidate(null); }}
          ticketId={ticketId}
          ticketCandidateId={scheduleForCandidate.tcId || undefined}
          resumeProfileId={scheduleForCandidate.rpId ?? undefined}
          candidateName={scheduleForCandidate.name || undefined}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["interviews", "ticket", ticketId] });
            setScheduleForCandidate(null);
          }}
        />
      )}
    </div>
    </Layout>
  );
}

function CloseDialog({ open, onOpenChange, onConfirm, isPending }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = React.useState("Filled");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Close Position</DialogTitle></DialogHeader>
        <div>
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Filled", "Cancelled", "On Hold"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Close Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCandidateDialog({ open, onOpenChange, ticketId }: { open: boolean; onOpenChange: (v: boolean) => void; ticketId: number }) {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["resume-profiles"],
    queryFn: () => enterpriseApi.resumeProfiles.list(),
    enabled: open,
  });

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return !q || (p.candidateName ?? "").toLowerCase().includes(q) || (p.candidateEmail ?? "").toLowerCase().includes(q);
  });

  const add = useMutation({
    mutationFn: (resumeProfileId: number) => enterpriseApi.tickets.addCandidate(ticketId, resumeProfileId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", ticketId] }); onOpenChange(false); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="mb-2" />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.slice(0, 30).map(p => (
            <button key={p.id} onClick={() => add.mutate(p.id)} className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors">
              <p className="text-sm font-medium text-gray-900">{p.candidateName ?? "Unknown"}</p>
              <p className="text-xs text-gray-400">{p.candidateEmail ?? p.fileName ?? ""}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No candidates found</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
