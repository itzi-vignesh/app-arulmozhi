import os
import re

files_to_process = [
    'src/pages/Dashboard.tsx',
    'src/pages/Register.tsx',
    'src/pages/Settings.tsx',
    'src/pages/Login.tsx',
    'src/pages/ResetPassword.tsx',
    'src/components/CheckInOutTab.tsx',
    'src/components/CheckInApprovalTab.tsx',
    'src/components/BulkEnrollmentTab.tsx',
    'src/components/PaymentVerificationTab.tsx',
    'src/components/ui/notification-bell.tsx',
    'src/components/ui/image-modal.tsx',
    'src/components/ui/forgot-password-modal.tsx'
]

for file in files_to_process:
    if not os.path.exists(file): continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace basic queries
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.select\([^)]*\)\s*\.order\([^)]*\)', r"await apiClient.get('/\1')", content)
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.select\([^)]*\)\s*\.eq\([^)]*\)\s*\.maybeSingle\(\)', r"await apiClient.get('/\1').single()", content)
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.select\([^)]*\)', r"await apiClient.get('/\1')", content)
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.insert\(\{', r"await apiClient.post('/\1', {", content)
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.update\(\{', r"await apiClient.put('/\1', {", content)
    content = re.sub(r'await supabase\s*\.from\(\'([a-zA-Z_]+)\'\)\s*\.delete\(\)\s*\.eq\([^)]*\)', r"await apiClient.delete('/\1')", content)
    
    # Auth modifications
    content = re.sub(r'await supabase\.auth\.getUser\(\)', r"await apiClient.get('/auth/session')", content)
    content = re.sub(r'await supabase\.auth\.updateUser\(\{', r"await apiClient.put('/users/me', {", content)
    content = re.sub(r'await supabase\.auth\.resetPasswordForEmail\([^,]+,\s*\{[^}]*\}\)', r"await apiClient.post('/auth/password-recovery', { email: email.trim() })", content)

    # Edge Functions
    content = re.sub(r'await supabase\.functions\.invoke\(\'([^\']+)\'[^\)]+\)', r"await apiClient.post('/rpc/\1', {})", content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
