import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  GraduationCap,
  Sparkles,
  UserCheck,
  Mail,
  Inbox,
  SendHorizontal,
  History,
  AlertOctagon,
  Settings,
} from 'lucide-react';
import { QueueStatusResponse } from '../services/api';

export type NavTab =
  | 'dashboard'
  | 'companies'
  | 'opportunities'
  | 'open_applications'
  | 'applications'
  | 'internships'
  | 'aiml'
  | 'fresher'
  | 'contacts'
  | 'runs'
  | 'failed'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  queueStatus: QueueStatusResponse | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  queueStatus,
}) => {
  const stats = queueStatus?.stats as any;

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'companies',
      label: 'Companies',
      icon: Building2,
      badge: stats?.totalCompanies,
      badgeColor: 'bg-gray-100 text-gray-700',
    },
    {
      id: 'opportunities',
      label: 'Opportunities',
      icon: Briefcase,
      badge: stats?.totalOpportunities,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'open_applications',
      label: 'Open Applications',
      icon: Inbox,
      badge: stats?.openApplications,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'applications',
      label: 'Application Pipeline',
      icon: SendHorizontal,
      badge: stats?.applicationsReadyCount,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'internships',
      label: 'Internships',
      icon: GraduationCap,
      badge: stats?.totalInternships,
      badgeColor: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'aiml',
      label: 'AI / ML Roles',
      icon: Sparkles,
      badge: stats?.aiMlRoles,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'fresher',
      label: 'Fresher Roles',
      icon: UserCheck,
      badge: stats?.fresherRoles,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'contacts',
      label: 'Contacts & Emails',
      icon: Mail,
      badge: stats?.publicEmails,
      badgeColor: 'bg-teal-100 text-teal-800',
    },
    {
      id: 'runs',
      label: 'Research Runs',
      icon: History,
    },
    {
      id: 'failed',
      label: 'Failed Research',
      icon: AlertOctagon,
      badge: stats?.unresolvedErrors,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 p-3"
    >
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Navigation
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    item.badgeColor || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-100 px-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-600 font-semibold mb-1">
            <span>Map Coverage</span>
            <span className="text-blue-600 font-bold">
              {stats?.researchedCompanies || 0} / {stats?.totalCompanies || 0}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${
                  stats?.totalCompanies
                    ? Math.round(
                        ((stats.researchedCompanies || 0) / stats.totalCompanies) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
