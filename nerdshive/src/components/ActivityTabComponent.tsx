import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, User, Calendar, Clock, CheckCircle, UserCheck, CreditCard, MessageSquare, Search } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { Input } from "@/components/ui/input";

interface ActivityLog {
  id: string;
  action: string;
  performed_by: string;
  performed_by_name: string;
  performed_by_role: string;
  target_user_id?: string;
  target_user_name?: string;
  target_user_email?: string;
  details: any;
  created_at: string;
}

interface ActivityTabProps {
  activityLogs: ActivityLog[];
}

export function ActivityTabComponent({ activityLogs = [] }: ActivityTabProps) {
  // Remove duplicates and enhance activity logs safely
  const getUniqueActivities = (logs: ActivityLog[] = []) => {
    if (!logs || !Array.isArray(logs)) return [];
    
    const filteredLogs = logs.filter(log => {
      if (!log || !log.action) return false;
      const actionLower = log.action.toLowerCase();
      if (actionLower.includes("mfa")) return false;
      if (actionLower.includes("biometric")) return false;
      return true;
    });

    const unique = new Map();
    
    filteredLogs.forEach(log => {
      
      let dateStr = "";
      if (log.created_at) {
        const rawCreatedAt = log.created_at as any;
        if (typeof rawCreatedAt === 'string') {
          dateStr = rawCreatedAt.includes('T') ? rawCreatedAt.split('T')[0] : rawCreatedAt.split(' ')[0];
        } else if (rawCreatedAt instanceof Date) {
          dateStr = rawCreatedAt.toISOString().split('T')[0];
        } else {
          try {
            dateStr = new Date(rawCreatedAt).toISOString().split('T')[0];
          } catch (e) {
            dateStr = "";
          }
        }
      }

      const key = `${log.action || ''}-${log.target_user_id || ''}-${log.performed_by || ''}-${dateStr}`;
      
      const currentLogDate = log.created_at ? new Date(log.created_at).getTime() : 0;
      const existingLog = unique.get(key);
      const existingLogDate = existingLog && existingLog.created_at ? new Date(existingLog.created_at).getTime() : 0;

      if (!unique.has(key) || currentLogDate > existingLogDate) {
        unique.set(key, log);
      }
    });
    
    return Array.from(unique.values()).sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  };

  const formatAction = (action: string) => {
    if (!action) return "Unknown Action";
    switch (action) {
      case 'user_registered': return 'User Registered';
      case 'user_approved': return 'User Approved'; 
      case 'user_unapproved': return 'Approval Revoked';
      case 'user_rejected_and_deleted': return 'Application Rejected';
      case 'user_made_inactive': return 'Account Deactivated';
      case 'checkin_requested': return 'Check-in Request';
      case 'checkin_approved': return 'Check-in Approved';
      case 'checkin_rejected': return 'Check-in Rejected';
      case 'checked_out': return 'Checked Out';
      case 'plan_booked': return 'Plan Booked';
      case 'plan_purchased': return 'Plan Purchased';
      case 'plan_activated': return 'Plan Activated';
      case 'plan_deactivated': return 'Plan Deactivated';
      case 'query_submitted': return 'Query Submitted';
      case 'query_responded': return 'Query Responded';
      default:
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getActionBadge = (action: string) => {
    if (!action) return <Badge variant="secondary">Unknown Action</Badge>;
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let icon = null;
    let customClass = "";

    switch (action) {
      case 'user_registered':
        variant = "outline";
        icon = <User className="w-3 h-3 mr-1" />;
        break;
      case 'user_approved':
        customClass = "bg-success text-success-foreground hover:bg-success/80";
        icon = <CheckCircle className="w-3 h-3 mr-1" />;
        break;
      case 'user_unapproved':
      case 'user_made_inactive':
        variant = "destructive";
        break;
      case 'user_rejected_and_deleted':
        customClass = "bg-destructive text-destructive-foreground hover:bg-destructive/80";
        break;
      case 'checkin_requested':
      case 'checkin_approved':
        icon = <UserCheck className="w-3 h-3 mr-1" />;
        break;
      case 'checkin_rejected':
        variant = "destructive";
        icon = <UserCheck className="w-3 h-3 mr-1" />;
        break;
      case 'checked_out':
        icon = <Clock className="w-3 h-3 mr-1" />;
        break;
      case 'plan_booked':
      case 'plan_purchased':
      case 'plan_activated':
        icon = <CreditCard className="w-3 h-3 mr-1" />;
        break;
      case 'query_submitted':
      case 'query_responded':
        icon = <MessageSquare className="w-3 h-3 mr-1" />;
        break;
    }

    return (
      <Badge variant={variant} className={`text-xs flex items-center ${customClass}`}>
        {icon}
        {formatAction(action)}
      </Badge>
    );
  };

  const renderDetails = (action: string, details: any, log?: ActivityLog) => {
    if (!details) return null;
    const detailsArray: string[] = [];
    const actionLower = action?.toLowerCase() || '';

    // Seat upgrade/request explicit details
    if (action === 'Seat Upgrade Approved' || actionLower === 'seat_upgrade_approved') {
      const prev = details.previous_capacity !== undefined ? details.previous_capacity : '-';
      const next = details.new_capacity !== undefined ? details.new_capacity : '-';
      const company = details.company_name || 'Organization';
      const approvedBy = details.approved_by || 'Superuser';
      const approvedByName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approvedBy)
        ? (log?.performed_by_name || 'Superuser')
        : approvedBy;
      
      detailsArray.push(`Company Name: ${company}`);
      detailsArray.push(`Capacity Changed: ${prev} → ${next}`);
      detailsArray.push(`Approved By: ${approvedByName}`);
    }
    else if (action === 'Seat Request Created' || actionLower === 'seat_request_created') {
      const prev = details.previous_capacity !== undefined ? details.previous_capacity : '-';
      const req = details.requested_capacity !== undefined ? details.requested_capacity : '-';
      const company = details.company_name || 'Organization';
      const change = details.change !== undefined ? details.change : '';
      
      detailsArray.push(`Company Name: ${company}`);
      detailsArray.push(`Requested Capacity: ${req} (Previous: ${prev})`);
      if (change !== undefined && change !== '') {
        detailsArray.push(`Change: ${change > 0 ? `+${change}` : change}`);
      }
    }
    else if (actionLower === 'company_deleted' || actionLower === 'company_suspended' || actionLower === 'company_activated') {
      const company = details.company_name || 'Organization';
      const statusLabel = actionLower === 'company_deleted' ? 'Deleted' : actionLower === 'company_suspended' ? 'Suspended' : 'Activated';
      detailsArray.push(`Company ${statusLabel}: ${company}`);
    }

    // Plan details
    if (details?.plan_type) {
      const planType = details.plan_type.charAt(0).toUpperCase() + details.plan_type.slice(1);
      const amount = details?.amount ? `₹${details.amount}` : '';
      
      if (details?.start_date && details?.end_date) {
        detailsArray.push(`${planType} Plan ${amount ? `(${amount}) ` : ''}| ${formatDate(details.start_date)} - ${formatDate(details.end_date)}`);
      } else if (details?.date_selected) {
        detailsArray.push(`${planType} Plan ${amount ? `(${amount}) ` : ''}| ${formatDate(details.date_selected)}`);
      }
    }

    // Check-in details
    if (details?.checkin_time) {
      detailsArray.push(`Check-in: ${formatDate(details.checkin_time)} ${new Date(details.checkin_time).toLocaleTimeString()}`);
    }
    
    if (details?.checkout_time) {
      detailsArray.push(`Check-out: ${formatDate(details.checkout_time)} ${new Date(details.checkout_time).toLocaleTimeString()}`);
    }

    // Rejection reason for check-ins
    if (details?.reason && action === 'checkin_rejected') {
      detailsArray.push(`Reason: ${details.reason}`);
    }

    // User details
    if (details?.city && details?.occupation) {
      detailsArray.push(`${details.city} | ${details.occupation}`);
    } else if (details?.city) {
      detailsArray.push(`Location: ${details.city}`);
    } else if (details?.occupation) {
      detailsArray.push(`Occupation: ${details.occupation}`);
    }

    // Query details
    if (details?.query_text) {
      const truncatedQuery = details.query_text.length > 80 
        ? `${details.query_text.substring(0, 80)}...` 
        : details.query_text;
      detailsArray.push(`Query: "${truncatedQuery}"`);
    }

    // Reimbursement info
    if (details?.reimbursement !== undefined) {
      detailsArray.push(`Reimbursement: ${details.reimbursement ? 'Yes' : 'No'}`);
    }

    // Custom elaborate message for authentication / Policy actions
    if (action === 'Policy Changed' || action === 'policy_changed') {
      detailsArray.push("Platform security policy was updated.");
    }

    // Generic fallback for custom settings/attributes
    if (detailsArray.length === 0 && details && typeof details === 'object') {
      Object.entries(details).forEach(([key, val]) => {
        if (val !== null && val !== undefined && typeof val !== 'object') {
          const valStr = val.toString();
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valStr);
          if (isUuid) {
            return;
          }
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          detailsArray.push(`${formattedKey}: ${valStr}`);
        }
      });
    }

    return detailsArray.map((detail, index) => (
      <div key={index} className="text-xs bg-muted px-2 py-1 rounded mb-1 max-w-md">
        {detail}
      </div>
    ));
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return formatDate(dateString);
  };

  const [searchQuery, setSearchQuery] = useState("");

  const uniqueActivityLogs = getUniqueActivities(activityLogs);

  const filteredUniqueLogs = uniqueActivityLogs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    
    const actionStr = formatAction(log.action).toLowerCase();
    const perfName = (log.performed_by_name || 'System').toLowerCase();
    const perfRole = (log.performed_by_role || '').toLowerCase();
    
    let detailsMatch = false;
    if (log.details) {
      detailsMatch = JSON.stringify(log.details).toLowerCase().includes(q);
    }
    
    return actionStr.includes(q) || perfName.includes(q) || perfRole.includes(q) || detailsMatch;
  });

  const displayedLogs = filteredUniqueLogs.slice(0, 20);

  if (uniqueActivityLogs.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>
            Comprehensive log of all system activities including user management, plan bookings, and workspace access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-2" />
            <p>No activity logs found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Activity Logs
          <Badge variant="outline" className="ml-auto">
            {filteredUniqueLogs.length} activities
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time activity feed showing user registrations, approvals, plan bookings, and workspace check-ins
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs by action, user, role, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {displayedLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No matching activities found</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[400px] border rounded-md pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-center">Action</TableHead>
                  <TableHead className="text-center">Performed By</TableHead>
                  <TableHead className="text-center">Details</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-center">
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">
                        <div className="font-medium">{log.performed_by_name || 'System'}</div>
                        <div className="text-muted-foreground capitalize">{log.performed_by_role}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm flex flex-col items-center">
                        {renderDetails(log.action, log.details, log)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      <div>{formatDate(log.created_at)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}