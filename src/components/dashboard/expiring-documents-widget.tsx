import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDocumentType, getDaysUntilExpiry } from '@/lib/utils';

export async function ExpiringDocumentsWidget() {
  const supabase = await createClient();

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: documents } = await supabase
    .from('expiring_documents_view')
    .select('*')
    .order('expiry_date', { ascending: true })
    .limit(5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Expiring Documents
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/documents?filter=expiring">
            View all
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {documents && documents.length > 0 ? (
          <div className="space-y-4">
            {documents.map((doc) => {
              const daysLeft = getDaysUntilExpiry(doc.expiry_date);
              const isExpired = daysLeft < 0;
              const isUrgent = daysLeft <= 7;

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDocumentType(doc.document_type)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge
                        variant={
                          isExpired
                            ? 'danger'
                            : isUrgent
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {isExpired
                          ? `${Math.abs(daysLeft)}d overdue`
                          : `${daysLeft}d left`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(doc.expiry_date)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/dashboard/contractors/${doc.contractor_id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No documents expiring soon</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
