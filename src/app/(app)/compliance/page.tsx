import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { phDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle, Clock, Download, FileText, ShieldCheck } from "lucide-react";

type ComplianceType = "BIR_1601C" | "SSS_R3" | "PHIC_RF1" | "HDMF_MCRF" | "BIR_2316" | "BIR_1604C";

const MONTHLY_TYPES: ComplianceType[] = ["BIR_1601C", "SSS_R3", "PHIC_RF1", "HDMF_MCRF"];
const ANNUAL_TYPES: ComplianceType[] = ["BIR_2316", "BIR_1604C"];

const TYPE_LABELS: Record<ComplianceType, string> = {
  BIR_1601C: "BIR Form 1601-C",
  SSS_R3:    "SSS Form R3",
  PHIC_RF1:  "PhilHealth RF-1",
  HDMF_MCRF: "Pag-IBIG MCRF",
  BIR_2316:  "BIR Form 2316",
  BIR_1604C: "BIR Form 1604-C",
};

const TYPE_SUB: Record<ComplianceType, string> = {
  BIR_1601C: "Monthly withholding tax on compensation",
  SSS_R3:    "SSS contribution remittance",
  PHIC_RF1:  "PhilHealth premium remittance",
  HDMF_MCRF: "Pag-IBIG fund remittance",
  BIR_2316:  "Certificate of compensation payment / tax withheld",
  BIR_1604C: "Annual information return of income taxes withheld",
};

const EXPORT_ROUTES: Partial<Record<ComplianceType, string>> = {
  BIR_1601C: "/api/reports/bir-1601c",
  SSS_R3:    "/api/reports/sss-r3",
  PHIC_RF1:  "/api/reports/phic-rf1",
  HDMF_MCRF: "/api/reports/hdmf-mcrf",
};

function monthlyDueDate(type: ComplianceType, year: number, month: number): Date {
  const dayMap: Record<string, number> = {
    BIR_1601C: 10,
    SSS_R3:    31,
    PHIC_RF1:  11,
    HDMF_MCRF: 15,
  };
  const day = dayMap[type];
  if (type === "SSS_R3" || type === "PHIC_RF1" || type === "HDMF_MCRF" || type === "BIR_1601C") {
    if (type === "HDMF_MCRF" || type === "SSS_R3" || type === "PHIC_RF1") {
      return new Date(year, month + 1, day);
    }
    return new Date(year, month, day);
  }
  return new Date(year, month, day);
}

function getMonthlyDueDate(type: ComplianceType, year: number, month: number): Date {
  const followingMonth: Record<string, boolean> = {
    SSS_R3: true, PHIC_RF1: true, HDMF_MCRF: true,
  };
  const dayMap: Record<string, number> = {
    BIR_1601C: 10, SSS_R3: 31, PHIC_RF1: 11, HDMF_MCRF: 15,
  };
  const day = dayMap[type];
  if (followingMonth[type]) {
    return new Date(year, month + 1, day);
  }
  return new Date(year, month, day);
}

async function ensureComplianceRecords(companyId: string) {
  "use server";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const months = [
    { year: month >= 2 ? year : year - 1, month: ((month - 2) + 12) % 12 },
    { year: month >= 1 ? year : year - 1, month: ((month - 1) + 12) % 12 },
    { year, month },
  ];

  for (const type of MONTHLY_TYPES) {
    for (const { year: y, month: m } of months) {
      const period = `${y}-${String(m + 1).padStart(2, "0")}`;
      const dueDate = getMonthlyDueDate(type, y, m);
      await prisma.complianceRecord.upsert({
        where: { companyId_type_period: { companyId, type, period } },
        update: {},
        create: { companyId, type, period, dueDate, status: "PENDING" },
      });
    }
  }

  for (const type of ANNUAL_TYPES) {
    const period = String(year);
    const dueDate = new Date(year + 1, 0, 31);
    await prisma.complianceRecord.upsert({
      where: { companyId_type_period: { companyId, type, period } },
      update: {},
      create: { companyId, type, period, dueDate, status: "PENDING" },
    });
  }
}

async function markFiled(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  const id = String(formData.get("id"));
  await prisma.complianceRecord.updateMany({
    where: { id, companyId },
    data: { filedAt: new Date(), status: "FILED" },
  });
  redirect("/compliance");
}

