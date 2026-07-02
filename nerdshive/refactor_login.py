import re

file_path = 'e:/1/src/pages/Login.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

imports = """
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
"""
content = content.replace("import { apiClient } from '@/lib/apiClient';", "import { apiClient } from '@/lib/apiClient';" + imports)

replacements = [
    (r'const handleLogin = async \(e: React.FormEvent\) => \{.*?return;\n      \}\n\n      // Approved user - redirect to dashboard', '''const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const data = await authService.login(email.trim(), password);

      if (!data || !data.session || !data.session.user) {
        toast({
          title: "Login Failed",
          description: "No user data received.",
          variant: "destructive"
        });
        return;
      }

      const { roles } = await authService.getSession();

      if (roles?.is_superuser) {
        navigate("/superuser/dashboard");
        return;
      }

      if (roles?.is_admin) {
        navigate("/admin/dashboard");
        return;
      }

      const user = await userService.getMe();
        
      if (!user) {
        toast({
          title: "Account Not Found",
          description: "No account found. Please register first.",
          variant: "destructive"
        });
        await authService.logout();
        navigate("/register");
        return;
      }

      // Check if user is inactive
      if (user?.is_active === false) {
        toast({
          title: "Account Inactive",
          description: "Your account has been made inactive. You need to re-register to access the system.",
          variant: "destructive"
        });
        await authService.logout();
        navigate("/inactive-user");
        return;
      }

      if (!user?.is_approved) {
        toast({
          title: "Approval Pending",
          description: "Your account is pending admin approval. Please wait for approval before accessing the system.",
          variant: "destructive"
        });
        await authService.logout();
        return;
      }

      // Approved user - redirect to dashboard''')
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Login refactoring applied.")
