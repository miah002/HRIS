import React from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { php, phDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, Th, Td } from "@/components/ui/table";
import Link from "next/link";
import { CreditCard, PlusCircle } from "lucide-react";

const LOAN_LABELS: Record<string, string> = {
  SSS_SALARY: "SSS Salary Loan",
  PAGIBIG_MPL: "Pag-IBIG Multi-Purpose Loan",
  CASH_ADVANCE: "Company Cash Advance",
  OTHER: "Other",
};

async function editLoan(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const loanId = String(formData.get("loanId"));
  const balance = Number(formData.get("balance"));
  const monthlyDeduction = Number(formData.get("monthlyDeduction"));
  const status = String(formData.get("status"));
  await prisma.loan.update({ where: { id: loanId }, data: { balance, monthlyDeduction, status } });
  redirect("/loans?toast=Loan+updated+successfully");
}

async function addLoan(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";
  if (!companyId) redirect("/dashboard");

  const employeeId = String(formData.get("employeeId"));
  const type = String(formData.get("type"));
  const description = formData.get("description") ? String(formData.get("description")) : null;
  const totalAmount = parseFloat(String(formData.get("totalAmount")));
  const monthlyDeduction = parseFloat(String(formData.get("monthlyDeduction")));
  const startDate = new Date(String(formData.get("startDate")));

  await prisma.loan.create({
    data: {
      employeeId,
      companyId,
      type,
      description,
      totalAmount,
      balance: totalAmount,
      monthlyDeduction,
      startDate,
      status: "ACTIVE",
    },
  });

  redirect("/loans?toast=Loan+added+successfully");
}

async function markPaid(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.loan.update({ where: { id }, data: { status: "PAID" } });
  redirect("/loans?toast=Loan+marked+as+paid");
}

