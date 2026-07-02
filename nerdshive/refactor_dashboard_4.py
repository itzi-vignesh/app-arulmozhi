import re

file_path = 'e:/1/src/pages/Dashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (r'const fetchUserData = async \(\) => \{.*?\};', '''const fetchUserData = async () => {
    try {
      const userRecord = await userService.getMe();
      if (userRecord) setUser(userRecord);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };'''),

    (r'const fetchUsageHistory = async \(\) => \{.*?\};', '''const fetchUsageHistory = async () => {
    try {
      const userRecord = await userService.getMe();
      if (userRecord) {
        const history = await dashboardService.getUsageLogs();
        setUsageHistory(history || []);
      }
    } catch (error) {
      console.error('Error fetching usage history:', error);
    }
  };'''),

    (r'const handleBookPlan = async \(\) => \{.*?setLoading\(false\);\n    \}\n  \};', '''const handleBookPlan = async () => {
    // Check if user already has an active plan
    if (getActivePlan()) {
      toast({
        title: "Active Plan Found",
        description: "You already have an active plan. Please wait for it to expire before booking a new one.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPlan || !selectedDate) {
      toast({
        title: "Validation Error",
        description: "Please select both plan type and date.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const userRecord = await userService.getMe();
      if (!userRecord) throw new Error("User not found");

      const selectedPlanPricing = pricing.find(p => p.plan_type === selectedPlan);
      if (!selectedPlanPricing) throw new Error("Plan pricing not found");

      const totalAmount = selectedPlanPricing.amount + (selectedPlanPricing.amount * selectedPlanPricing.gst_rate / 100);

      // Calculate start and end dates based on plan type
      const startDate = new Date(selectedDate);
      let endDate = new Date(selectedDate);
      
      if (selectedPlan === 'week') {
        endDate.setDate(startDate.getDate() + 6); // 7 days total
      } else if (selectedPlan === 'month') {
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(startDate.getDate() - 1); // Last day of month period
      }

      await businessService.createPlan({
          user_id: userRecord.id,
          plan_type: selectedPlan,
          amount: Math.round(totalAmount),
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          is_active: true
        });

      toast({
        title: "Plan Purchased Successfully!",
        description: Your  plan is active from  to .,
        variant: "default"
      });

      setSelectedPlan("");
      setSelectedDate("");
      fetchPlans();
    } catch (error) {
      console.error('Error booking plan:', error);
      toast({
        title: "Booking Failed",
        description: "Failed to book plan. Please try again.",
        variant: "destructive"
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
print("Dashboard refactoring 4 applied.")
