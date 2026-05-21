import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  // Demo owner account
  const company = await prisma.company.upsert({
    where: { id: "demo-co" },
    update: {},
    create: { id: "demo-co", name: "Kape at Pandesal Co.", tin: "123-456-789-000", address: "123 Rizal Ave, Makati City" },
  });

  const password = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "owner@demo.ph" },
    update: { password, companyId: company.id },
    create: { email: "owner@demo.ph", name: "Demo Owner", password, role: "OWNER", companyId: company.id },
  });

  // Wipe existing employees for idempotent seeds
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.employee.deleteMany();

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

    await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber: `EMP-${String(i).padStart(4, "0")}`,
        firstName: first,
        middleName: middle,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}@kapeatpandesal.ph`,
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
  }

  console.log(`Seeded company "${company.name}" with 15 employees.`);
  console.log("Login: owner@demo.ph / demo1234");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