async function cancelLoan(id: string) {
  "use server";
  const session = await auth();
  if (!session) redirect("/login");
  await prisma.loan.update({ where: { id }, data: { status: "CANCELLED" } });
  redirect("/loans?toast=Loan+cancelled");
}

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ editLoan?: string; editClosed?: string }> }) {
  const { editLoan: editLoanId, editClosed: editClosedId } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
  const companyId = user?.companyId ?? "";

  // All three reads depend only on companyId — run concurrently.
  const [employees, activeLoans, closedLoans] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, archived: false },
      orderBy: { firstName: "asc" },
    }),
    prisma.loan.findMany({
      where: { companyId, status: "ACTIVE" },
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findMany({
      where: { companyId, status: { in: ["PAID", "CANCELLED"] } },
      include: { employee: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[var(--text-tertiary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Loans & Deductions</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          SSS salary loans, Pag-IBIG MPL, and cash advances — deducted automatically from payroll.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-[var(--brand)]" /> Add loan
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <form action={addLoan} className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Employee</label>
              <select
                name="employeeId"
                required
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Type</label>
              <select
                name="type"
                required
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                {Object.entries(LOAN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Description (optional)</label>
              <input
                type="text"
                name="description"
                placeholder="e.g. Loan #2024-001"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Total amount</label>
              <input
                type="number"
                name="totalAmount"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Monthly deduction</label>
              <input
                type="number"
                name="monthlyDeduction"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Start date</label>
              <input
                type="date"
                name="startDate"
                required
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <div className="sm:col-span-3 lg:col-span-6 flex justify-end">
              <SubmitButton size="sm">
                Add loan
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Active loans
            {activeLoans.length > 0 && (
              <Badge variant="brand">{activeLoans.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeLoans.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-tertiary)]">
              No active loans. Add one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Balance</Th>
                  <Th className="text-right">Monthly</Th>
                  <Th>Started</Th>
                  <Th></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoans.map((loan) => {
                  const markPaidFn = markPaid.bind(null, loan.id);
                  const cancelFn = cancelLoan.bind(null, loan.id);
                  const isEditing = editLoanId === loan.id;
                  return (
                    <React.Fragment key={loan.id}>
                    <TableRow>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${loan.employee.firstName} ${loan.employee.lastName}`}
                            size="sm"
                          />
                          <div>
                            <div className="text-sm font-medium">
                              {loan.employee.lastName}, {loan.employee.firstName}
                            </div>
                            <div className="text-2xs text-[var(--text-tertiary)]">
                              {loan.employee.employeeNumber}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div>
                          <div className="text-sm">{LOAN_LABELS[loan.type] ?? loan.type}</div>
                          {loan.description && (
                            <div className="text-2xs text-[var(--text-tertiary)]">{loan.description}</div>
                          )}
                        </div>
                      </Td>
                      <Td numeric>{php(loan.totalAmount)}</Td>
                      <Td numeric>
                        <span className={loan.balance <= 0 ? "text-[var(--success)]" : undefined}>
                          {php(loan.balance)}
                        </span>
                      </Td>
                      <Td numeric>{php(loan.monthlyDeduction)}</Td>
                      <Td>{phDate(loan.startDate)}</Td>
                      <Td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={isEditing ? "/loans" : `/loans?editLoan=${loan.id}`}>
                            <Button size="sm" variant="secondary" type="button">
                              {isEditing ? "Close" : "Edit"}
                            </Button>
                          </Link>
                          <form action={markPaidFn}>
                            <SubmitButton size="sm" variant="secondary">
                              Mark Paid
                            </SubmitButton>
                          </form>
                          <form action={cancelFn}>
                            <SubmitButton size="sm" variant="secondary">
                              Cancel
                            </SubmitButton>
                          </form>
                        </div>
                      </Td>
                    </TableRow>
                    {isEditing && (
                      <TableRow className="bg-[var(--neutral-bg)]">
                        <Td colSpan={7}>
                          <form action={editLoan} className="flex flex-wrap gap-3 items-end py-1">
                            <input type="hidden" name="loanId" value={loan.id} />
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="text-[var(--text-tertiary)]">Balance</span>
                              <input type="number" name="balance" defaultValue={loan.balance} min="0" step="0.01"
                                className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                              />
                            </div>
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="text-[var(--text-tertiary)]">Monthly deduction</span>
                              <input type="number" name="monthlyDeduction" defaultValue={loan.monthlyDeduction} min="0" step="0.01"
                                className="h-8 w-36 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                              />
                            </div>
                            <div className="flex flex-col gap-1 text-xs">
                              <span className="text-[var(--text-tertiary)]">Status</span>
                              <select name="status" defaultValue={loan.status}
                                className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                              >
                                <option value="ACTIVE">Active</option>
                                <option value="PAID">Paid</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </div>
                            <SubmitButton size="sm">Save</SubmitButton>
                          </form>
                        </Td>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {closedLoans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent closed loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Balance</Th>
                  <Th className="text-right">Monthly</Th>
                  <Th>Started</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedLoans.map((loan) => {
                  const isEditing = editClosedId === loan.id;
                  return (
                    <React.Fragment key={loan.id}>
                      <TableRow>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={`${loan.employee.firstName} ${loan.employee.lastName}`} size="sm" />
                            <div className="text-sm font-medium">
                              {loan.employee.lastName}, {loan.employee.firstName}
                            </div>
                          </div>
                        </Td>
                        <Td>{LOAN_LABELS[loan.type] ?? loan.type}</Td>
                        <Td numeric>{php(loan.totalAmount)}</Td>
                        <Td numeric>{php(loan.balance)}</Td>
                        <Td numeric>{php(loan.monthlyDeduction)}</Td>
                        <Td>{phDate(loan.startDate)}</Td>
                        <Td>
                          <Badge variant={loan.status === "PAID" ? "success" : "neutral"}>
                            {loan.status}
                          </Badge>
                        </Td>
                        <Td>
                          <Link href={isEditing ? "/loans" : `/loans?editClosed=${loan.id}`}>
                            <Button size="sm" variant="secondary" type="button">
                              {isEditing ? "Close" : "Edit"}
                            </Button>
                          </Link>
                        </Td>
                      </TableRow>
                      {isEditing && (
                        <TableRow className="bg-[var(--neutral-bg)]">
                          <Td colSpan={8}>
                            <form action={editLoan} className="flex flex-wrap gap-3 items-end py-1">
                              <input type="hidden" name="loanId" value={loan.id} />
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="text-[var(--text-tertiary)]">Balance</span>
                                <input type="number" name="balance" defaultValue={loan.balance} min="0" step="0.01"
                                  className="h-8 w-32 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                                />
                              </div>
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="text-[var(--text-tertiary)]">Monthly deduction</span>
                                <input type="number" name="monthlyDeduction" defaultValue={loan.monthlyDeduction} min="0" step="0.01"
                                  className="h-8 w-36 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm tabular focus:outline-none focus:border-[var(--brand)]"
                                />
                              </div>
                              <div className="flex flex-col gap-1 text-xs">
                                <span className="text-[var(--text-tertiary)]">Status</span>
                                <select name="status" defaultValue={loan.status}
                                  className="h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm focus:outline-none focus:border-[var(--brand)]"
                                >
                                  <option value="ACTIVE">Active</option>
                                  <option value="PAID">Paid</option>
                                  <option value="CANCELLED">Cancelled</option>
                                </select>
                              </div>
                              <SubmitButton size="sm">Save</SubmitButton>
                            </form>
                          </Td>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
