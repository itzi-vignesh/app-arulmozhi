import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    
    # 1. Replace imports
    content = re.sub(r'import \{ supabase \} from [^;]+;', "import { apiClient } from '@/lib/apiClient';", content)
    
    # 2. Replace storage url
    content = re.sub(r'supabase\.storage\.from\([^)]+\)\.getPublicUrl\(([^)]+)\)', r'apiClient.get(`/storage/${ \1 }`)', content)
    
    # 3. Replace basic select queries
    # const { data, error } = await supabase.from('users').select('*') -> const { data } = await apiClient.get('/users')
    content = re.sub(r'await supabase\.from\(([^)]+)\)\.select\([^)]*\)', r'await apiClient.get(`/${ \1 }`)', content)
    
    # 4. Replace basic insert
    content = re.sub(r'await supabase\.from\(([^)]+)\)\.insert\(([^)]+)\)', r'await apiClient.post(`/${ \1 }`, \2)', content)

    # 5. Replace basic update
    content = re.sub(r'await supabase\.from\(([^)]+)\)\.update\(([^)]+)\)\.eq\([^)]+\)', r'await apiClient.put(`/${ \1 }/update`, \2)', content)
    
    # 6. Replace auth.getSession
    content = re.sub(r'await supabase\.auth\.getSession\(\)', r'await apiClient.get("/auth/session")', content)
    
    # 7. Channel removal (comment out channel stuff for polling fallback)
    content = re.sub(r'const \w+Channel = supabase\.channel.*?(?=\s*const|\s*let|\s*try)', '/* channel removed for polling */\n', content, flags=re.DOTALL)
    content = re.sub(r'supabase\.removeChannel\([^)]+\);', '', content)
    
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
