import re

file_path = 'e:/1/src/pages/Dashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

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
  };''')
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Dashboard refactoring 2 applied.")
