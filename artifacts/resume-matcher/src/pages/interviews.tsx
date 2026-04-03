import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseApi, type InterviewSlot, INTERVIEW_TYPES, INTERVIEW_STATUSES } from "@/lib/enterprise-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays, Video, Phone, Building2, Users, Clock, CheckCircle2,
  XCircle, AlertCircle, Plus, Loader2, Star, ChevronRight, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-3.5 h-3.5" />,
  Video: <Video className="w-3.5 h-3.5" />,
  Technical: <span className="font-mono text-xs font-bold">{`</>`}</span>,
  Onsite: <Building2 className="w-3.5 h-3.5" />,
  Panel: <Users className="w-3.5 h-3.5" />,
};

const STATUS_STYLE: Record<string, { cls: string; icon: React.ReactNode }> = {
  Scheduled: { cls: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
  Completed: { cls: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  Cancelled: { cls: "bg-gray-100 text-gray-500", icon: <XCircle className="w-3 h-3" /> },
  "No-show": { cls: "bg-red-100 text-red-600", icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDateTime(dt: string) {
  const d = new Date(dt);
  return {
    date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    isPast: d < new Date(),
    isToday: d.toDateString() === new Date().toDateString(),
  };
}

function StarRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className={cn("transition-colors", n <= value ? "text-amber-400" : "text-gray-200", onChange && "hover:text-amber-300 cursor-pointer")}>
          <Star className="w-4 h-4 fill-current" />
        </button>
      ))}
    </div>
  );
}

