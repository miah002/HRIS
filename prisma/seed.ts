import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeSemiMonthlyPayroll } from "../src/lib/ph-payroll";

function makePrisma() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    const libsql = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = makePrisma();

const EMPLOYEES = [
  {
    number: "MMTSI2021-004",
    firstName: "John Andrew", middleName: "Maglinte", lastName: "Emnase",
    position: "Admin Staff - Sto. Tomas", department: "Admin",
    status: "REGULAR", rate: 20000,
    hire: new Date("2021-06-01"),
  },
  {
    number: "MMTSI2019-002",
    firstName: "Louie", middleName: "Padawan", lastName: "Castillo",
    position: "Accounting Team Leader", department: "Finance",
    status: "REGULAR", rate: 38000,
    hire: new Date("2019-03-15"),
  },
  {
    number: "MMTSI2019-003",
    firstName: "Angela Luz", middleName: "Collantes", lastName: "Veloso",
    position: "Senior Accountant", department: "Finance",
    status: "REGULAR", rate: 32000,
    hire: new Date("2019-08-01"),
  },
  {
    number: "MMTSI2022-006",
    firstName: "Ella Queenly", middleName: "Atienza", lastName: "Domingo",
    position: "Admin Staff - Bauan", department: "Admin",
    status: "REGULAR", rate: 20000,
    hire: new Date("2022-01-10"),
  },
  {
    number: "MMTSI2023-010",
    firstName: "Ailyn", middleName: "Castillo", lastName: "Espanola",
    position: "Admin Staff", department: "Admin",
    status: "REGULAR", rate: 18000,
    hire: new Date("2023-04-03"),
  },
  {
    number: "MMTSI2023-011",
    firstName: "Jay Lloyd", middleName: "Josol", lastName: "Sale",
    position: "Admin Staff - Sto. Tomas", department: "Admin",
    status: "REGULAR", rate: 18000,
    hire: new Date("2023-07-17"),
  },
  {
    number: "MMTSI2024-012",
    firstName: "Reyniel", middleName: "Maglinte", lastName: "Emnase",
    position: "Admin Staff - Part-Time", department: "Admin",
    status: "CONTRACTUAL", rate: 12000,
    hire: new Date("2024-02-05"),
  },
  {
    number: "MMTSI2025-013",
    firstName: "Jane", middleName: "Balba", lastName: "Ocampo",
    position: "Accounting Staff", department: "Finance",
    status: "REGULAR", rate: 22000,
    hire: new Date("2025-01-06"),
  },
] as const;

