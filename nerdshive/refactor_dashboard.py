import re

file_path = 'e:/1/src/pages/Dashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

imports = """
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { businessService } from '@/services/businessService';
import { dashboardService } from '@/services/dashboardService';
import { notificationService } from '@/services/notificationService';
"""
content = content.replace("import { apiClient } from '@/lib/apiClient';", "import { apiClient } from '@/lib/apiClient';" + imports)

replacements = [
    (r'const fetchUser = async \(\) => \{.*?\};', '''const fetchUser = async () => {
    try {
      const userRecord = await userService.getMe();
      if (userRecord) setUser(userRecord);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };'''),

    (r'const fetchPlans = async \(\) => \{.*?\};', '''const fetchPlans = async () => {
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) return;
      const plans = await businessService.getPlans();
      setPlans(plans.filter(p => p.user_id === userRecord.id));
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };'''),

    (r'const fetchUpdates = async \(\) => \{.*?\};', '''const fetchUpdates = async () => {
    try {
      const updates = await dashboardService.getUpdates();
      setUpdates(updates || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };'''),

    (r'const fetchNotifications = async \(\) => \{.*?\};', '''const fetchNotifications = async () => {
    try {
      const notifs = await notificationService.getNotifications();
      setNotifications(notifs || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
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

    (r'const fetchCheckins = async \(\) => \{.*?\};', '''const fetchCheckins = async () => {
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) return;
      const checkins = await businessService.getCheckins();
      setCheckins(checkins.filter(c => c.user_id === userRecord.id));
    } catch (error) {
      console.error('Error fetching checkins:', error);
    }
  };'''),

    (r'const fetchQueries = async \(\) => \{.*?\};', '''const fetchQueries = async () => {
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) return;
      const queries = await dashboardService.getQueries();
      setQueries(queries.filter(q => q.user_id === userRecord.id));
    } catch (error) {
      console.error('Error fetching queries:', error);
    }
  };'''),

    (r'const handleBuyPlan = async \(plan: any\) => \{.*?\};', '''const handleBuyPlan = async (plan: any) => {
    setLoading(true);
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      await businessService.createPlan({
        user_id: userRecord.id,
        plan_type: plan.plan_type,
        amount: plan.amount,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + (plan.plan_type === 'day' ? 1 : plan.plan_type === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: false, // Will be activated after payment verification
        payment_verified: false
      });

      toast({
        title: "Plan Selected",
        description: "Please proceed with payment to activate your plan.",
        variant: "default"
      });

      fetchPlans();
    } catch (error) {
      console.error('Error buying plan:', error);
      toast({
        title: "Purchase Failed",
        description: "Failed to select plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };'''),

    (r'const handleSubmitQuery = async \(\) => \{.*?\};', '''const handleSubmitQuery = async () => {
    if (!newQuery.trim()) return;

    setLoading(true);
    try {
      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      await dashboardService.createQuery({
        user_id: userRecord.id,
        query_text: newQuery
      });

      toast({
        title: "Query Submitted",
        description: "We will get back to you soon.",
        variant: "default"
      });

      setNewQuery("");
      fetchQueries();
    } catch (error) {
      console.error('Error submitting query:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit query. Please try again.",
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
  };''')
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Dashboard refactoring applied.")
