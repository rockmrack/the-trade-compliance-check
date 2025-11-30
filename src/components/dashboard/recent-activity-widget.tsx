import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ChevronRight,
  UserPlus,
  FileUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bell
} from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';

export async function RecentActivityWidget() {
  const supabase = await createClient();

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['create', 'update', 'verify', 'approve', 'reject', 'block'])
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/audit">
            View all
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {auditLogs && auditLogs.length > 0 ? (
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <ActivityItem key={log.id} log={log} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  log
}: {
  log: {
    id: string;
    action: string;
    entity_type: string;
    new_state: Record<string, unknown> | null;
    created_at: string;
  };
}) {
  const { icon, color, message } = getActivityDetails(log);

  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{message}</p>
        <p className="text-xs text-muted-foreground">
          {formatRelativeTime(log.created_at)}
        </p>
      </div>
    </div>
  );
}

function getActivityDetails(log: {
  action: string;
  entity_type: string;
  new_state: Record<string, unknown> | null;
}): {
  icon: React.ReactNode;
  color: string;
  message: string;
} {
  const entityName = getEntityName(log.entity_type, log.new_state);

  switch (log.action) {
    case 'create':
      if (log.entity_type === 'contractors') {
        return {
          icon: <UserPlus className="h-4 w-4 text-blue-600" />,
          color: 'bg-blue-100 dark:bg-blue-900/30',
          message: `New contractor added: ${entityName}`
        };
      }
      if (log.entity_type === 'compliance_documents') {
        return {
          icon: <FileUp className="h-4 w-4 text-purple-600" />,
          color: 'bg-purple-100 dark:bg-purple-900/30',
          message: `Document uploaded for ${entityName}`
        };
      }
      return {
        icon: <Activity className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-900/30',
        message: `New ${log.entity_type} created`
      };

    case 'verify':
    case 'approve':
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        color: 'bg-green-100 dark:bg-green-900/30',
        message: `${log.entity_type === 'compliance_documents' ? 'Document' : 'Contractor'} verified: ${entityName}`
      };

    case 'reject':
      return {
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        color: 'bg-red-100 dark:bg-red-900/30',
        message: `${log.entity_type === 'compliance_documents' ? 'Document' : 'Contractor'} rejected: ${entityName}`
      };

    case 'block':
      return {
        icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
        color: 'bg-orange-100 dark:bg-orange-900/30',
        message: `Payment blocked for ${entityName}`
      };

    case 'update':
      return {
        icon: <Activity className="h-4 w-4 text-blue-600" />,
        color: 'bg-blue-100 dark:bg-blue-900/30',
        message: `${log.entity_type} updated: ${entityName}`
      };

    default:
      return {
        icon: <Bell className="h-4 w-4 text-gray-600" />,
        color: 'bg-gray-100 dark:bg-gray-900/30',
        message: `${log.action} on ${log.entity_type}`
      };
  }
}

function getEntityName(
  entityType: string,
  state: Record<string, unknown> | null
): string {
  if (!state) return 'Unknown';

  switch (entityType) {
    case 'contractors':
      return String(state.company_name || 'Unknown Contractor');
    case 'compliance_documents':
      return String(state.document_type || 'Document').replace(/_/g, ' ');
    case 'invoices':
      return `Invoice #${state.invoice_number || 'Unknown'}`;
    default:
      return String(state.name || state.id || 'Unknown');
  }
}
