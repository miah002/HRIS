import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, Lock, Eye, Trash2, FileText } from "lucide-react";

export const metadata = { title: "Privacy Policy — MMTSI HRIS" };

const DATA_MAP = [
  {
    category: "Identity",
    fields: ["First name", "Last name", "Middle name", "Date of birth", "Sex", "Civil status"],
    purpose: "Employee identification and statutory reporting (BIR 2316, SSS, PhilHealth, Pag-IBIG)",
    retention: "Duration of employment + 10 years (BIR requirement)",
    basis: "Legal obligation — NIRC, RA 8282, RA 7875, RA 9679",
  },
  {
    category: "Contact",
    fields: ["Email address", "Mobile number", "Home address (street, city, province, zip)"],
    purpose: "Communication and emergency contact records",
    retention: "Duration of employment + 5 years",
    basis: "Legitimate interest (employment contract)",
  },
  {
    category: "Government IDs",
    fields: ["TIN", "SSS number", "PhilHealth number", "Pag-IBIG number"],
    purpose: "Statutory contribution remittances and tax filing",
    retention: "Duration of employment + 10 years",
    basis: "Legal obligation — NIRC, RA 8282, RA 7875, RA 9679",
  },
  {
    category: "Compensation",
    fields: ["Basic monthly rate", "Semi-monthly payslips", "Gross pay", "Net pay", "Deductions"],
    purpose: "Payroll processing, statutory deductions, BIR withholding tax",
    retention: "10 years (NIRC audit requirement)",
    basis: "Legal obligation — Labor Code, NIRC",
  },
  {
    category: "Attendance & Leave",
    fields: ["Time-in/time-out", "Hours worked", "OT hours", "Leave type and dates", "Leave balance"],
    purpose: "Payroll computation, leave tracking, labor law compliance",
    retention: "3 years (DOLE records requirement)",
    basis: "Legal obligation — Labor Code Art. 83",
  },
  {
    category: "Employment History",
    fields: ["Date hired", "Position", "Department", "Status changes", "Salary history", "Separation details"],
    purpose: "Certificate of employment, BIR 2316, COE",
    retention: "Permanent (COE may be requested years after separation)",
    basis: "Legitimate interest + legal obligation",
  },
  {
    category: "Emergency Contacts",
    fields: ["Contact name", "Relationship", "Phone", "Email"],
    purpose: "Emergency notification",
    retention: "Duration of employment",
    basis: "Vital interests (Art. 12(d), RA 10173)",
  },
  {
    category: "Authentication",
    fields: ["Email address", "bcrypt-hashed password", "JWT session token"],
    purpose: "System access control",
    retention: "Until account deleted",
    basis: "Legitimate interest (system security)",
  },
];

export default function PrivacyPage() {
  const effectiveDate = "June 1, 2026";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Makiling Management Technology Systems, Inc. (MMTSI) — Effective {effectiveDate}
        </p>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-[var(--brand)]" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3 text-sm text-[var(--text-secondary)]">
          <p>
            This HRIS system processes personal data of MMTSI employees solely for the purposes of
            payroll processing, statutory compliance (SSS, PhilHealth, Pag-IBIG, BIR), and HR
            administration. Data processing is governed by the <strong>Republic Act 10173 —
            Data Privacy Act of 2012</strong> and its Implementing Rules and Regulations.
          </p>
          <p>
            <strong>Data Controller:</strong> Makiling Management Technology Systems, Inc.,
            Sto. Tomas, Batangas, Philippines
          </p>
          <p>
            <strong>System:</strong> This application is a private, access-controlled internal HR
            system. It is not accessible to the public. All access requires authenticated credentials.
          </p>
        </CardContent>
      </Card>

      {/* Data Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-[var(--brand)]" />
            Data inventory and processing map
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-4">
            {DATA_MAP.map((row) => (
              <div key={row.category} className="border border-[var(--border)] rounded-[var(--radius-sm)] p-3 space-y-2">
                <div className="font-medium text-sm">{row.category}</div>
                <div className="text-xs text-[var(--text-tertiary)] space-y-1">
                  <div><span className="font-medium text-[var(--text-secondary)]">Fields:</span> {row.fields.join(", ")}</div>
                  <div><span className="font-medium text-[var(--text-secondary)]">Purpose:</span> {row.purpose}</div>
                  <div><span className="font-medium text-[var(--text-secondary)]">Legal basis:</span> {row.basis}</div>
                  <div><span className="font-medium text-[var(--text-secondary)]">Retention:</span> {row.retention}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security measures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-[var(--brand)]" />
            Security measures
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {[
            "Passwords hashed with bcrypt (cost factor 10) — plaintext passwords never stored",
            "All sessions use JWT with server-side secret — tokens are short-lived and rotated on login",
            "HTTPS enforced via HSTS header (2-year max-age, preload)",
            "Content-Security-Policy, X-Frame-Options DENY, X-Content-Type-Options nosniff",
            "Row-level tenant isolation — every DB query filters by companyId",
            "Server actions validate ownership before any write operation",
            "All form inputs validated server-side before DB write",
            "Database hosted on Turso (libSQL) — data at rest encrypted by provider",
            "Rate limiting — DB-backed lockout after 5 failed login attempts (15-minute lock)",
            "Audit log — all login, payroll, leave approval, and separation events recorded with timestamp and actor",
            "Health check endpoint at /api/health — DB connectivity monitoring",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-[var(--brand)] mt-0.5">•</span>
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-[var(--brand)]" />
            Data subject rights (RA 10173 Chapter IV)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          <p>Employees have the right to:</p>
          {[
            "Be informed — know what personal data is collected and how it is used",
            "Access — request a copy of personal data held about them",
            "Rectification — request correction of inaccurate data",
            "Erasure / blocking — request deletion of data where no longer necessary for the stated purpose, subject to legal retention requirements",
            "Portability — receive personal data in a structured, commonly used format",
            "Object — object to processing not based on legal obligation",
            "Lodge a complaint — file a complaint with the National Privacy Commission (privacy.gov.ph)",
          ].map((right) => (
            <div key={right} className="flex items-start gap-2">
              <span className="text-[var(--brand)] mt-0.5">•</span>
              <span>{right}</span>
            </div>
          ))}
          <p className="mt-3 text-xs">
            To exercise any right, contact the MMTSI Data Protection Officer through your HR department.
          </p>
        </CardContent>
      </Card>

      {/* Known gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4 text-[var(--text-tertiary)]" />
            Known gaps and remediation roadmap
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {[
            { item: "Audit logging — per-action trail stored in AuditLog table; visible in Settings", status: "Implemented" },
            { item: "Rate limiting — DB-backed attempt tracking: 5 failures = 15-minute account lockout", status: "Implemented" },
            { item: "NPC registration — system not yet registered with National Privacy Commission", status: "Action required" },
            { item: "Data breach notification procedure — not documented", status: "Action required" },
            { item: "Formal DPA / consent from employees re: HRIS processing", status: "Action required" },
          ].map(({ item, status }) => (
            <div key={item} className="flex items-start justify-between gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
              <span className="text-xs">{item}</span>
              <span className={`text-xs whitespace-nowrap font-medium ${status === "Action required" ? "text-[var(--error)]" : status === "Implemented" ? "text-[var(--success)]" : "text-[var(--text-tertiary)]"}`}>
                {status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
