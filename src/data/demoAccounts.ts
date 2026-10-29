/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Demo accounts. The server seeds these into the database on first start.
 * They have NO password in the code: the server sets one from the DEMO_PASSWORD
 * environment variable (or prints a random one in development).
 * All emails use example domains.
 */

import { UserAccount } from '../types/auth';

export const DEFAULT_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'user-emp-tcs-1',
    name: 'Vikramaditya Sharma',
    email: 'v.sharma@tcs.example.com',
    role: 'EMPLOYER',
    organization: 'Tata Consultancy Services',
    designation: 'Senior Talent Acquisition & Compliance Officer',
    phone: '+91 90000 00001',
    avatarBg: 'bg-emerald-600',
    createdAt: '2026-01-10T09:00:00.000Z',
    lastActive: '2026-04-18T10:30:00.000Z',
    isDefault: true,
  },
  {
    id: 'user-stu-abinaya',
    name: 'Abinaya S',
    email: 'abinaya.attur@student.example.edu.in',
    role: 'STUDENT',
    organization: 'Govt. College of Technology, Coimbatore',
    designation: 'B.Tech Information Technology (Final Year)',
    phone: '+91 90000 00002',
    apaarId: '2990 9583 2586',
    avatarBg: 'bg-amber-500',
    createdAt: '2026-01-15T09:00:00.000Z',
    lastActive: '2026-04-18T10:30:00.000Z',
  },
  {
    id: 'user-inst-annauniv',
    name: 'Dr. K. Ravichandran',
    email: 'registrar@annauniv.example.edu',
    role: 'INSTITUTION',
    organization: 'Anna University, Chennai',
    designation: 'Dean of Academic Courses & NAD Controller',
    phone: '+91 90000 00003',
    avatarBg: 'bg-blue-600',
    createdAt: '2026-01-05T09:00:00.000Z',
    lastActive: '2026-04-18T08:15:00.000Z',
  },
  {
    id: 'user-reg-aicte',
    name: 'P. K. Meena (Demo)',
    email: 'compliance@aicte.example.gov.in',
    role: 'REGULATOR',
    organization: 'Ministry of Education & AICTE Audit Bureau',
    designation: 'Director of National Academic Credentials Registry',
    phone: '+91 90000 00004',
    avatarBg: 'bg-purple-600',
    createdAt: '2026-01-01T09:00:00.000Z',
    lastActive: '2026-04-18T07:45:00.000Z',
  },
];

/** Extra employer accounts that own the sample verification requests in mockData. */
export const DEMO_EMPLOYER_ACCOUNTS: UserAccount[] = [
  {
    id: 'user-emp-zoho-1',
    name: 'Suresh Balasubramanian (Demo)',
    email: 'suresh.demo@zoho.example.com',
    role: 'EMPLOYER',
    organization: 'Zoho Corporation',
    designation: 'Head of Technical Recruiting',
    phone: '+91 90000 00005',
    createdAt: '2026-01-10T09:00:00.000Z',
    lastActive: '2026-04-18T10:30:00.000Z',
  },
  {
    id: 'user-emp-cognizant-1',
    name: 'Deepak Varma (Demo)',
    email: 'deepak.demo@cognizant.example.com',
    role: 'EMPLOYER',
    organization: 'Cognizant Technology Solutions',
    designation: 'Associate Director - Human Capital',
    phone: '+91 90000 00006',
    createdAt: '2026-01-10T09:00:00.000Z',
    lastActive: '2026-04-18T10:30:00.000Z',
  },
  {
    id: 'user-emp-infosys-1',
    name: 'Priya Sundaram (Demo)',
    email: 'priya.demo@infosys.example.com',
    role: 'EMPLOYER',
    organization: 'Infosys Limited',
    designation: 'Campus Hiring Operations',
    phone: '+91 90000 00007',
    createdAt: '2026-01-10T09:00:00.000Z',
    lastActive: '2026-04-18T10:30:00.000Z',
  },
];