function InterviewCard({ slot, onComplete, onCancel, onNoShow }: {
  slot: InterviewSlot;
  onComplete: (id: number) => void;
  onCancel: (id: number) => void;
  onNoShow: (id: number) => void;
}) {
  const { date, time, isToday } = formatDateTime(slot.scheduledAt);
  const status = STATUS_STYLE[slot.status] ?? STATUS_STYLE.Scheduled;

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow",
      slot.status === "Cancelled" && "opacity-60",
      isToday && slot.status === "Scheduled" && "border-blue-300 ring-1 ring-blue-200")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{slot.candidate?.candidateName ?? "Candidate"}</p>
          {slot.candidate?.candidateEmail && <p className="text-xs text-gray-400 truncate">{slot.candidate.candidateEmail}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="gap-1 text-xs font-medium">
            {TYPE_ICON[slot.type]}{slot.type}
          </Badge>
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", status.cls)}>
            {status.icon}{slot.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className={cn("flex items-center gap-1.5 font-medium", isToday && "text-blue-700")}>
          <CalendarDays className="w-3.5 h-3.5" />
          {isToday ? "Today" : date}
        </span>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{time} ({slot.durationMinutes}m)</span>
      </div>

      {slot.ticket && (
        <Link href={`/tickets/${slot.ticket.id}`}>
          <span className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
            <ExternalLink className="w-3 h-3" />{slot.ticket.title}
          </span>
        </Link>
      )}

      {slot.interviewers.length > 0 && (
        <p className="text-xs text-gray-500">Interviewers: {slot.interviewers.join(", ")}</p>
      )}

      {slot.meetingLink && (
        <a href={slot.meetingLink} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Video className="w-3 h-3" /> Join Meeting
        </a>
      )}

      {slot.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">{slot.notes}</p>}

      {slot.status === "Completed" && slot.rating != null && (
        <div className="flex items-center gap-2">
          <StarRating value={slot.rating} />
          {slot.feedback && <p className="text-xs text-gray-500 line-clamp-1">{slot.feedback}</p>}
        </div>
      )}

      {slot.status === "Scheduled" && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
            onClick={() => onComplete(slot.id)}>
            <CheckCircle2 className="w-3 h-3" /> Complete
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => onNoShow(slot.id)}>
            <AlertCircle className="w-3 h-3" /> No-show
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 ml-auto"
            onClick={() => onCancel(slot.id)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function CompleteDialog({ id, onClose, onDone }: { id: number; onClose: () => void; onDone?: (slot: InterviewSlot) => void }) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = React.useState("");
  const [rating, setRating] = React.useState(0);
  const complete = useMutation({
    mutationFn: () => enterpriseApi.interviews.complete(id, feedback, rating || undefined),
    onSuccess: async (updated) => {
      onDone?.(updated);
      await qc.invalidateQueries({ queryKey: ["interviews"] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark Interview Completed</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Rating</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <Label>Feedback / Notes</Label>
            <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="How did the interview go?" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
            {complete.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleInterviewDialog({
  open, onOpenChange, ticketId, ticketCandidateId, resumeProfileId, candidateName, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ticketId: number; ticketCandidateId?: number; resumeProfileId?: number;
  candidateName?: string; onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const defaultDt = now.toISOString().slice(0, 16);

  const [form, setForm] = React.useState({
    scheduledAt: defaultDt, durationMinutes: "60", type: "Video",
    interviewers: "", meetingLink: "", location: "", notes: "",
  });

  const create = useMutation({
    mutationFn: () => enterpriseApi.interviews.create({
      ticketId,
      ticketCandidateId,
      resumeProfileId,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: parseInt(form.durationMinutes) || 60,
      type: form.type,
      interviewers: form.interviewers.split(",").map(s => s.trim()).filter(Boolean),
      meetingLink: form.meetingLink || undefined,
      location: form.location || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interviews"] });
      onOpenChange(false);
      onCreated?.();
      setForm({ scheduledAt: defaultDt, durationMinutes: "60", type: "Video", interviewers: "", meetingLink: "", location: "", notes: "" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Interview{candidateName ? ` — ${candidateName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Select value={form.durationMinutes} onValueChange={v => setForm(f => ({ ...f, durationMinutes: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["30", "45", "60", "90", "120"].map(d => <SelectItem key={d} value={d}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Interview Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Interviewers (comma-separated emails)</Label>
            <Input value={form.interviewers} onChange={e => setForm(f => ({ ...f, interviewers: e.target.value }))} placeholder="alice@co.com, bob@co.com" />
          </div>
          {(form.type === "Video") && (
            <div>
              <Label>Meeting Link</Label>
              <Input value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." />
            </div>
          )}
          {(form.type === "Onsite" || form.type === "Panel") && (
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="3rd floor conference room, NYC" />
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Topics to cover, preparation notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.scheduledAt || create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InterviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<string>("Scheduled");
  const [completeId, setCompleteId] = React.useState<number | null>(null);

  const { data: slots = [], isLoading } = useQuery<InterviewSlot[]>({
    queryKey: ["interviews", filter],
    queryFn: () => {
      if (filter === "upcoming") return enterpriseApi.interviews.upcoming(60);
      if (filter === "all") return enterpriseApi.interviews.list({});
      return enterpriseApi.interviews.list({ status: filter });
    },
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interviews"], refetchType: "all" }),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.noShow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interviews"], refetchType: "all" }),
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, InterviewSlot[]>();
    for (const slot of slots) {
      const d = new Date(slot.scheduledAt);
      const key = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots]);

  const filters = [
    { value: "upcoming", label: "Upcoming" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "all", label: "All" },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Interviews</h1>
          <Badge variant="outline" className="text-gray-500">{slots.length}</Badge>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                filter === f.value ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {slots.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No interviews found</p>
          <p className="text-xs mt-1">Schedule one from a position ticket</p>
          <Link href="/tickets"><Button variant="outline" size="sm" className="mt-4 gap-1"><ChevronRight className="w-4 h-4" /> Go to Position Board</Button></Link>
        </div>
      )}

      {Array.from(grouped.entries()).map(([dateLabel, daySlots]) => (
        <div key={dateLabel} className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-600">{dateLabel}</p>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">{daySlots.length} interview{daySlots.length !== 1 ? "s" : ""}</span>
          </div>
          {daySlots.map(slot => (
            <InterviewCard key={slot.id} slot={slot}
              onComplete={(id) => setCompleteId(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              onNoShow={(id) => noShowMutation.mutate(id)}
            />
          ))}
        </div>
      ))}

      {completeId != null && (
        <CompleteDialog
          id={completeId}
          onClose={() => setCompleteId(null)}
          onDone={() => setFilter("Completed")}
        />
      )}
    </div>
  );
}