function emailFor(e: { firstName: string; lastName: string }) {
  const first = e.firstName.toLowerCase().replace(/\s+/g, "");
  const last  = e.lastName.toLowerCase().replace(/\s+/g, "");
  return `${first}.${last}@mmtsi.ph`;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "demo-co" },
    update: { name: "MMTSI", tin: "123-456-789-000", address: "Sto. Tomas, Batangas" },
    create: { id: "demo-co", name: "MMTSI", tin: "123-456-789-000", address: "Sto. Tomas, Batangas" },
  });

  const password = await bcrypt.hash("demo1234", 10);

  await prisma.user.upsert({
    where: { email: "owner@demo.ph" },
    update: { password, companyId: company.id },
    create: { email: "owner@demo.ph", name: "Admin", password, role: "OWNER", companyId: company.id },
  });

  // Wipe existing data
  await prisma.user.deleteMany({ where: { role: "EMPLOYEE" } });
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.employee.deleteMany();

  const now = new Date();
  const cutoffs = [
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 16),
      end:   new Date(now.getFullYear(), now.getMonth(), 0),
    },
    {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end:   new Date(now.getFullYear(), now.getMonth() - 1, 15),
    },
    now.getDate() <= 15
      ? { start: new Date(now.getFullYear(), now.getMonth(), 1),  end: new Date(now.getFullYear(), now.getMonth(), 15) }
      : { start: new Date(now.getFullYear(), now.getMonth(), 16), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
  ];

  const created: { id: string; emp: typeof EMPLOYEES[number] }[] = [];

  for (const emp of EMPLOYEES) {
    const email = emailFor(emp);
    const record = await prisma.employee.create({
      data: {
        companyId:        company.id,
        employeeNumber:   emp.number,
        firstName:        emp.firstName,
        middleName:       emp.middleName,
        lastName:         emp.lastName,
        email,
        dateHired:        emp.hire,
        position:         emp.position,
        department:       emp.department,
        employmentStatus: emp.status,
        basicMonthlyRate: emp.rate,
        tin:              `000-000-000-000`,
        sssNumber:        `00-0000000-0`,
        philHealthNumber: `00-000000000-0`,
        pagIbigNumber:    `0000-0000-0000`,
      },
    });

    created.push({ id: record.id, emp });

    // Payroll history: 3 cutoffs
    for (const { start, end } of cutoffs) {
      const calc = computeSemiMonthlyPayroll({ monthlyRate: emp.rate, periodStart: start, periodEnd: end });
      await prisma.payroll.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: record.id, periodStart: start, periodEnd: end } },
        update: { ...calc, status: "RELEASED" },
        create: { employeeId: record.id, periodStart: start, periodEnd: end, status: "RELEASED", ...calc },
      });
    }

    // Portal login for every employee
    await prisma.user.create({
      data: {
        email,
        name:       `${emp.firstName} ${emp.lastName}`,
        password,
        role:       "EMPLOYEE",
        companyId:  company.id,
        employeeId: record.id,
      },
    });
  }

  // Demo loans
  const [emnase, castillo, , , , , , ocampo] = created;
  const loanSeeds = [
    { rec: emnase,  type: "SSS_SALARY",  desc: "SSS salary loan (24 mo)", total: 24000, monthly: 1000 },
    { rec: castillo, type: "PAGIBIG_MPL", desc: "Pag-IBIG multi-purpose loan", total: 30000, monthly: 1250 },
    { rec: ocampo,  type: "CASH_ADVANCE", desc: "Emergency cash advance", total: 8000, monthly: 2000 },
  ];
  for (const ls of loanSeeds) {
    if (!ls.rec) continue;
    await prisma.loan.create({
      data: {
        employeeId:       ls.rec.id,
        companyId:        company.id,
        type:             ls.type,
        description:      ls.desc,
        totalAmount:      ls.total,
        balance:          Math.round(ls.total * 0.6),
        monthlyDeduction: ls.monthly,
        startDate:        new Date(now.getFullYear(), now.getMonth() - 2, 1),
        status:           "ACTIVE",
      },
    });
  }

  // Demo leave requests
  const [e0, e1, e2, , e4, e5] = created;
  const leaveSeeds = [
    { rec: e0, type: "SIL",      daysAgo: 30, days: 2 },
    { rec: e1, type: "SIL",      daysAgo: 45, days: 1 },
    { rec: e2, type: "PATERNITY", daysAgo: 60, days: 3 },
  ];
  for (const lv of leaveSeeds) {
    if (!lv.rec) continue;
    const startDate = new Date(Date.now() - lv.daysAgo * 86400000);
    const endDate   = new Date(+startDate + (lv.days - 1) * 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: lv.rec.id, leaveType: lv.type, startDate, endDate, days: lv.days, status: "APPROVED" },
    });
  }
  for (const rec of [e4, e5].filter(Boolean)) {
    const startDate = new Date(Date.now() + 7 * 86400000);
    const endDate   = new Date(+startDate + 86400000);
    await prisma.leaveRequest.create({
      data: { employeeId: rec.id, leaveType: "SIL", startDate, endDate, days: 2, status: "PENDING" },
    });
  }

  // --- Attendance test data ---
  function attData(date: Date, inH: number, inM: number, outH: number, outM: number, rateCode: string | null) {
    const timeIn  = new Date(date); timeIn.setHours(inH, inM, 0, 0);
    const timeOut = new Date(date); timeOut.setHours(outH, outM, 0, 0);
    const rawHours    = (timeOut.getTime() - timeIn.getTime()) / 3600000;
    const hoursWorked = rawHours >= 5 ? rawHours - 1 : rawHours; // 1h lunch deduction
    const otHours     = Math.max(0, hoursWorked - 8);
    return {
      timeIn, timeOut,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      otHours:     Math.round(otHours     * 100) / 100,
      ndHours:     0,
      isRestDay:   !!rateCode?.includes("RD"),
      isHoliday:   !!(rateCode?.startsWith("RH") || rateCode?.startsWith("SH")),
      otRateCode:  rateCode,
    };
  }

  // Previous cutoff: May 1–15, 2026 — weekdays
  const prevWeekdays = [
    new Date(2026, 4, 4),  new Date(2026, 4, 5),  new Date(2026, 4, 6),
    new Date(2026, 4, 7),  new Date(2026, 4, 8),
    new Date(2026, 4, 11), new Date(2026, 4, 12), new Date(2026, 4, 13),
    new Date(2026, 4, 14), new Date(2026, 4, 15),
  ];
  for (const { id: empId } of created) {
    for (const date of prevWeekdays) {
      const d = attData(date, 8, 0, 17, 0, null);
      await prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: empId, date } },
        update: d, create: { employeeId: empId, date, ...d },
      });
    }
  }

  // Employees 0,1,2 (Emnase, Castillo, Veloso): Saturday May 10 rest day
  for (const { id: empId } of [created[0], created[1], created[2]]) {
    const date = new Date(2026, 4, 10);
    const d = attData(date, 8, 0, 17, 0, "RD");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employees 3,4 (Domingo, Espanola): Thursday May 7 with 2h OT (overrides regular day above)
  for (const { id: empId } of [created[3], created[4]]) {
    const date = new Date(2026, 4, 7);
    const d = attData(date, 8, 0, 19, 0, "R_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Current cutoff: May 16–31, 2026 — weekdays
  const currWeekdays = [
    new Date(2026, 4, 18), new Date(2026, 4, 19), new Date(2026, 4, 20),
    new Date(2026, 4, 21), new Date(2026, 4, 22),
    new Date(2026, 4, 25), new Date(2026, 4, 26), new Date(2026, 4, 27),
    new Date(2026, 4, 28), new Date(2026, 4, 29),
  ];
  for (const { id: empId } of created) {
    for (const date of currWeekdays) {
      const d = attData(date, 8, 0, 17, 0, null);
      await prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: empId, date } },
        update: d, create: { employeeId: empId, date, ...d },
      });
    }
  }

  // Employees 0,1 (Emnase, Castillo): Wednesday May 20 with 1h OT (overrides regular day)
  for (const { id: empId } of [created[0], created[1]]) {
    const date = new Date(2026, 4, 20);
    const d = attData(date, 8, 0, 18, 0, "R_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employees 2,3 (Veloso, Domingo): Saturday May 23, 4h rest day (no OT)
  for (const { id: empId } of [created[2], created[3]]) {
    const date = new Date(2026, 4, 23);
    const d = attData(date, 8, 0, 13, 0, "RD");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  // Employee 4 (Espanola): Saturday May 23, 10h clock (08:00-18:00) → 9h after lunch → 1h RD_OT
  {
    const { id: empId } = created[4];
    const date = new Date(2026, 4, 23);
    const d = attData(date, 8, 0, 18, 0, "RD_OT");
    await prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId: empId, date } },
      update: d, create: { employeeId: empId, date, ...d },
    });
  }

  console.log(`\nSeeded company "${company.name}" with ${EMPLOYEES.length} employees.\n`);
  console.log("=== CREDENTIALS ===");
  console.log("ADMIN:  owner@demo.ph / demo1234");
  console.log("\nEMPLOYEE PORTAL:");
  for (const { emp } of created) {
    console.log(`  ${emailFor(emp)}  /  demo1234`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
