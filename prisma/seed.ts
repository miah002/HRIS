import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeSemiMonthlyPayroll } from "../src/lib/ph-payroll";

const prisma = new PrismaClient();

const FIRST = ["Maria", "Juan", "Andrea", "Mark", "Liza", "Paolo", "Kristine", "Joshua", "Angelica", "Carlo", "Bea", "Miguel", "Jasmine", "Rafael", "Patricia"];
const MIDDLE = ["Reyes", "Santos", "Cruz", "Bautista", "Garcia", "Mendoza", "Aquino", "Torres", "Ramos", "Flores"];
const LAST = ["Dela Cruz", "Santos", "Reyes", "Bautista", "Gonzales", "Aquino", "Castillo", "Domingo", "Villanueva", "Pascual", "Lim", "Tan", "Cruz", "Ramos", "Mendoza"];
const POSITIONS = [
  ["Service Crew", "Operations"],
  ["Store Supervisor", "Operations"],
  ["Cashier", "Operations"],
  ["Virtual Assistant", "BPO"],
  ["Team Lead", "BPO"],
  ["Bookkeeper", "Finance"],
  ["HR Assistant", "HR"],
  ["Warehouse Staff", "Logistics"],
  ["Driver", "Logistics"],
  ["Sales Associate", "Sales"],
  ["Marketing Officer", "Marketing"],
  ["Software Developer", "Technology"],
  ["Customer Support", "BPO"],
  ["Account Manager", "Sales"],
  ["Operations Manager", "Operations"],
];
const STATUSES = ["REGULAR", "REGULAR", "REGULAR", "PROBATIONARY", "PROJECT", "CONTRACTUAL"];

