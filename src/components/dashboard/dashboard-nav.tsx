'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  CreditCard,
  Bell,
  Settings,
  BarChart3,
  Shield,
  Building2,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    title: 'Contractors',
    href: '/dashboard/contractors',
    icon: Users
  },
  {
    title: 'Documents',
    href: '/dashboard/documents',
    icon: FileCheck
  },
  {
    title: 'Invoices',
    href: '/dashboard/invoices',
    icon: CreditCard,
    roles: ['super_admin', 'admin', 'finance']
  },
  {
    title: 'Payment Runs',
    href: '/dashboard/payments',
    icon: Building2,
    roles: ['super_admin', 'admin', 'finance']
  },
  {
    title: 'Notifications',
    href: '/dashboard/notifications',
    icon: Bell,
    roles: ['super_admin', 'admin', 'operations']
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: BarChart3,
    roles: ['super_admin', 'admin']
  },
  {
    title: 'Audit Logs',
    href: '/dashboard/audit',
    icon: Shield,
    roles: ['super_admin', 'admin']
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['super_admin', 'admin']
  }
];

interface DashboardNavProps {
  userRole: UserRole;
}

export function DashboardNav({ userRole }: DashboardNavProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 border-r bg-white dark:bg-slate-900 lg:block">
      <nav className="flex flex-col gap-1 p-4">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
