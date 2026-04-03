import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseApi, type Ticket, TICKET_STATUSES, TICKET_PRIORITIES, PRIORITY_COLORS, SLA_BADGE } from "@/lib/enterprise-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Ticket as TicketIcon, AlertTriangle, Clock, Users, Loader2, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMN_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 border-gray-200",
  Open: "bg-blue-50 border-blue-200",
  Sourcing: "bg-purple-50 border-purple-200",
  Screening: "bg-yellow-50 border-yellow-200",
  Interviewing: "bg-orange-50 border-orange-200",
  Offer: "bg-green-50 border-green-200",
  Closed: "bg-slate-100 border-slate-200",
};

const COLUMN_HEADER_COLORS: Record<string, string> = {
  Draft: "bg-gray-200 text-gray-700",
  Open: "bg-blue-200 text-blue-800",
  Sourcing: "bg-purple-200 text-purple-800",
  Screening: "bg-yellow-200 text-yellow-800",
  Interviewing: "bg-orange-200 text-orange-800",
  Offer: "bg-green-200 text-green-800",
  Closed: "bg-slate-300 text-slate-700",
};

function SlaBadge({ sla }: { sla: Ticket["sla"] }) {
  if (!sla) return null;
  const cfg = SLA_BADGE[sla.slaStatus];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", cfg.cls)}>
      {sla.slaBreach ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {sla.slaBreach ? `${Math.abs(sla.daysRemaining)}d overdue` : `${sla.daysRemaining}d left`}
    </span>
  );
}

function TicketCard({ ticket, onDragStart }: { ticket: Ticket; onDragStart: (e: React.DragEvent, id: number) => void }) {
  const assignees: string[] = JSON.parse(ticket.assignedTo ?? "[]");
  return (
    <Link href={`/tickets/${ticket.id}`}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, ticket.id)}
        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow space-y-2 group"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">{ticket.title}</span>
          <Badge variant="outline" className={cn("shrink-0 text-xs font-semibold", PRIORITY_COLORS[ticket.priority])}>
            {ticket.priority}
          </Badge>
        </div>
        {ticket.department && (
          <p className="text-xs text-gray-500">{ticket.department}{ticket.location ? ` · ${ticket.location}` : ""}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <SlaBadge sla={ticket.sla} />
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>{assignees.length || "Unassigned"}</span>
          </div>
        </div>
        {ticket.openings > 1 && (
          <p className="text-xs text-gray-400">{ticket.filled}/{ticket.openings} filled</p>
        )}
      </div>
    </Link>
  );
}

function CreateTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({ title: "", priority: "Medium", department: "", location: "", openings: "1", description: "" });

  const create = useMutation({
    mutationFn: () => enterpriseApi.tickets.create({ ...form, openings: parseInt(form.openings) || 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); onOpenChange(false); setForm({ title: "", priority: "Medium", department: "", location: "", openings: "1", description: "" }); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Position Ticket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Job Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Backend Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Openings</Label>
              <Input type="number" min={1} value={form.openings} onChange={e => setForm(f => ({ ...f, openings: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Engineering" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Remote / NYC" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional context..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.title.trim() || create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: () => enterpriseApi.tickets.list(),
  });

  const moveStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => enterpriseApi.tickets.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const grouped = React.useMemo(() => {
    const map: Record<string, Ticket[]> = {};
    for (const s of TICKET_STATUSES) map[s] = [];
    for (const t of tickets) (map[t.status] ??= []).push(t);
    return map;
  }, [tickets]);

  function handleDragStart(e: React.DragEvent, id: number) {
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    if (dragging != null) moveStatus.mutate({ id: dragging, status });
    setDragging(null);
    setDragOver(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TicketIcon className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Position Board</h1>
          <Badge variant="outline" className="text-gray-500">{tickets.length} total</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tickets/workload">
            <Button variant="outline" size="sm" className="gap-1">
              <BarChart2 className="w-4 h-4" /> Workload
            </Button>
          </Link>
          <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New Position
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
        {TICKET_STATUSES.map(status => {
          const cols = grouped[status] ?? [];
          const isOver = dragOver === status;
          return (
            <div
              key={status}
              className={cn("flex flex-col rounded-xl border-2 transition-colors min-w-[240px] w-[240px] shrink-0", COLUMN_COLORS[status], isOver && "ring-2 ring-blue-400 ring-offset-1")}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, status)}
            >
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-xl font-semibold text-sm", COLUMN_HEADER_COLORS[status])}>
                <span>{status}</span>
                <span className="text-xs font-bold opacity-70">{cols.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cols.map(t => (
                  <TicketCard key={t.id} ticket={t} onDragStart={handleDragStart} />
                ))}
                {cols.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-6">No tickets</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTicketDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