function randint(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "demo-co" },
    update: {},
    create: { id: "demo-co", name: "Kape at Pandesal Co.", tin: "123-456-789-000", address: "123 Rizal Ave, Makati City" },
  });

  const password = await bcrypt.hash("demo1234", 10);

  // Owner account
  await prisma.user.upsert({
    where: { email: "owner@demo.ph" },
    update: { password, companyId: company.id },
    create: { email: "owner@demo.ph", name: "Demo Owner", password, role: "OWNER", companyId: company.id },
  });

  // Wipe existing data for idempotent re-seeds
  await prisma.user.deleteMany({ where: { role: "EMPLOYEE" } });
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.employee.deleteMany();

  const employeeRecords: { id: string; email: string; firstName: string; lastName: string; i: number }[] = [];

  for (let i = 1; i <= 15; i++) {
    const [position, department] = POSITIONS[i - 1];
    const status = STATUSES[i % STATUSES.length];
    const baseRate =
      position.includes("Manager") ? randint(45000, 70000) :
      position.includes("Supervisor") || position.includes("Lead") ? randint(28000, 40000) :
      position.includes("Developer") ? randint(40000, 65000) :
      position.includes("Officer") || position.includes("Bookkeeper") ? randint(22000, 32000) :
      randint(13000, 22000);

    const first = FIRST[i - 1];
    const middle = MIDDLE[randint(0, MIDDLE.length - 1)];
    const last = LAST[i - 1];
    const hireYearsAgo = randint(0, 6);
    const dateHired = new Date();
    dateHired.setFullYear(dateHired.getFullYear() - hireYearsAgo);
    dateHired.setMonth(randint(0, 11));

    const empEmail = `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}@kapeatpandesal.ph`;

    const emp = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber: `EMP-${String(i).padStart(4, "0")}`,
        firstName: first,
        middleName: middle,
        lastName: last,
        email: empEmail,
        mobile: `+639${randint(100000000, 999999999)}`,
        dateHired,
        position,
        department,
        employmentStatus: status,
        basicMonthlyRate: baseRate,
        tin: `${randint(100, 999)}-${randint(100, 999)}-${randint(100, 999)}-000`,
        sssNumber: `${randint(10, 99)}-${randint(1000000, 9999999)}-${randint(1, 9)}`,
        philHealthNumber: `${randint(10, 99)}-${randint(100000000, 999999999)}-${randint(1, 9)}`,
        pagIbigNumber: `${randint(1000, 9999)}-${randint(1000, 9999)}-${randint(1000, 9999)}`,
      },
    });

    employeeRecords.push({ id: emp.id, email: empEmail, firstName: first, lastName: last, i });
  }

  // Seed 3 months of payroll for all employees (current + 2 previous cutoffs)
  const now = new Date();
  const cutoffs = [
    // Previous month 16–end
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 16),
      end:   new Date(now.getFullYear(), now.getMonth(), 0),
    },
    // Previous month 1–15
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end:   new Date(now.getFullYear(), now.getMonth() - 1, 15),
    },
    // Current cutoff
    now.getDate() <= 15
      ? { start: new Date(now.getFullYear(), now.getMonth(), 1),  end: new Date(now.getFullYear(), now.getMonth(), 15) }
      : { start: new Date(now.getFullYear(), now.getMonth(), 16), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
  ];

  for (const emp of employeeRecords) {
    const employee = await prisma.employee.findUnique({ where: { id: emp.id } });
    if (!employee) continue;
    for (const { start, end } of cutoffs) {
      const calc = computeSemiMonthlyPayroll({ monthlyRate: employee.basicMonthlyRate, periodStart: start, periodEnd: end });
      await prisma.payroll.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart: start, periodEnd: end } },
        update: { ...calc, status: "RELEASED" },
        create: { employeeId: emp.id, periodStart: start, periodEnd: end, status: "RELEASED", ...calc },
      });
    }
  }

  // Seed demo loans for a few employees
  await prisma.loan.deleteMany();
  const loanSeeds = [
    { idx: 0, type: "SSS_SALARY", description: "SSS salary loan (24 mo)", total: 24000, monthly: 1000 },
    { idx: 1, type: "PAGIBIG_MPL", description: "Pag-IBIG multi-purpose loan", total: 30000, monthly: 1250 },
    { idx: 3, type: "CASH_ADVANCE", description: "Emergency cash advance", total: 8000, monthly: 2000 },
  ];
  for (const ls of loanSeeds) {
    const rec = employeeRecords[ls.idx];
    if (!rec) continue;
    await prisma.loan.create({
      data: {
        employeeId: rec.id,
        companyId: company.id,
        type: ls.type,
        description: ls.description,
        totalAmount: ls.total,
        balance: Math.round(ls.total * 0.6),
        monthlyDeduction: ls.monthly,
        startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        status: "ACTIVE",
      },
    });
  }

  // Seed some approved leaves so balances show usage
  await prisma.leaveRequest.deleteMany();
  const leaveSeeds = [
    { idx: 0, type: "SIL", daysAgo: 30, days: 2 },
    { idx: 1, type: "SIL", daysAgo: 45, days: 1 },
    { idx: 2, type: "PATERNITY", daysAgo: 60, days: 3 },
  ];
  for (const lv of leaveSeeds) {
    const rec = employeeRecords[lv.idx];
    if (!rec) continue;
    const startDate = new Date(Date.now() - lv.daysAgo * 86400000);
    const endDate = new Date(+startDate + (lv.days - 1) * 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: rec.id, leaveType: lv.type, startDate, endDate, days: lv.days, status: "APPROVED" },
    });
  }
  // A couple of pending requests for the approval queue
  for (const idx of [4, 5]) {
    const rec = employeeRecords[idx];
    if (!rec) continue;
    const startDate = new Date(Date.now() + 7 * 86400000);
    const endDate = new Date(+startDate + 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: rec.id, leaveType: "SIL", startDate, endDate, days: 2, status: "PENDING" },
    });
  }

  // Create user accounts for first 3 employees so they can log in as employees
  const demoEmployeeAccounts = employeeRecords.slice(0, 3);
  for (const rec of demoEmployeeAccounts) {
    await prisma.user.create({
      data: {
        email: rec.email,
        name: `${rec.firstName} ${rec.lastName}`,
        password,
        role: "EMPLOYEE",
        companyId: company.id,
        employeeId: rec.id,
      },
    });
  }

  console.log(`\nSeeded company "${company.name}" with 15 employees.\n`);
  console.log("=== DEMO CREDENTIALS ===");
  console.log("");
  console.log("OWNER / ADMIN:");
  console.log("  Email:    owner@demo.ph");
  console.log("  Password: demo1234");
  console.log("  Access:   Full HR dashboard, all modules");
  console.log("");
  console.log("EMPLOYEE PORTAL (login → /my):");
  for (const rec of demoEmployeeAccounts) {
    console.log(`  ${rec.firstName} ${rec.lastName}  →  ${rec.email}  /  demo1234`);
  }
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
