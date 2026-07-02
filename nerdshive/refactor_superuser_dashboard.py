import re

file_path = 'e:/1/src/pages/SuperuserDashboard.tsx'
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

replacements = [
    (r'const fetchPendingUsers = async \(\) => \{.*?\};', '''const fetchPendingUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: false });
      setPendingUsers(data || []);
      setPendingUserCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending users:', error);
    }
  };'''),

    (r'const fetchApprovedUsers = async \(\) => \{.*?\};', '''const fetchApprovedUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: true });
      setApprovedUsers(data || []);
    } catch (error) {
      console.error('Error fetching approved users:', error);
    }
  };'''),

    (r'const fetchQueries = async \(\) => \{.*?\};', '''const fetchQueries = async () => {
    try {
      const data = await dashboardService.getQueries();
      setQueries(data || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
    }
  };'''),

    (r'const fetchUsageLogs = async \(\) => \{.*?\};', '''const fetchUsageLogs = async () => {
    try {
      const data = await dashboardService.getUsageLogs();
      setUsageLogs(data || []);
    } catch (error) {
      console.error('Error fetching usage logs:', error);
    }
  };'''),

    (r'const fetchPlans = async \(\) => \{.*?\};', '''const fetchPlans = async () => {
    try {
      const data = await businessService.getPlans();
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };'''),

    (r'const fetchContentSections = async \(\) => \{.*?\};', '''const fetchContentSections = async () => {
    try {
      const data = await dashboardService.getContentSections();
      setContentSections(data || []);
    } catch (error) {
      console.error('Error fetching content sections:', error);
    }
  };'''),

    (r'const fetchPricing = async \(\) => \{.*?\};', '''const fetchPricing = async () => {
    try {
      const data = await businessService.getPricing();
      setPricing(data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };'''),

    (r'const fetchActivityLogs = async \(\) => \{.*?\};', '''const fetchActivityLogs = async () => {
    try {
      const data = await auditService.getActivityLogs();
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };'''),

    (r'const fetchCheckInCount = async \(\) => \{.*?\};', '''const fetchCheckInCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ status: 'pending' });
      setPendingCheckInCount(checkins.length || 0);
    } catch (error) {
      console.error('Error fetching check-in count:', error);
    }
  };'''),

    (r'const fetchPaymentCount = async \(\) => \{.*?\};', '''const fetchPaymentCount = async () => {
    try {
      const checkins = await businessService.getCheckins({ checkin_approved: false });
      const unverifiedCount = checkins.filter(c => c.payment_status !== 'rejected' && c.plans && !c.plans.payment_verified).length;
      setPendingPaymentCount(unverifiedCount);
    } catch (error) {
      console.error('Error fetching payment count:', error);
    }
  };'''),

    (r'const fetchQueriesCount = async \(\) => \{.*?\};', '''const fetchQueriesCount = async () => {
    try {
      const queries = await dashboardService.getQueries({ status: 'pending' });
      setPendingQueriesCount(queries.length || 0);
    } catch (error) {
      console.error('Error fetching queries count:', error);
    }
  };'''),

    (r'const fetchActivityCount = async \(\) => \{.*?\};', '''const fetchActivityCount = async () => {
    try {
      const count = await dashboardService.getActivityCount();
      setNewActivityCount(count || 0);
    } catch (error) {
      console.error('Error fetching activity count:', error);
    }
  };'''),

    (r'const markActivityTabAsViewed = async \(\) => \{.*?\};', '''const markActivityTabAsViewed = async () => {
    try {
      await dashboardService.markActivityTabViewed();
      setNewActivityCount(0);
    } catch (error) {
      console.error('Error marking activity tab as viewed:', error);
    }
  };'''),

    (r'const handleRespondToQuery = async \(\) => \{.*?\};', '''const handleRespondToQuery = async () => {
    if (!selectedQuery || !queryResponse.trim()) return;

    setLoading(true);
    try {
      await dashboardService.updateQuery(selectedQuery.id, { response: queryResponse, status: 'answered' });

      toast({
        title: "Response Sent",
        description: "Query has been responded to successfully.",
        variant: "default"
      });

      setQueryResponse("");
      setSelectedQuery(null);
      fetchQueries();
    } catch (error) {
      console.error('Error responding to query:', error);
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };'''),

    (r'const handleSaveContent = async \(\) => \{.*?\};', '''const handleSaveContent = async () => {
    if (!editingContent || !newContent.trim()) return;

    setLoading(true);
    try {
      await dashboardService.updateContentSection(editingContent.section, { content: newContent });

      toast({
        title: "Content Updated",
        description: "Section content has been updated successfully.",
        variant: "default"
      });

      setEditingContent(null);
      setNewContent("");
      fetchContentSections();
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: "Error",
        description: "Failed to update content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };'''),

    (r'const handleSavePricing = async \(\) => \{.*?\};', '''const handleSavePricing = async () => {
    if (!editingPricing || !newAmount || !newGstRate) return;

    setLoading(true);
    try {
      await businessService.updatePricing({ 
        plan_type: editingPricing.plan_type, 
        amount: Number(newAmount), 
        gst_rate: Number(newGstRate) 
      });

      toast({
        title: "Pricing Updated",
        description: "Plan pricing has been updated successfully.",
        variant: "default"
      });

      setEditingPricing(null);
      setNewAmount("");
      setNewGstRate("");
      fetchPricing();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        title: "Error",
        description: "Failed to update pricing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };'''),

    (r'const handleLogout = async \(\) => \{.*?\};', '''const handleLogout = async () => {
    try {
      await authService.logout();
      navigate("/login");
    } catch (error) {
      console.error('Error logging out:', error);
      navigate("/login");
    }
  };'''),

    (r'const handleApproveUser = async \(userId: string\) => \{.*?\};', '''const handleApproveUser = async (userId: string) => {
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
  };'''),

    (r'const handleRejectUser = async \(userId: string, reason\?: string\) => \{.*?\};', '''const handleRejectUser = async (userId: string, reason?: string) => {
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
  };'''),
  
    (r'const handleMakeInactive = async \(\) => \{.*?\};', '''const handleMakeInactive = async () => {
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
  };''')
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SuperuserDashboard refactoring applied.")
