import re

with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all channel subscriptions
content = re.sub(r'const usageChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)
content = re.sub(r'const queryChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)
content = re.sub(r'const updatesChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)
content = re.sub(r'const pricingChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)
content = re.sub(r'const plansChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)
content = re.sub(r'const checkinsChannel = supabase[\s\S]*?\.subscribe\(\);\s*', '', content)

polling = '''    // Polling mechanism replacing Supabase WebSockets
    const pollInterval = setInterval(() => {
      fetchUsageHistory();
      fetchQueries();
      fetchUpdates();
      fetchPricing();
      fetchPlans();
      fetchCheckins();
    }, 30000);

    return () => clearInterval(pollInterval);'''

content = re.sub(r'return \(\) => \{[\s\S]*?\};', polling, content)

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
