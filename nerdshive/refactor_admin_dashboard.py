import re

file_path = 'e:/1/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace fetchPendingUsers
content = re.sub(
    r'const fetchPendingUsers = async \(\) => \{.*?\};',
    '''const fetchPendingUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: false });
      setPendingUsers(data || []);
      setPendingUserCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending users:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchApprovedUsers
content = re.sub(
    r'const fetchApprovedUsers = async \(\) => \{.*?\};',
    '''const fetchApprovedUsers = async () => {
    try {
      const data = await adminService.getUsers({ is_approved: true });
      setApprovedUsers(data || []);
    } catch (error) {
      console.error('Error fetching approved users:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchQueries
content = re.sub(
    r'const fetchQueries = async \(\) => \{.*?\};',
    '''const fetchQueries = async () => {
    try {
      const data = await dashboardService.getQueries();
      setQueries(data || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchUsageLogs
content = re.sub(
    r'const fetchUsageLogs = async \(\) => \{.*?\};',
    '''const fetchUsageLogs = async () => {
    try {
      const data = await dashboardService.getUsageLogs();
      setUsageLogs(data || []);
    } catch (error) {
      console.error('Error fetching usage logs:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchPlans
content = re.sub(
    r'const fetchPlans = async \(\) => \{.*?\};',
    '''const fetchPlans = async () => {
    try {
      const data = await businessService.getPlans();
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchContentSections
content = re.sub(
    r'const fetchContentSections = async \(\) => \{.*?\};',
    '''const fetchContentSections = async () => {
    try {
      const data = await dashboardService.getContentSections();
      setContentSections(data || []);
    } catch (error) {
      console.error('Error fetching content sections:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchPricing
content = re.sub(
    r'const fetchPricing = async \(\) => \{.*?\};',
    '''const fetchPricing = async () => {
    try {
      const data = await businessService.getPricing();
      setPricing(data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace fetchActivityLogs
content = re.sub(
    r'const fetchActivityLogs = async \(\) => \{.*?\};',
    '''const fetchActivityLogs = async () => {
    try {
      const data = await auditService.getActivityLogs();
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Refactoring applied to fetch functions.")
