/* eslint-disable no-console */
/**
 * Seed: full dataset extracted from the DAR Project Planning Workbook v2
 * plus enterprise reference data (roles, permissions, users, warehouse).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (s: string) => new Date(s);

// ---------------------------------------------------------------------------
// RBAC matrix
// ---------------------------------------------------------------------------
const RESOURCES = [
  'users', 'roles', 'settings', 'parties', 'projects', 'schedule', 'hr', 'payroll',
  'finance', 'invoices', 'payments', 'boq', 'estimation', 'procurement', 'inventory',
  'equipment', 'risks', 'issues', 'variations', 'quality', 'safety', 'documents',
  'reports', 'dashboard', 'audit', 'ai',
];
const ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export'];

const ROLE_DEFS: Record<string, { desc: string; grants: string[] | 'ALL' }> = {
  ADMIN: { desc: 'Full system administrator', grants: 'ALL' },
  PROJECT_MANAGER: {
    desc: 'Manages projects, schedule, site operations and approvals',
    grants: [
      'projects:*', 'schedule:*', 'risks:*', 'issues:*', 'variations:*', 'quality:*', 'safety:*',
      'documents:*', 'reports:*', 'dashboard:read', 'parties:read', 'hr:read', 'equipment:*',
      'inventory:*', 'procurement:*', 'finance:read', 'invoices:read', 'boq:read', 'estimation:read',
      'ai:read', 'ai:create',
    ],
  },
  QUANTITY_SURVEYOR: {
    desc: 'BOQ, estimation, variations, procurement and cost control',
    grants: [
      'boq:*', 'estimation:*', 'variations:*', 'procurement:*', 'finance:*', 'inventory:read',
      'projects:read', 'schedule:read', 'reports:*', 'dashboard:read', 'parties:*', 'documents:read',
      'invoices:read', 'ai:read', 'ai:create',
    ],
  },
  FINANCE_CONTROLLER: {
    desc: 'Finance, invoicing, payments, payroll',
    grants: [
      'finance:*', 'invoices:*', 'payments:*', 'payroll:*', 'reports:*', 'dashboard:read',
      'projects:read', 'parties:read', 'audit:read', 'hr:read', 'ai:read', 'ai:create',
    ],
  },
  SITE_ENGINEER: {
    desc: 'Site execution: daily reports, progress, materials, quality & safety',
    grants: [
      'schedule:read', 'schedule:update', 'reports:create', 'reports:read', 'reports:update',
      'inventory:read', 'inventory:create', 'quality:*', 'safety:*', 'documents:*',
      'projects:read', 'dashboard:read', 'equipment:read', 'equipment:update', 'hr:read',
      'issues:*', 'ai:read', 'ai:create',
    ],
  },
  VIEWER: {
    desc: 'Read-only access (client / stakeholder portal)',
    grants: RESOURCES.filter((r) => !['users', 'roles', 'settings', 'audit'].includes(r)).map((r) => `${r}:read`),
  },
};

async function main() {
  console.log('🌱 Seeding DAR Construction ERP…');

  // ---- permissions ----
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        create: { resource, action },
        update: {},
      });
    }
  }
  const allPermissions = await prisma.permission.findMany();
  const permId = (r: string, a: string) => allPermissions.find((p) => p.resource === r && p.action === a)?.id;

  // ---- roles ----
  const roles: Record<string, string> = {};
  for (const [name, def] of Object.entries(ROLE_DEFS)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, description: def.desc, isSystem: true },
      update: { description: def.desc },
    });
    roles[name] = role.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const grants =
      def.grants === 'ALL'
        ? allPermissions.map((p) => p.id)
        : def.grants.flatMap((g) => {
            const [r, a] = g.split(':');
            return a === '*' ? ACTIONS.map((act) => permId(r, act)).filter(Boolean) : [permId(r, a)].filter(Boolean);
          });
    await prisma.rolePermission.createMany({
      data: [...new Set(grants)].map((permissionId) => ({ roleId: role.id, permissionId: permissionId! })),
      skipDuplicates: true,
    });
  }

  // ---- company ----
  const company = await prisma.company.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'DAR Trading & Contracting',
      nameAr: 'دار للتجارة والمقاولات',
      nameFr: 'DAR Négoce & Entreprise Générale',
      legalName: 'DAR Trading & Contracting S.A.R.L.',
      address: 'Beirut Central District',
      city: 'Beirut',
      country: 'Lebanon',
      email: 'info@dar-tc.com',
      baseCurrency: 'USD',
      vatRate: 0.11,
    },
    update: {},
  });

  // ---- users ----
  const pw = await bcrypt.hash('Admin@123!', 12);
  const usersSeed = [
    { email: 'admin@dar-tc.com', firstName: 'System', lastName: 'Administrator', role: 'ADMIN' },
    { email: 'john.smith@dar-tc.com', firstName: 'John', lastName: 'Smith', role: 'PROJECT_MANAGER' },
    { email: 'ahmed.hassan@dar-tc.com', firstName: 'Ahmed', lastName: 'Hassan', role: 'QUANTITY_SURVEYOR' },
    { email: 'sarah.johnson@dar-tc.com', firstName: 'Sarah', lastName: 'Johnson', role: 'FINANCE_CONTROLLER' },
    { email: 'michael.brown@dar-tc.com', firstName: 'Michael', lastName: 'Brown', role: 'SITE_ENGINEER' },
    { email: 'client@abc-realestate.com', firstName: 'Client', lastName: 'ABC Real Estate', role: 'VIEWER' },
  ];
  const users: Record<string, string> = {};
  for (const u of usersSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email, firstName: u.firstName, lastName: u.lastName,
        companyId: company.id, roleId: roles[u.role], passwordHash: pw,
      },
      update: { roleId: roles[u.role] },
    });
    users[u.email] = user.id;
  }

  // ---- employees (Labour Cost sheet) ----
  // otRate from workbook; dailyRate/26≈hourly, OT = 1.5×hourly
  const employeesSeed: Array<[string, string, string, string, number, number, string | null, boolean]> = [
    // code, name, position, department, dailyRate, otRate, trade, subcontracted
    ['EMP-001', 'John Smith', 'Project Manager', 'Management', 450, 84.38, null, false],
    ['EMP-002', 'Michael Brown', 'Site Engineer', 'Engineering', 320, 60, null, false],
    ['EMP-003', 'Ahmed Hassan', 'Quantity Surveyor', 'Commercial', 280, 52.5, null, false],
    ['EMP-004', 'Sarah Johnson', 'Financial Controller', 'Finance', 300, 56.25, null, false],
    ['EMP-005', 'Ali Hassan', 'Site Supervisor', 'Operations', 180, 33.75, null, false],
    ['EMP-006', 'Karim Nasser', 'Foreman', 'Operations', 120, 22.5, null, false],
    ['EMP-007', 'Walid Azar', 'Foreman', 'Operations', 120, 22.5, null, false],
    ['EMP-008', 'Worker A', 'Mason', 'Labour', 65, 12.19, 'Mason', false],
    ['EMP-009', 'Worker B', 'Mason', 'Labour', 65, 12.19, 'Mason', false],
    ['EMP-010', 'Worker C', 'Electrician', 'Labour', 75, 14.06, 'Electrician', false],
    ['EMP-011', 'Worker D', 'Plumber', 'Labour', 75, 14.06, 'Plumber', false],
    ['EMP-012', 'Worker E', 'Labourer', 'Labour', 45, 8.44, 'Labourer', false],
    ['EMP-013', 'Worker F', 'Labourer', 'Labour', 45, 8.44, 'Labourer', false],
    ['EMP-014', 'Worker G', 'Labourer', 'Labour', 45, 8.44, 'Labourer', false],
    ['EMP-015', 'Subcontractor A', 'MEP Subcontractor', 'Subcontract', 0, 0, 'MEP', true],
    ['EMP-016', 'Subcontractor B', 'Finishing Sub', 'Subcontract', 0, 0, 'Finishing', true],
  ];
  const employees: Record<string, string> = {};
  for (const [code, name, position, department, dailyRate, otRate, trade, sub] of employeesSeed) {
    const [firstName, ...rest] = name.split(' ');
    const emp = await prisma.employee.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: {
        companyId: company.id, code, firstName, lastName: rest.join(' ') || '-',
        position, department, dailyRate, otRate, trade, isSubcontracted: sub,
        hireDate: D('2024-06-01'),
      },
      update: {},
    });
    employees[name] = emp.id;
  }

  // ---- parties: client + suppliers (Material Tracker / Procurement sheets) ----
  const partiesSeed: Array<[string, string, string]> = [
    ['CLT-001', 'ABC Real Estate Development', 'CLIENT'],
    ['CON-001', 'Beirut Engineering Consultants', 'CONSULTANT'],
    ['SUP-001', 'Beirut Concrete Supply', 'SUPPLIER'],
    ['SUP-002', 'Lebanon Steel Co', 'SUPPLIER'],
    ['SUP-003', 'Beirut Block Co', 'SUPPLIER'],
    ['SUP-004', 'Tile Co Lebanon', 'SUPPLIER'],
    ['SUP-005', 'Pipe Supply Co', 'SUPPLIER'],
    ['SUP-006', 'Electric Supply', 'SUPPLIER'],
    ['SUP-007', 'Plastering Co', 'SUPPLIER'],
    ['SUP-008', 'Insul Supply', 'SUPPLIER'],
    ['SUP-009', 'Timber Co Lebanon', 'SUPPLIER'],
    ['SUP-010', 'Waterproof Co', 'SUPPLIER'],
    ['SUP-011', 'Ceiling Co', 'SUPPLIER'],
    ['SUP-012', 'Paint Lebanon', 'SUPPLIER'],
    ['SUP-013', 'Agg Supply', 'SUPPLIER'],
    ['SUP-014', 'Heavy Equip Co', 'SUPPLIER'],
    ['SUP-015', 'Heavy Lift Co', 'SUPPLIER'],
    ['SUP-016', 'Power Supply Co', 'SUPPLIER'],
    ['SUP-017', 'Scaffold Co', 'SUPPLIER'],
    ['SUP-018', 'Lift Co', 'SUPPLIER'],
    ['SUP-019', 'Transport Co', 'SUPPLIER'],
    ['SUB-001', 'MEP Solutions', 'SUBCONTRACTOR'],
    ['SUB-002', 'Electro Lebanon', 'SUBCONTRACTOR'],
    ['SUB-003', 'HVAC Lebanon', 'SUBCONTRACTOR'],
  ];
  const parties: Record<string, string> = {};
  for (const [code, name, type] of partiesSeed) {
    const party = await prisma.party.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: {
        companyId: company.id, code, name, type: type as any,
        city: 'Beirut', country: 'Lebanon', rating: 3 + Math.floor(Math.random() * 0), // deterministic 3
        paymentTermsDays: 30,
      },
      update: {},
    });
    parties[name] = party.id;
  }
  await prisma.party.update({ where: { id: parties['Lebanon Steel Co'] }, data: { rating: 4 } });
  await prisma.party.update({ where: { id: parties['Tile Co Lebanon'] }, data: { rating: 2 } });

  // ---- project (Project Info sheet) ----
  const project = await prisma.project.upsert({
    where: { companyId_code: { companyId: company.id, code: 'DAR-CTR-2025-001' } },
    create: {
      companyId: company.id,
      code: 'DAR-CTR-2025-001',
      name: 'Construction of a Commercial Office Building',
      nameAr: 'إنشاء مبنى مكاتب تجاري',
      nameFr: 'Construction d’un immeuble de bureaux commercial',
      clientId: parties['ABC Real Estate Development'],
      consultantId: parties['Beirut Engineering Consultants'],
      contractNumber: 'DAR-CTR-2025-001',
      location: 'Beirut, Lebanon',
      city: 'Beirut',
      country: 'Lebanon',
      status: 'ACTIVE',
      startDate: D('2025-01-01'),
      finishDate: D('2025-12-31'),
      currency: 'USD',
      contractValue: 100000,
      vatRate: 0.11,
      retentionRate: 0.10,
      advanceRate: 0.15,
      directCost: 75000,
      indirectCost: 10000,
      contingency: 5000,
      progressPct: 0.48,
    },
    update: {},
  });
  console.log(`  ✔ Project ${project.code}`);

  // project team
  for (const [email, role] of [
    ['john.smith@dar-tc.com', 'PROJECT_MANAGER'],
    ['michael.brown@dar-tc.com', 'SITE_ENGINEER'],
    ['ahmed.hassan@dar-tc.com', 'QUANTITY_SURVEYOR'],
    ['sarah.johnson@dar-tc.com', 'FINANCE_CONTROLLER'],
  ] as const) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: users[email] } },
      create: { projectId: project.id, userId: users[email], role },
      update: {},
    });
  }

  // ---- milestones (Dashboard sheet) ----
  await prisma.milestone.deleteMany({ where: { projectId: project.id } });
  await prisma.milestone.createMany({
    data: [
      { projectId: project.id, name: 'Structural Concrete Complete', targetDate: D('2025-07-15'), progressPct: 0.75, status: 'IN_PROGRESS', sortOrder: 1 },
      { projectId: project.id, name: 'MEP Rough-In Complete', targetDate: D('2025-09-30'), progressPct: 0.25, status: 'IN_PROGRESS', sortOrder: 2 },
      { projectId: project.id, name: 'Internal Finishes Complete', targetDate: D('2025-11-30'), progressPct: 0, status: 'NOT_STARTED', sortOrder: 3 },
      { projectId: project.id, name: 'Practical Completion', targetDate: D('2025-12-31'), progressPct: 0, status: 'NOT_STARTED', sortOrder: 4 },
    ],
  });

  // ---- WBS + tasks (WBS & Task Schedule sheets) ----
  // [wbsCode, name, phase, responsible, start, finish, dur, budget, status, progress, priority]
  type Row = [string, string, string, string, string, string, number, number, string, number, string];
  const rows: Row[] = [
    ['1.0', 'SITE PREPARATION', 'Phase 1', 'John Smith', '2025-01-01', '2025-01-15', 14, 3500, 'COMPLETED', 1, 'CRITICAL'],
    ['1.1', 'Site mobilisation', 'Phase 1', 'Michael Brown', '2025-01-01', '2025-01-06', 5, 800, 'COMPLETED', 1, 'CRITICAL'],
    ['1.2', 'Hoarding & fencing', 'Phase 1', 'Michael Brown', '2025-01-06', '2025-01-10', 4, 600, 'COMPLETED', 1, 'CRITICAL'],
    ['1.3', 'Temporary facilities', 'Phase 1', 'John Smith', '2025-01-06', '2025-01-13', 7, 900, 'COMPLETED', 1, 'CRITICAL'],
    ['1.4', 'Site survey & setting out', 'Phase 1', 'Ahmed Hassan', '2025-01-01', '2025-01-06', 5, 700, 'COMPLETED', 1, 'CRITICAL'],
    ['1.5', 'Demolition & clearance', 'Phase 1', 'Michael Brown', '2025-01-08', '2025-01-15', 7, 500, 'COMPLETED', 1, 'CRITICAL'],
    ['2.0', 'EXCAVATION', 'Phase 1', 'John Smith', '2025-01-15', '2025-02-05', 21, 5200, 'COMPLETED', 1, 'CRITICAL'],
    ['2.1', 'Bulk excavation', 'Phase 1', 'Michael Brown', '2025-01-15', '2025-01-29', 14, 3000, 'COMPLETED', 1, 'CRITICAL'],
    ['2.2', 'Disposal of spoil', 'Phase 1', 'Michael Brown', '2025-01-22', '2025-01-29', 7, 1200, 'COMPLETED', 1, 'CRITICAL'],
    ['2.3', 'Reduced level dig', 'Phase 1', 'Michael Brown', '2025-01-29', '2025-02-05', 7, 1000, 'COMPLETED', 1, 'CRITICAL'],
    ['3.0', 'FOUNDATIONS', 'Phase 2', 'John Smith', '2025-02-05', '2025-03-05', 28, 9000, 'COMPLETED', 1, 'CRITICAL'],
    ['3.1', 'Pile cap excavation', 'Phase 2', 'Michael Brown', '2025-02-05', '2025-02-15', 10, 2500, 'COMPLETED', 1, 'CRITICAL'],
    ['3.2', 'Piling works', 'Phase 2', 'Subcontractor A', '2025-02-12', '2025-02-26', 14, 4000, 'COMPLETED', 1, 'CRITICAL'],
    ['3.3', 'Ground beams', 'Phase 2', 'Michael Brown', '2025-02-26', '2025-03-05', 7, 1500, 'COMPLETED', 1, 'CRITICAL'],
    ['3.4', 'Waterproofing', 'Phase 2', 'Michael Brown', '2025-03-02', '2025-03-09', 7, 1000, 'COMPLETED', 1, 'CRITICAL'],
    ['4.0', 'CONCRETE STRUCTURE', 'Phase 2', 'John Smith', '2025-03-05', '2025-04-30', 56, 18000, 'COMPLETED', 1, 'CRITICAL'],
    ['4.1', 'Columns - G/F', 'Phase 2', 'Michael Brown', '2025-03-05', '2025-03-19', 14, 3500, 'COMPLETED', 1, 'CRITICAL'],
    ['4.2', 'Beams & slabs - G/F', 'Phase 2', 'Michael Brown', '2025-03-19', '2025-04-02', 14, 4500, 'COMPLETED', 1, 'CRITICAL'],
    ['4.3', 'Columns - 1st Floor', 'Phase 2', 'Michael Brown', '2025-04-02', '2025-04-16', 14, 3500, 'COMPLETED', 1, 'CRITICAL'],
    ['4.4', 'Beams & slabs - 1st Fl', 'Phase 2', 'Michael Brown', '2025-04-16', '2025-04-30', 14, 4500, 'COMPLETED', 1, 'CRITICAL'],
    ['4.5', 'Roof slab', 'Phase 2', 'Michael Brown', '2025-04-30', '2025-05-14', 14, 2000, 'COMPLETED', 1, 'CRITICAL'],
    ['5.0', 'MASONRY & BLOCK WORKS', 'Phase 3', 'John Smith', '2025-04-30', '2025-06-11', 42, 7000, 'COMPLETED', 1, 'HIGH'],
    ['5.1', 'External block walls', 'Phase 3', 'Michael Brown', '2025-04-30', '2025-05-21', 21, 3000, 'COMPLETED', 1, 'HIGH'],
    ['5.2', 'Internal partitions', 'Phase 3', 'Michael Brown', '2025-05-14', '2025-06-04', 21, 2500, 'COMPLETED', 1, 'HIGH'],
    ['5.3', 'Parapet walls', 'Phase 3', 'Michael Brown', '2025-05-28', '2025-06-11', 14, 1500, 'COMPLETED', 1, 'HIGH'],
    ['6.0', 'ROOFING', 'Phase 3', 'John Smith', '2025-06-11', '2025-07-02', 21, 4000, 'IN_PROGRESS', 0.6, 'MEDIUM'],
    ['6.1', 'Roof insulation', 'Phase 3', 'Michael Brown', '2025-06-11', '2025-06-21', 10, 1500, 'COMPLETED', 1, 'MEDIUM'],
    ['6.2', 'Waterproof membrane', 'Phase 3', 'Michael Brown', '2025-06-18', '2025-06-28', 10, 1500, 'COMPLETED', 1, 'MEDIUM'],
    ['6.3', 'Roof tiling', 'Phase 3', 'Michael Brown', '2025-06-25', '2025-07-05', 10, 1000, 'IN_PROGRESS', 0.6, 'MEDIUM'],
    ['7.0', 'MEP — PLUMBING', 'Phase 3', 'John Smith', '2025-05-14', '2025-07-16', 63, 6000, 'IN_PROGRESS', 0.6, 'HIGH'],
    ['7.1', 'Drainage rough-in', 'Phase 3', 'Subcontractor A', '2025-05-14', '2025-06-04', 21, 2000, 'COMPLETED', 1, 'HIGH'],
    ['7.2', 'Water supply rough-in', 'Phase 3', 'Subcontractor A', '2025-06-04', '2025-06-25', 21, 2000, 'COMPLETED', 1, 'HIGH'],
    ['7.3', 'Fixtures & fittings', 'Phase 4', 'Subcontractor A', '2025-08-27', '2025-09-17', 21, 2000, 'NOT_STARTED', 0, 'HIGH'],
    ['8.0', 'MEP — ELECTRICAL', 'Phase 3', 'John Smith', '2025-05-21', '2025-07-30', 70, 8000, 'IN_PROGRESS', 0.6, 'HIGH'],
    ['8.1', 'Conduit & cable trays', 'Phase 3', 'Subcontractor A', '2025-05-21', '2025-06-18', 28, 2500, 'COMPLETED', 1, 'HIGH'],
    ['8.2', 'Main cable pulling', 'Phase 3', 'Subcontractor A', '2025-06-18', '2025-07-09', 21, 2000, 'IN_PROGRESS', 0.6, 'HIGH'],
    ['8.3', 'DB boards & panels', 'Phase 4', 'Subcontractor A', '2025-08-27', '2025-09-17', 21, 2000, 'NOT_STARTED', 0, 'HIGH'],
    ['8.4', 'Light fittings', 'Phase 4', 'Subcontractor A', '2025-09-10', '2025-09-24', 14, 1500, 'NOT_STARTED', 0, 'HIGH'],
    ['9.0', 'MEP — HVAC', 'Phase 3', 'John Smith', '2025-05-28', '2025-07-30', 63, 5000, 'IN_PROGRESS', 0.6, 'HIGH'],
    ['9.1', 'Ductwork installation', 'Phase 3', 'Subcontractor A', '2025-05-28', '2025-06-25', 28, 2000, 'COMPLETED', 1, 'HIGH'],
    ['9.2', 'FCU units', 'Phase 4', 'Subcontractor A', '2025-08-13', '2025-09-03', 21, 1500, 'NOT_STARTED', 0, 'HIGH'],
    ['9.3', 'AHU & chillers', 'Phase 4', 'Subcontractor A', '2025-08-27', '2025-09-17', 21, 1500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.0', 'INTERNAL FINISHES', 'Phase 4', 'John Smith', '2025-07-16', '2025-10-08', 84, 9500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.1', 'Screeds', 'Phase 4', 'Michael Brown', '2025-07-16', '2025-07-30', 14, 1000, 'NOT_STARTED', 0, 'HIGH'],
    ['10.2', 'Plastering', 'Phase 4', 'Michael Brown', '2025-07-30', '2025-08-27', 28, 2500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.3', 'Floor tiling', 'Phase 4', 'Michael Brown', '2025-08-27', '2025-09-24', 28, 2500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.4', 'Wall tiling (wet areas)', 'Phase 4', 'Michael Brown', '2025-09-10', '2025-10-01', 21, 1500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.5', 'Suspended ceilings', 'Phase 4', 'Subcontractor B', '2025-09-17', '2025-10-08', 21, 1500, 'NOT_STARTED', 0, 'HIGH'],
    ['10.6', 'Painting - internal', 'Phase 4', 'Michael Brown', '2025-10-01', '2025-10-15', 14, 500, 'NOT_STARTED', 0, 'HIGH'],
    ['11.0', 'EXTERNAL FINISHES', 'Phase 4', 'John Smith', '2025-09-03', '2025-10-15', 42, 4500, 'NOT_STARTED', 0, 'MEDIUM'],
    ['11.1', 'External cladding', 'Phase 4', 'Subcontractor B', '2025-09-03', '2025-09-24', 21, 2000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['11.2', 'External painting', 'Phase 4', 'Michael Brown', '2025-09-17', '2025-10-01', 14, 1000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['11.3', 'Glazing & curtain wall', 'Phase 4', 'Subcontractor B', '2025-09-24', '2025-10-15', 21, 1500, 'NOT_STARTED', 0, 'MEDIUM'],
    ['12.0', 'EXTERNAL WORKS', 'Phase 4', 'John Smith', '2025-10-08', '2025-11-19', 42, 3000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['12.1', 'Paving & hardstanding', 'Phase 4', 'Michael Brown', '2025-10-08', '2025-10-22', 14, 1000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['12.2', 'Drainage external', 'Phase 4', 'Michael Brown', '2025-10-15', '2025-10-29', 14, 1000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['12.3', 'Landscaping', 'Phase 4', 'Michael Brown', '2025-10-22', '2025-11-05', 14, 600, 'NOT_STARTED', 0, 'MEDIUM'],
    ['12.4', 'Security fencing', 'Phase 4', 'Michael Brown', '2025-10-29', '2025-11-12', 14, 400, 'NOT_STARTED', 0, 'MEDIUM'],
    ['13.0', 'DOORS, FRAMES & IRONMONGERY', 'Phase 4', 'John Smith', '2025-09-10', '2025-10-08', 28, 2500, 'NOT_STARTED', 0, 'MEDIUM'],
    ['13.1', 'Internal doors', 'Phase 4', 'Subcontractor B', '2025-09-10', '2025-09-24', 14, 1500, 'NOT_STARTED', 0, 'MEDIUM'],
    ['13.2', 'External doors & frames', 'Phase 4', 'Subcontractor B', '2025-09-17', '2025-10-01', 14, 1000, 'NOT_STARTED', 0, 'MEDIUM'],
    ['14.0', 'TESTING & COMMISSIONING', 'Phase 5', 'John Smith', '2025-11-05', '2025-12-03', 28, 2000, 'NOT_STARTED', 0, 'CRITICAL'],
    ['14.1', 'MEP testing', 'Phase 5', 'Subcontractor A', '2025-11-05', '2025-11-19', 14, 800, 'NOT_STARTED', 0, 'CRITICAL'],
    ['14.2', 'Structural inspection', 'Phase 5', 'Ahmed Hassan', '2025-11-05', '2025-11-12', 7, 400, 'NOT_STARTED', 0, 'CRITICAL'],
    ['14.3', 'Systems commissioning', 'Phase 5', 'Subcontractor A', '2025-11-12', '2025-11-26', 14, 500, 'NOT_STARTED', 0, 'CRITICAL'],
    ['14.4', 'Authority approvals', 'Phase 5', 'John Smith', '2025-11-12', '2025-11-26', 14, 300, 'NOT_STARTED', 0, 'CRITICAL'],
    ['15.0', 'HANDOVER & CLOSEOUT', 'Phase 5', 'John Smith', '2025-12-03', '2026-01-01', 29, 800, 'NOT_STARTED', 0, 'CRITICAL'],
    ['15.1', 'Snagging & defects', 'Phase 5', 'Michael Brown', '2025-12-03', '2025-12-17', 14, 300, 'NOT_STARTED', 0, 'CRITICAL'],
    ['15.2', 'As-built drawings', 'Phase 5', 'Ahmed Hassan', '2025-12-03', '2025-12-17', 14, 200, 'NOT_STARTED', 0, 'CRITICAL'],
    ['15.3', 'O&M manuals', 'Phase 5', 'Ahmed Hassan', '2025-12-10', '2025-12-17', 7, 150, 'NOT_STARTED', 0, 'CRITICAL'],
    ['15.4', 'Practical completion', 'Phase 5', 'John Smith', '2025-12-25', '2026-01-01', 7, 150, 'NOT_STARTED', 0, 'CRITICAL'],
  ];

  await prisma.task.deleteMany({ where: { projectId: project.id } });
  await prisma.wbsNode.deleteMany({ where: { projectId: project.id } });

  const wbsIds: Record<string, string> = {};
  const taskIdByCode: Record<number, string> = {};
  let taskCode = 0;
  let currentParent: string | null = null;

  for (const [wbsCode, name, phase, responsible, start, finish, dur, budget, status, progress, priority] of rows) {
    const isSummary = wbsCode.endsWith('.0');
    if (isSummary) {
      const node = await prisma.wbsNode.create({
        data: {
          projectId: project.id, code: wbsCode, name, phase,
          sortOrder: parseInt(wbsCode),
        },
      });
      wbsIds[wbsCode] = node.id;
      currentParent = node.id;
    }
    taskCode += 1;
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        wbsNodeId: isSummary ? wbsIds[wbsCode] : currentParent,
        code: taskCode,
        name,
        phase,
        responsibleId: employees[responsible] ?? null,
        priority: priority as any,
        status: status as any,
        plannedStart: D(start),
        plannedFinish: D(finish),
        durationDays: dur,
        progressPct: progress,
        budget,
        isSummary,
        actualStart: progress > 0 ? D(start) : null,
        actualFinish: status === 'COMPLETED' ? D(finish) : null,
      },
    });
    taskIdByCode[taskCode] = task.id;
  }

  // dependencies from Task Schedule "Dep." column: each task depends on previous ID
  const depPairs: Array<[number, number]> = [
    [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 8], [8, 9], [9, 10], [11, 12], [12, 13],
    [13, 14], [14, 15], [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [22, 23], [23, 24],
    [24, 25], [26, 27], [27, 28], [28, 29], [30, 31], [31, 32], [32, 33], [34, 35], [35, 36],
    [36, 37], [37, 38], [39, 40], [40, 41], [41, 42], [43, 44], [44, 45], [45, 46], [46, 47],
    [47, 48], [48, 49], [50, 51], [51, 52], [52, 53], [54, 55], [55, 56], [56, 57], [57, 58],
    [59, 60], [60, 61], [62, 63], [63, 64], [64, 65], [65, 66], [67, 68], [68, 69], [69, 70], [70, 71],
    // phase-level links
    [1, 7], [7, 11], [11, 16], [16, 22], [22, 26], [21, 30], [21, 34], [21, 39], [30, 43], [43, 50], [50, 54], [43, 59], [54, 62], [62, 67],
  ];
  // Derive dependency type & lag from the workbook's planned dates so the CPM
  // network reproduces the contractual programme exactly (overlaps → SS/negative lag).
  const datesByCode = new Map<number, { start: Date; finish: Date; isSummary: boolean }>();
  rows.forEach(([wbsCode, , , , start, finish], i) => {
    datesByCode.set(i + 1, { start: D(start), finish: D(finish), isSummary: wbsCode.endsWith('.0') });
  });
  const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);
  for (const [pred, succ] of depPairs) {
    if (!taskIdByCode[pred] || !taskIdByCode[succ]) continue;
    const p = datesByCode.get(pred)!;
    const s = datesByCode.get(succ)!;
    // summary → its own children start together: use SS; otherwise FS with date-derived lag
    const useSS = p.isSummary && !s.isSummary && s.start <= p.finish;
    const type = useSS ? 'SS' : 'FS';
    const lagDays = useSS ? dayDiff(s.start, p.start) : dayDiff(s.start, p.finish);
    await prisma.taskDependency.upsert({
      where: {
        predecessorId_successorId: {
          predecessorId: taskIdByCode[pred],
          successorId: taskIdByCode[succ],
        },
      },
      create: {
        predecessorId: taskIdByCode[pred],
        successorId: taskIdByCode[succ],
        type: type as any,
        lagDays,
      },
      update: { type: type as any, lagDays },
    });
  }
  console.log(`  ✔ ${rows.length} tasks + ${depPairs.length} dependencies`);

  // ---- baseline (from original plan) ----
  const allTasks = await prisma.task.findMany({ where: { projectId: project.id } });
  await prisma.baseline.deleteMany({ where: { projectId: project.id } });
  await prisma.baseline.create({
    data: {
      projectId: project.id,
      name: 'Contract Baseline Rev 0',
      isActive: true,
      tasks: {
        create: allTasks.map((t) => ({
          taskId: t.id,
          plannedStart: t.plannedStart,
          plannedFinish: t.plannedFinish,
          durationDays: t.durationDays,
          budget: t.budget,
        })),
      },
    },
  });

  // ---- cost codes + budget (Cost Control sheet) ----
  const costCodesSeed: Array<[string, string, string, number, number, number]> = [
    // code, name, category, budget, actual, forecast
    ['CC-LAB-01', 'Labour — Structural', 'LABOUR', 9500, 5800, 9508],
    ['CC-LAB-02', 'Labour — MEP', 'LABOUR', 3200, 1800, 3214],
    ['CC-LAB-03', 'Labour — Finishing', 'LABOUR', 2800, 0, 2800],
    ['CC-MAT-01', 'Materials — Structural', 'MATERIALS', 28000, 21500, 27922],
    ['CC-MAT-02', 'Materials — MEP', 'MATERIALS', 8500, 2300, 8519],
    ['CC-MAT-03', 'Materials — Finishing', 'MATERIALS', 12000, 800, 11429],
    ['CC-EQP-01', 'Equipment Hire', 'EQUIPMENT', 3500, 2100, 3500],
    ['CC-SUB-01', 'Subcontract — MEP', 'SUBCONTRACTORS', 6000, 2200, 5946],
    ['CC-SUB-02', 'Subcontract — Finishing', 'SUBCONTRACTORS', 8000, 0, 8000],
    ['CC-PRE-01', 'Preliminaries & Temp Works', 'PRELIMINARIES', 5000, 2800, 5000],
    ['CC-IND-01', 'Design & Consultancy Fees', 'INDIRECT', 2500, 1800, 2500],
    ['CC-IND-02', 'Insurance & Bonds', 'INDIRECT', 1500, 1500, 1500],
    ['CC-IND-03', 'Admin & Office', 'INDIRECT', 1000, 400, 1000],
    ['CC-CON-01', 'Contingency Reserve', 'CONTINGENCY', 5000, 0, 5000],
  ];
  await prisma.costEntry.deleteMany({ where: { projectId: project.id } });
  await prisma.budgetLine.deleteMany({ where: { projectId: project.id } });
  await prisma.costCode.deleteMany({ where: { projectId: project.id } });
  for (const [code, name, category, budget, actual, forecast] of costCodesSeed) {
    const cc = await prisma.costCode.create({
      data: { projectId: project.id, code, name, category: category as any },
    });
    await prisma.budgetLine.create({
      data: {
        projectId: project.id, costCodeId: cc.id, description: name,
        originalBudget: budget, revisedBudget: budget, forecastCost: forecast,
      },
    });
    // spread actuals across months Jan–Jun 2025
    if (actual > 0) {
      const months = [1, 2, 3, 4, 5, 6];
      const share = actual / months.length;
      for (const m of months) {
        await prisma.costEntry.create({
          data: {
            projectId: project.id, costCodeId: cc.id,
            date: new Date(Date.UTC(2025, m - 1, 25)),
            description: `${name} — actuals ${2025}-${String(m).padStart(2, '0')}`,
            amount: Math.round(share * 100) / 100,
            source: category === 'LABOUR' ? 'PAYROLL' : 'MANUAL',
          },
        });
      }
    }
  }
  console.log('  ✔ Cost codes, budget & actuals ledger');

  // ---- materials + warehouse + stock (Material Tracker sheet) ----
  const warehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WH-01' } },
    create: { companyId: company.id, code: 'WH-01', name: 'Main Site Store — Beirut', location: 'Site, Beirut' },
    update: {},
  });
  const materialsSeed: Array<[string, string, string, string, number, number, number, number]> = [
    // code, name, supplier, unit, ordered, delivered, used, unitCost
    ['MAT-001', 'Cement 50kg bags', 'Beirut Concrete Supply', 'bags', 1200, 1200, 980, 4.5],
    ['MAT-002', 'Steel rebar 12mm', 'Lebanon Steel Co', 'tons', 45, 45, 38, 850],
    ['MAT-003', 'Steel rebar 16mm', 'Lebanon Steel Co', 'tons', 30, 30, 25, 870],
    ['MAT-004', 'Concrete blocks', 'Beirut Block Co', 'm²', 2800, 2800, 1900, 8.5],
    ['MAT-005', 'Ceramic floor tiles 60x60', 'Tile Co Lebanon', 'm²', 650, 400, 0, 22],
    ['MAT-006', 'Wall tiles 30x60', 'Tile Co Lebanon', 'm²', 280, 0, 0, 18],
    ['MAT-007', 'PVC pipes 4in', 'Pipe Supply Co', 'm', 380, 380, 250, 6.2],
    ['MAT-008', 'Copper cables 10mm', 'Electric Supply', 'm', 1200, 1200, 900, 3.8],
    ['MAT-009', 'Plaster - internal', 'Plastering Co', 'bags', 3200, 0, 0, 2.1],
    ['MAT-010', 'Insulation board 50mm', 'Insul Supply', 'm²', 420, 0, 0, 12],
    ['MAT-011', 'Timber formwork', 'Timber Co Lebanon', 'm²', 800, 800, 700, 9.5],
    ['MAT-012', 'Waterproof membrane', 'Waterproof Co', 'm²', 560, 280, 0, 14],
    ['MAT-013', 'Suspended ceiling tiles', 'Ceiling Co', 'm²', 420, 0, 0, 28],
    ['MAT-014', 'Paint - internal (litre)', 'Paint Lebanon', 'litre', 1800, 0, 0, 3.5],
    ['MAT-015', 'Aggregate 20mm', 'Agg Supply', 'm³', 120, 120, 100, 35],
  ];
  for (const [code, name, supplier, unit, _ordered, delivered, used, unitCost] of materialsSeed) {
    const mat = await prisma.material.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: {
        companyId: company.id, code, name, unit, unitCost,
        defaultSupplierId: parties[supplier], category: 'Construction',
        reorderLevel: code === 'MAT-001' ? 100 : 0,
      },
      update: {},
    });
    const stock = delivered - used;
    await prisma.stockMovement.deleteMany({ where: { materialId: mat.id } });
    if (delivered > 0) {
      await prisma.stockMovement.create({
        data: {
          warehouseId: warehouse.id, materialId: mat.id, projectId: project.id,
          type: 'RECEIPT', quantity: delivered, unitCost,
          date: D('2025-03-01'), reference: 'OPENING-DELIVERIES',
        },
      });
    }
    if (used > 0) {
      await prisma.stockMovement.create({
        data: {
          warehouseId: warehouse.id, materialId: mat.id, projectId: project.id,
          type: 'ISSUE', quantity: -used, date: D('2025-06-15'), reference: 'SITE-CONSUMPTION',
        },
      });
    }
    await prisma.stockLevel.upsert({
      where: { warehouseId_materialId: { warehouseId: warehouse.id, materialId: mat.id } },
      create: { warehouseId: warehouse.id, materialId: mat.id, quantity: stock },
      update: { quantity: stock },
    });
  }
  console.log('  ✔ Materials, warehouse & stock ledger');

  // ---- purchase orders (Procurement sheet) ----
  const posSeed: Array<[string, string, string, string, string, string, number, string]> = [
    // number, description, supplier, prDate, poDate, delivery, net, status
    ['PO-2025-001', 'Cement & Aggregates', 'Beirut Concrete Supply', '2025-01-05', '2025-01-08', '2025-01-12', 5400, 'PAID'],
    ['PO-2025-002', 'Steel Rebar', 'Lebanon Steel Co', '2025-01-10', '2025-01-14', '2025-01-25', 55250, 'PAID'],
    ['PO-2025-003', 'Timber Formwork', 'Timber Co Lebanon', '2025-01-20', '2025-01-23', '2025-02-01', 7600, 'PAID'],
    ['PO-2025-004', 'Excavator Hire', 'Heavy Equip Co', '2025-01-05', '2025-01-05', '2025-01-06', 1800, 'PAID'],
    ['PO-2025-005', 'Concrete Blocks', 'Beirut Block Co', '2025-03-01', '2025-03-04', '2025-03-10', 23800, 'PAID'],
    ['PO-2025-006', 'MEP Subcontract - Plumbing', 'MEP Solutions', '2025-04-01', '2025-04-05', '2025-04-15', 18000, 'PARTIALLY_PAID'],
    ['PO-2025-007', 'MEP Subcontract - Electrical', 'Electro Lebanon', '2025-04-01', '2025-04-05', '2025-04-15', 22000, 'PARTIALLY_PAID'],
    ['PO-2025-008', 'Ceramic Floor Tiles', 'Tile Co Lebanon', '2025-07-01', '2025-07-05', '2025-07-20', 14300, 'APPROVED'],
    ['PO-2025-009', 'Scaffolding Hire', 'Scaffold Co', '2025-02-01', '2025-02-01', '2025-02-02', 3150, 'PAID'],
    ['PO-2025-010', 'Waterproof Membrane', 'Waterproof Co', '2025-05-01', '2025-05-04', '2025-05-14', 3920, 'PAID'],
    ['PO-2025-011', 'HVAC Equipment', 'HVAC Lebanon', '2025-07-15', '2025-07-20', '2025-08-01', 19500, 'APPROVED'],
    ['PO-2025-012', 'Suspended Ceilings', 'Ceiling Co', '2025-09-01', '2025-09-05', '2025-09-20', 11760, 'DRAFT'],
  ];
  await prisma.supplierPayment.deleteMany({});
  await prisma.purchaseOrder.deleteMany({ where: { projectId: project.id } });
  for (const [number, description, supplier, prDate, poDate, delivery, net, status] of posSeed) {
    const vat = Math.round(net * 0.11 * 100) / 100;
    const po = await prisma.purchaseOrder.create({
      data: {
        projectId: project.id, supplierId: parties[supplier], number, description,
        prDate: D(prDate), poDate: D(poDate), expectedDelivery: D(delivery),
        netAmount: net, vatAmount: vat, totalAmount: net + vat, status: status as any,
      },
    });
    if (status === 'PAID') {
      await prisma.supplierPayment.create({
        data: {
          supplierId: parties[supplier], purchaseOrderId: po.id,
          date: new Date(D(delivery).getTime() + 30 * 86_400_000),
          amount: net + vat, method: 'BANK_TRANSFER', reference: `PMT-${number}`,
        },
      });
    } else if (status === 'PARTIALLY_PAID') {
      await prisma.supplierPayment.create({
        data: {
          supplierId: parties[supplier], purchaseOrderId: po.id,
          date: D('2025-06-01'), amount: Math.round((net + vat) * 0.5 * 100) / 100,
          method: 'BANK_TRANSFER', reference: `PMT-${number}-1`,
        },
      });
    }
  }
  console.log('  ✔ Purchase orders & supplier payments');

  // ---- client invoices (Weekly Report: invoiced 35,000 / received 31,500) ----
  await prisma.invoice.deleteMany({ where: { projectId: project.id } });
  const invoicesSeed: Array<[string, string, string, number, string, number]> = [
    // number, issue, due, net, status, received
    ['INV-001', '2025-01-31', '2025-03-02', 13500, 'PAID', 13500],
    ['INV-002', '2025-03-31', '2025-04-30', 18000, 'PAID', 18000],
    ['INV-003', '2025-07-31', '2025-08-30', 3500, 'OVERDUE', 0],
  ];
  for (const [number, issue, due, net, status, received] of invoicesSeed) {
    // workbook receipts are net-of-adjustments; keep invoice simple: total = net here
    const inv = await prisma.invoice.create({
      data: {
        projectId: project.id, clientId: parties['ABC Real Estate Development'],
        number, description: `Interim payment certificate ${number}`,
        issueDate: D(issue), dueDate: D(due),
        netAmount: net, vatAmount: 0, retentionAmount: 0, advanceRecovery: 0,
        totalAmount: net, status: status as any,
      },
    });
    if (received > 0) {
      await prisma.paymentReceipt.create({
        data: { invoiceId: inv.id, date: new Date(D(due).getTime() - 5 * 86_400_000), amount: received, method: 'BANK_TRANSFER' },
      });
    }
  }

  // ---- cash flow forecast lines (Cash Flow sheet) ----
  const cf: Record<string, number[]> = {
    INCOME_INVOICES: [0, 13500, 0, 18000, 0, 0, 0, 22500, 0, 0, 19800, 0],
    INCOME_ADVANCE: [15000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    INCOME_RETENTION: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10000],
    EXP_LABOUR: [3200, 8900, 6400, 9200, 7800, 5200, 4100, 3800, 6200, 7100, 6800, 4300],
    EXP_MATERIALS: [1800, 4200, 3600, 5100, 4400, 2800, 2200, 1900, 3400, 3900, 3700, 2400],
    EXP_SUBCONTRACT: [0, 0, 800, 1200, 3200, 2800, 1800, 1200, 2400, 2800, 2200, 800],
    EXP_EQUIPMENT: [400, 620, 580, 680, 520, 380, 310, 290, 480, 520, 510, 330],
    EXP_INDIRECT: [800, 900, 900, 900, 900, 800, 800, 800, 900, 900, 900, 800],
  };
  await prisma.cashflowLine.deleteMany({ where: { projectId: project.id } });
  for (const [category, values] of Object.entries(cf)) {
    for (let m = 0; m < 12; m++) {
      await prisma.cashflowLine.create({
        data: {
          projectId: project.id, year: 2025, month: m + 1, category,
          isIncome: category.startsWith('INCOME'),
          planned: values[m],
          actual: m < 6 ? values[m] : 0, // actuals through June
        },
      });
    }
  }
  console.log('  ✔ Cash flow forecast (12 months × 8 categories)');

  // ---- equipment (Equipment Tracker sheet) ----
  const equipmentSeed: Array<[string, string, string, string, number, number, number, string]> = [
    // code, name, owner, ownership, rate, daysPlanned, daysUsed, status
    ['EQP-001', 'Excavator CAT 320', 'Heavy Equip Co', 'HIRED', 180, 14, 14, 'RETURNED'],
    ['EQP-002', 'Concrete Mixer 500L', '', 'OWNED', 60, 21, 14, 'IN_USE'],
    ['EQP-003', 'Mobile Crane 25T', 'Heavy Lift Co', 'HIRED', 280, 42, 28, 'IN_USE'],
    ['EQP-004', 'Generator 100kVA', 'Power Supply Co', 'HIRED', 90, 84, 84, 'RETURNED'],
    ['EQP-005', 'Scaffolding System', 'Scaffold Co', 'HIRED', 45, 105, 84, 'IN_USE'],
    ['EQP-006', 'Boom Lift 15m', 'Lift Co', 'HIRED', 160, 28, 14, 'IN_USE'],
    ['EQP-007', 'Vibrator/Poker', '', 'OWNED', 20, 42, 28, 'IN_USE'],
    ['EQP-008', 'Dump Truck 10T', 'Transport Co', 'HIRED', 140, 21, 14, 'IN_USE'],
    ['EQP-009', 'Water Pump', '', 'OWNED', 15, 42, 28, 'IN_USE'],
    ['EQP-010', 'Air Compressor', '', 'OWNED', 25, 28, 14, 'IN_USE'],
  ];
  for (const [code, name, owner, ownership, rate, daysPlanned, daysUsed, status] of equipmentSeed) {
    const eq = await prisma.equipment.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      create: {
        companyId: company.id, code, name, type: name.split(' ')[0],
        ownership: ownership as any, ownerId: owner ? parties[owner] : null,
        dailyRate: rate, status: status as any,
      },
      update: {},
    });
    await prisma.equipmentAssignment.deleteMany({ where: { equipmentId: eq.id } });
    await prisma.equipmentAssignment.create({
      data: {
        equipmentId: eq.id, projectId: project.id,
        startDate: D('2025-01-15'), daysPlanned, daysUsed,
      },
    });
    // preventive maintenance for owned plant
    if (ownership === 'OWNED') {
      await prisma.maintenance.create({
        data: {
          equipmentId: eq.id, type: 'PREVENTIVE', status: 'SCHEDULED',
          scheduledAt: D('2026-08-01'), description: `Routine service — ${name}`, intervalDays: 90,
        },
      });
    }
  }
  console.log('  ✔ Equipment fleet & preventive maintenance');

  // ---- risks (Risk Register sheet) ----
  const risksSeed: Array<[string, string, string, string, string, string, string]> = [
    ['Weather delays during concrete pours', 'Schedule', 'HIGH', 'HIGH', 'Project Manager', 'Schedule 10% buffer; monitor 7-day forecast before major pours', 'MONITOR'],
    ['Subcontractor insolvency / non-performance', 'Commercial', 'MEDIUM', 'HIGH', 'John Smith', 'Vet subcontractors; hold 10% retention; maintain backup list', 'ACTIVE'],
    ['Material price escalation — steel', 'Financial', 'HIGH', 'MEDIUM', 'Ahmed Hassan', 'Fix prices in contracts; purchase key materials early', 'CLOSED'],
    ['Permit approval delay', 'Regulatory', 'MEDIUM', 'HIGH', 'John Smith', 'Submit all applications with 4-week buffer; assign dedicated approvals resource', 'MONITOR'],
    ['Site access restriction', 'Operations', 'LOW', 'MEDIUM', 'Michael Brown', 'Agree access windows with client; document in contract', 'CLOSED'],
    ['Labour shortage — skilled trades', 'Resource', 'MEDIUM', 'MEDIUM', 'John Smith', 'Pre-book skilled trades 8 weeks ahead; use sub-bench', 'MONITOR'],
    ['Design changes from client', 'Scope', 'HIGH', 'HIGH', 'John Smith', 'Freeze design at contract; process all changes via formal VO', 'ACTIVE'],
    ['Ground conditions worse than anticipated', 'Technical', 'LOW', 'HIGH', 'Michael Brown', 'Detailed soil investigation complete; contingency in budget', 'CLOSED'],
    ['Force Majeure — regional disruption', 'External', 'LOW', 'HIGH', 'John Smith', 'Contract FM clause; maintain 1-month cash reserve', 'MONITOR'],
    ['VAT regulatory change', 'Financial', 'LOW', 'MEDIUM', 'Sarah Johnson', 'Monitor MOF announcements; review contracts quarterly', 'MONITOR'],
  ];
  await prisma.risk.deleteMany({ where: { projectId: project.id } });
  const LVL: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  let riskCode = 0;
  for (const [description, category, prob, impact, _owner, mitigation, status] of risksSeed) {
    riskCode += 1;
    await prisma.risk.create({
      data: {
        projectId: project.id, code: riskCode, description, category,
        probability: prob as any, impact: impact as any,
        score: LVL[prob] * LVL[impact], mitigation, status: status as any,
      },
    });
  }

  // ---- issues (Issue Log sheet) ----
  const issuesSeed: Array<[string, string, string, string, string, string | null, string | null]> = [
    ['Concrete delivery delayed 3 days — weather', 'Procurement', 'HIGH', 'RESOLVED', '2025-02-18', '2025-02-21', 'Alternative supplier contacted; schedule recovered'],
    ['Rebar quantity shortfall 2 tons — measurement error', 'Structural', 'MEDIUM', 'RESOLVED', '2025-02-25', '2025-03-01', 'Re-measured; supplementary PO raised — PO-2025-002A'],
    ['Neighbouring property owner dispute — access', 'Legal', 'HIGH', 'IN_PROGRESS', '2025-03-05', null, 'Letter before action sent; legal review ongoing'],
    ['Generator fuel spillage — minor environmental', 'HSSE', 'HIGH', 'RESOLVED', '2025-03-12', '2025-03-13', 'Bunded area installed; incident report filed; HSSE notified'],
    ['Client requested floor plan change — north office', 'Design', 'HIGH', 'IN_PROGRESS', '2025-04-01', null, 'Formal VO-003 raised; structural impact under review'],
    ['MEP subcontractor resource gap — plumbers', 'Resource', 'MEDIUM', 'RESOLVED', '2025-04-08', '2025-04-15', 'Alternative plumbing team mobilised; 1-week delay absorbed'],
    ['Cracked slab at G/F column C4', 'Quality', 'CRITICAL', 'IN_PROGRESS', '2025-06-02', null, 'Structural engineer inspecting; repair method under review'],
    ['Invoice INV-003 outstanding — 30 days overdue', 'Commercial', 'HIGH', 'OPEN', '2025-09-01', null, 'Chasing client; escalated to John Smith'],
  ];
  await prisma.issue.deleteMany({ where: { projectId: project.id } });
  let issueCode = 0;
  for (const [description, category, priority, status, raised, resolved, resolution] of issuesSeed) {
    issueCode += 1;
    await prisma.issue.create({
      data: {
        projectId: project.id, code: issueCode, description, category,
        priority: priority as any, status: status as any,
        raisedAt: D(raised), resolvedAt: resolved ? D(resolved) : null, resolution,
      },
    });
  }

  // ---- variation orders (Variation Orders sheet) ----
  const vosSeed: Array<[string, string, string, number, string, string, string | null, number]> = [
    ['VO-001', 'Additional MEP points — open-plan office reconfiguration', '2025-03-15', 3500, 'APPROVED', 'APPROVED', '2025-04-01', 7],
    ['VO-002', 'Upgrade external cladding to aluminium composite panels', '2025-04-20', 6200, 'APPROVED', 'APPROVED', '2025-05-10', 14],
    ['VO-003', 'Floor plan revision — north office partition walls', '2025-04-01', 2800, 'SUBMITTED', 'SUBMITTED', null, 0],
    ['VO-004', 'Additional fire suppression system — server room', '2025-05-10', 4500, 'APPROVED', 'APPROVED', '2025-06-01', 10],
    ['VO-005', 'Roof garden addition — client request', '2025-07-01', 8500, 'SUBMITTED', 'SUBMITTED', null, 0],
    ['VO-006', 'Omission: Remove basement level', '2025-02-10', -12000, 'APPROVED', 'APPROVED', '2025-02-20', -21],
  ];
  await prisma.variationOrder.deleteMany({ where: { projectId: project.id } });
  for (const [number, description, submitted, net, internal, client, approval, impact] of vosSeed) {
    const vat = net > 0 ? Math.round(net * 0.11 * 100) / 100 : 0;
    await prisma.variationOrder.create({
      data: {
        projectId: project.id, number, description, submittedAt: D(submitted),
        netAmount: net, vatAmount: vat, totalAmount: net + vat,
        internalStatus: internal as any, clientStatus: client as any,
        approvalDate: approval ? D(approval) : null, programmeImpactDays: impact,
      },
    });
  }
  console.log('  ✔ Risks, issues & variation orders');

  // ---- daily site report (Daily Site Report sheet) ----
  await prisma.dailyReport.deleteMany({ where: { projectId: project.id } });
  await prisma.dailyReport.create({
    data: {
      projectId: project.id,
      date: D('2025-07-01'),
      weather: 'PARTLY_CLOUDY',
      temperature: '28°C',
      wind: 'Light',
      rainfall: '0 mm',
      preparedById: users['michael.brown@dar-tc.com'],
      approvedById: users['john.smith@dar-tc.com'],
      workCompleted:
        '• Completed concrete pour for G/F slab section C4-D4 — 45m³\n' +
        '• Placed and fixed 2.8 tons rebar — columns B3 to D3\n' +
        '• Continued blockwork — internal partitions G/F east wing\n' +
        '• Continued MEP conduit installation — 1st floor ceiling void',
      delays: 'Minor delay: concrete truck arrived 45 min late — schedule recovered.',
      safetyNotes: 'No LTI recorded today. Safety toolbox talk conducted at 07:30.',
      status: 'APPROVED',
      manpowerLines: {
        create: [
          { trade: 'Mason', planned: 8, actual: 7, absent: 1 },
          { trade: 'Carpenter', planned: 6, actual: 6, absent: 0 },
          { trade: 'Steel Fixer', planned: 5, actual: 4, absent: 1 },
          { trade: 'Electrician', planned: 4, actual: 4, absent: 0 },
          { trade: 'Plumber', planned: 3, actual: 3, absent: 0 },
          { trade: 'Labourer', planned: 12, actual: 11, absent: 1 },
          { trade: 'Supervisor', planned: 2, actual: 2, absent: 0 },
        ],
      },
      equipmentLines: {
        create: [
          { equipmentName: 'Excavator CAT 320', status: 'In Use', hoursUsed: 8, notes: 'Ongoing bulk excavation' },
          { equipmentName: 'Concrete Mixer', status: 'In Use', hoursUsed: 6, notes: 'Slab pours G/F' },
          { equipmentName: 'Generator 100kVA', status: 'Running', hoursUsed: 10, notes: 'Continuous power supply' },
          { equipmentName: 'Scaffolding System', status: 'Erected', hoursUsed: 0, notes: 'Ready for floor works' },
        ],
      },
    },
  });

  // ---- toolbox talk + resource allocations (Resource Planning sheet) ----
  await prisma.toolboxTalk.create({
    data: {
      projectId: project.id, date: D('2025-07-01'),
      topic: 'Working at height & concrete pour safety', conductedBy: 'Ali Hassan', attendees: 37,
    },
  }).catch(() => undefined);

  const allocationMatrix: Record<string, number[]> = {
    // 1 = allocated that month (Jan..Dec), from Resource Planning ●/○ matrix
    'John Smith':      [1,1,1,1,1,1,1,1,1,1,1,1],
    'Michael Brown':   [1,1,1,1,1,1,1,1,1,1,1,1],
    'Ahmed Hassan':    [1,1,1,1,1,1,1,0,0,0,1,1],
    'Sarah Johnson':   [1,1,1,1,1,1,1,1,1,1,1,1],
    'Ali Hassan':      [0,1,1,1,1,1,1,1,1,1,1,1],
    'Karim Nasser':    [0,0,1,1,1,1,1,1,1,1,1,0],
    'Walid Azar':      [0,0,0,1,1,1,1,1,1,1,0,0],
    'Subcontractor A': [0,0,1,1,1,1,1,1,1,0,0,0],
    'Subcontractor B': [0,0,0,0,0,1,1,1,1,1,1,0],
  };
  await prisma.resourceAllocation.deleteMany({ where: { projectId: project.id } });
  for (const [name, months] of Object.entries(allocationMatrix)) {
    if (!employees[name]) continue;
    for (let m = 0; m < 12; m++) {
      if (months[m]) {
        await prisma.resourceAllocation.create({
          data: { projectId: project.id, employeeId: employees[name], year: 2025, month: m + 1, utilizationPct: 1 },
        });
      }
    }
  }

  // ---- attendance sample (June 2025, drives payroll demo) ----
  await prisma.attendance.deleteMany({});
  const juneWorkdays = [...Array(30).keys()]
    .map((d) => new Date(Date.UTC(2025, 5, d + 1)))
    .filter((dt) => dt.getUTCDay() !== 0); // Sundays off
  for (const [name, id] of Object.entries(employees)) {
    if (name.startsWith('Subcontractor')) continue;
    for (const day of juneWorkdays) {
      await prisma.attendance.create({
        data: {
          employeeId: id, projectId: project.id, date: day,
          status: 'PRESENT', hoursWorked: 8,
          otHours: ['Worker E', 'Worker A'].includes(name) && day.getUTCDay() === 4 ? 2 : 0,
        },
      });
    }
  }
  console.log('  ✔ Daily report, allocations & June attendance');

  // ---- sample documents register / RFI / submittal / NCR / drawings ----
  await prisma.drawing.deleteMany({ where: { projectId: project.id } });
  await prisma.drawing.createMany({
    data: [
      { projectId: project.id, number: 'ARC-001', title: 'Ground Floor Plan', discipline: 'ARCH', revision: 'C', status: 'APPROVED', issueDate: D('2025-01-10') },
      { projectId: project.id, number: 'ARC-002', title: 'First Floor Plan', discipline: 'ARCH', revision: 'B', status: 'APPROVED', issueDate: D('2025-01-10') },
      { projectId: project.id, number: 'STR-101', title: 'Foundation Layout', discipline: 'STR', revision: 'A', status: 'APPROVED', issueDate: D('2025-01-20') },
      { projectId: project.id, number: 'MEP-201', title: 'Plumbing Riser Diagram', discipline: 'MEP', revision: 'B', status: 'UNDER_REVIEW', issueDate: D('2025-05-01') },
      { projectId: project.id, number: 'MEP-301', title: 'Electrical Single Line Diagram', discipline: 'MEP', revision: 'A', status: 'APPROVED', issueDate: D('2025-04-15') },
    ],
  });
  await prisma.rfi.deleteMany({ where: { projectId: project.id } });
  await prisma.rfi.createMany({
    data: [
      {
        projectId: project.id, number: 'RFI-001', subject: 'Column C4 reinforcement detail clarification',
        question: 'Drawing STR-101 shows conflicting rebar spacing at column C4 versus schedule. Confirm governing detail.',
        answer: 'Follow schedule Rev A: T16 @ 150mm c/c. Drawing to be revised.', status: 'ANSWERED',
        raisedAt: D('2025-06-03'), dueDate: D('2025-06-10'), answeredAt: D('2025-06-06'),
      },
      {
        projectId: project.id, number: 'RFI-002', subject: 'Roof garden waterproofing spec (VO-005)',
        question: 'Pending VO-005 approval — confirm waterproofing system specification for planted roof areas.',
        status: 'OPEN', raisedAt: D('2025-07-05'), dueDate: D('2025-07-19'),
      },
    ],
  });
  await prisma.submittal.deleteMany({ where: { projectId: project.id } });
  await prisma.submittal.createMany({
    data: [
      { projectId: project.id, number: 'SUB-001', title: 'Ceramic floor tiles 60x60 — samples', type: 'MATERIAL', status: 'APPROVED', submittedAt: D('2025-06-15'), respondedAt: D('2025-06-25') },
      { projectId: project.id, number: 'SUB-002', title: 'Suspended ceiling shop drawings', type: 'SHOP_DRAWING', status: 'UNDER_REVIEW', submittedAt: D('2025-07-01') },
    ],
  });
  await prisma.ncr.deleteMany({ where: { projectId: project.id } });
  await prisma.ncr.create({
    data: {
      projectId: project.id, number: 'NCR-001',
      description: 'Crack observed in G/F slab at column C4 exceeding 0.3mm tolerance',
      location: 'Ground floor, grid C4', raisedAt: D('2025-06-02'),
      rootCause: 'Premature formwork striking during high ambient temperature',
      correctiveAction: 'Epoxy injection repair per structural engineer method statement; review striking times',
      status: 'CORRECTIVE_ACTION',
    },
  });
  await prisma.methodStatement.deleteMany({ where: { projectId: project.id } });
  await prisma.methodStatement.createMany({
    data: [
      { projectId: project.id, number: 'MS-001', title: 'Concrete pouring & curing', activity: 'Concrete Structure', status: 'APPROVED', submittedAt: D('2025-02-20'), approvedAt: D('2025-03-01') },
      { projectId: project.id, number: 'MS-002', title: 'Slab crack epoxy injection repair', activity: 'Remedial works', status: 'SUBMITTED', submittedAt: D('2025-06-20') },
    ],
  });
  await prisma.inspectionRequest.deleteMany({ where: { projectId: project.id } });
  await prisma.inspectionRequest.createMany({
    data: [
      { projectId: project.id, number: 'IR-001', description: 'Rebar inspection — columns B3-D3 before pour', discipline: 'STR', requestedAt: D('2025-06-28'), status: 'PASSED', result: 'Approved to pour' },
      { projectId: project.id, number: 'IR-002', description: 'Roof waterproofing membrane lap joints', discipline: 'CIVIL', requestedAt: D('2025-06-26'), status: 'PASSED', result: 'Accepted' },
      { projectId: project.id, number: 'IR-003', description: 'First fix electrical containment — 1st floor', discipline: 'MEP', requestedAt: D('2025-07-08'), status: 'REQUESTED' },
    ],
  });

  // safety training
  await prisma.safetyTrainingRecord.createMany({
    data: [
      { employeeId: employees['Ali Hassan'], trainingName: 'IOSH Managing Safely', provider: 'IOSH', completedAt: D('2024-11-15'), expiresAt: D('2027-11-15') },
      { employeeId: employees['Michael Brown'], trainingName: 'First Aid at Work', provider: 'Red Cross Lebanon', completedAt: D('2025-01-20'), expiresAt: D('2026-01-20') },
      { employeeId: employees['Worker A'], trainingName: 'Working at Height', provider: 'Internal HSSE', completedAt: D('2025-02-10'), expiresAt: D('2026-02-10') },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed complete.');
  console.log('   Login: admin@dar-tc.com / Admin@123!  (also: john.smith@, ahmed.hassan@, sarah.johnson@, michael.brown@dar-tc.com)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