async function updateDueDate(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  const id = String(formData.get("id"));
  const newDue = new Date(String(formData.get("dueDate")));
  await prisma.complianceRecord.updateMany({
    where: { id, companyId },
    data: { dueDate: newDue, renewedAt: new Date(), status: "PENDING" },
  });
  redirect("/compliance");
}

function deriveStatus(status: string, dueDate: Date): "FILED" | "OVERDUE" | "PENDING" {
  if (status === "FILED") return "FILED";
  if (dueDate < new Date()) return "OVERDUE";
  return "PENDING";
}

function StatusBadge({ status }: { status: "FILED" | "OVERDUE" | "PENDING" }) {
  if (status === "FILED") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" />
        Filed
      </Badge>
    );
  }
  if (status === "OVERDUE") {
    return (
      <Badge variant="error">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

type RecordRow = {
  id: string;
  type: string;
  period: string;
  dueDate: Date;
  filedAt: Date | null;
  renewedAt: Date | null;
  status: string;
};

function RecordCard({ record }: { record: RecordRow }) {
  const type = record.type as ComplianceType;
  const derived = deriveStatus(record.status, record.dueDate);
  const isOverdue = derived === "OVERDUE";
  const exportRoute = EXPORT_ROUTES[type];

  return (
    <div
      className={`rounded-[var(--radius-md)] border p-4 space-y-3 ${
        isOverdue
          ? "border-[var(--error-border,var(--error))] bg-[var(--error-bg)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{TYPE_LABELS[type]}</span>
            <StatusBadge status={derived} />
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{TYPE_SUB[type]}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Period: {record.period} · Due: {phDate(record.dueDate)}
            {record.filedAt && ` · Filed: ${phDate(record.filedAt)}`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {exportRoute && (
            <a href={exportRoute} download>
              <Button variant="secondary" size="sm" type="button">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </a>
          )}
          {derived !== "FILED" && (
            <form action={markFiled}>
              <input type="hidden" name="id" value={record.id} />
              <Button size="sm" type="submit">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as filed
              </Button>
            </form>
          )}
        </div>
      </div>

      {derived !== "FILED" && (
        <form action={updateDueDate} className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="id" value={record.id} />
          <label className="text-xs text-[var(--text-secondary)]">Update due date:</label>
          <input
            type="date"
            name="dueDate"
            defaultValue={record.dueDate.toISOString().slice(0, 10)}
            className="text-xs border border-[var(--border)] rounded-[var(--radius-sm)] px-2 py-1 bg-[var(--surface)] text-[var(--text-primary)]"
          />
          <Button variant="secondary" size="sm" type="submit">
            <FileText className="h-3.5 w-3.5" />
            Renew
          </Button>
        </form>
      )}
    </div>
  );
}

export default async function CompliancePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  await ensureComplianceRecords(companyId);

  const records = await prisma.complianceRecord.findMany({
    where: { companyId },
    orderBy: [{ period: "desc" }, { type: "asc" }],
  });

  const monthlyRecords = records.filter((r) => MONTHLY_TYPES.includes(r.type as ComplianceType));
  const annualRecords  = records.filter((r) => ANNUAL_TYPES.includes(r.type as ComplianceType));

  const overdueCount = records.filter(
    (r) => r.status !== "FILED" && r.dueDate < new Date()
  ).length;

  const filedCount = records.filter((r) => r.status === "FILED").length;
  const pendingCount = records.length - filedCount - overdueCount;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Statutory remittance &amp; BIR filing tracker for your business.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-[var(--success)]">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">{filedCount} filed</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Submitted to government agencies.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className={`flex items-center gap-2 ${overdueCount > 0 ? "text-[var(--error)]" : "text-[var(--text-secondary)]"}`}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{overdueCount} overdue</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Past due date, action required.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{pendingCount} pending</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Upcoming remittances to file.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Government Remittances</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {monthlyRecords.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No records found.</p>
          ) : (
            monthlyRecords.map((r) => (
              <RecordCard key={r.id} record={r as RecordRow} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual Filings</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {annualRecords.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No records found.</p>
          ) : (
            annualRecords.map((r) => (
              <RecordCard key={r.id} record={r as RecordRow} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
