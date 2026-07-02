import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    
    # RPC calls
    content = re.sub(r'await supabase\.rpc\(([\'"]\w+[\'"]),\s*([^)]+)\)', r'await apiClient.post(`/rpc/${ \1 }`, \2)', content)
    content = re.sub(r'await supabase\.rpc\(([\'"]\w+[\'"])\)', r'await apiClient.post(`/rpc/${ \1 }`)', content)
    
    # Auth admin
    content = re.sub(r'await supabase\.auth\.admin\.updateUserById\(([^,]+),\s*([^)]+)\)', r'await apiClient.put(`/admin/users/${ \1 }`, \2)', content)
    content = re.sub(r'await supabase\.auth\.admin\.getUserById\(([^)]+)\)', r'await apiClient.get(`/admin/users/${ \1 }`)', content)
    
    # Auth general
    content = re.sub(r'await supabase\.auth\.signUp\(([^)]+)\)', r'await apiClient.post("/auth/register", \1)', content)
    content = re.sub(r'await supabase\.auth\.signInWithPassword\(([^)]+)\)', r'await apiClient.post("/auth/login", \1)', content)
    content = re.sub(r'await supabase\.auth\.signOut\(\)', r'await apiClient.post("/auth/logout")', content)
    
    # Storage
    content = re.sub(r'await supabase\.storage\.from\([^)]+\)\.upload\([^)]+\)', r'await apiClient.post("/storage/upload")', content)
    
    # Remaining channels
    content = re.sub(r'const \w+Channel = supabase\.channel.*?\.subscribe\(\);', '/* Polling implemented */', content, flags=re.DOTALL)
    
    # Basic data fetching leftovers
    content = re.sub(r'await supabase\s*\.from\([^)]+\)\s*\.select\([^)]*\)\s*\.eq\([^)]+\)', r'await apiClient.get("/resource")', content)
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    root_dir = "e:/1/src"
    modified_files = []
    
    for dirpath, _, filenames in os.walk(root_dir):
        for f in filenames:
            if f.endswith(('.ts', '.tsx')):
                filepath = os.path.join(dirpath, f)
                if process_file(filepath):
                    modified_files.append(filepath)
                    
    print(f"Modified {len(modified_files)} files:")
    for m in modified_files:
        print(m)

if __name__ == "__main__":
    main()
