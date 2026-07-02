import re

file_path = 'e:/1/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

imports = """
import { adminService } from '@/services/adminService';
import { businessService } from '@/services/businessService';
import { dashboardService } from '@/services/dashboardService';
import { auditService } from '@/services/auditService';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
"""
content = content.replace("import { apiClient } from '@/lib/apiClient';", "import { apiClient } from '@/lib/apiClient';" + imports)

# Replace fetchCheckInCount
content = re.sub(
    r'const fetchCheckInCount = async \(\) => \{.*?\};',
    '''const fetchCheckInCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ status: 'pending' });
      setPendingCheckInCount(checkins.length || 0);
    } catch (error) {
      console.error('Error fetching check-in count:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchPaymentCount
content = re.sub(
    r'const fetchPaymentCount = async \(\) => \{.*?\};',
    '''const fetchPaymentCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ checkin_approved: false });
      const unverifiedCount = checkins.filter(c => c.payment_status !== 'rejected' && c.plans && !c.plans.payment_verified).length;
      setPendingPaymentCount(unverifiedCount);
    } catch (error) {
      console.error('Error fetching payment count:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchQueriesCount
content = re.sub(
    r'const fetchQueriesCount = async \(\) => \{.*?\};',
    '''const fetchQueriesCount = async () => {
    try {
      const queries = await dashboardService.getQueries({ status: 'pending' });
      setPendingQueriesCount(queries.length || 0);
    } catch (error) {
      console.error('Error fetching queries count:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchActivityCount
content = re.sub(
    r'const fetchActivityCount = async \(\) => \{.*?\};',
    '''const fetchActivityCount = async () => {
    try {
      const count = await dashboardService.getActivityCount();
      setNewActivityCount(count || 0);
    } catch (error) {
      console.error('Error fetching activity count:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace markActivityTabAsViewed
content = re.sub(
    r'const markActivityTabAsViewed = async \(\) => \{.*?\};',
    '''const markActivityTabAsViewed = async () => {
    try {
      await dashboardService.markActivityTabViewed();
      setNewActivityCount(0);
    } catch (error) {
      console.error('Error marking activity tab as viewed:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleMakeInactive
content = re.sub(
    r'const handleMakeInactive = async \(\) => \{.*?\};',
    '''const handleMakeInactive = async () => {
    setLoading(true);
    try {
      await adminService.makeUserInactive(user.auth_id);

      toast({
        title: "User Made Inactive",
        description: ${user.full_name} has been made inactive. They will need to re-register to access the system.,
      });
    } catch (error) {
      console.error('Error making user inactive:', error);
      toast({
        title: "Error",
        description: "Failed to make user inactive. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleApproveUser
content = re.sub(
    r'const handleApproveUser = async \(userId: string\) => \{.*?\};',
    '''const handleApproveUser = async (userId: string) => {
    setLoading(true);
    try {
      await adminService.approveUser(userId);

      toast({
        title: "User Approved",
        description: "User has been approved successfully.",
        variant: "default"
      });

      fetchPendingUsers();
      fetchApprovedUsers();
      fetchActivityLogs(); 
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleRejectUser
content = re.sub(
    r'const handleRejectUser = async \(userId: string, reason\?: string\) => \{.*?\};',
    '''const handleRejectUser = async (userId: string, reason?: string) => {
    setLoading(true);
    try {
      await adminService.rejectUser(userId, reason);

      toast({
        title: "User Rejected",
        description: reason 
          ? User's application has been rejected. Reason:  
          : User's application has been rejected and completely removed from the system.,
        variant: "default"
      });

      fetchPendingUsers();
      fetchActivityLogs(); 
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Rejection Failed",
        description: "Failed to reject user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Refactoring 2 applied.")
