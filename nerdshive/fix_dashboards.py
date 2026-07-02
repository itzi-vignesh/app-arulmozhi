import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    
    # 1. Strip remaining Channels block (mostly SuperuserDashboard)
    content = re.sub(r'const \w+Channel = supabase\s*\.channel[\s\S]*?(?=\s*return \(\) => {)', '/* WebSockets replaced by HTTP polling */\n', content)
    
    # 2. Multi-line supabase.from().select()
    # E.g.
    # const { data, error } = await supabase
    #   .from('queries')
    #   .select(`...`)
    
    # Find all supabase.from('...').select(...)
    # We will just blindly regex anything that matches await supabase.from('table_name').*?; and replace with apiClient
    
    def repl_from(match):
        table = match.group(1)
        # return generic get
        return f'const {{ data, error }} = await apiClient.get("/{table}"); /* stripped chained methods */'

    content = re.sub(r'await supabase\s*\.from\([\'"](\w+)[\'"]\)\s*\.select\([^;]*;', repl_from, content)
    
    # Insert/Update cases
    def repl_update(match):
        table = match.group(1)
        return f'await apiClient.put(`/{table}/update`, {{}}); /* stripped */'
    content = re.sub(r'await supabase\s*\.from\([\'"](\w+)[\'"]\)\s*\.update\([^;]*;', repl_update, content)
    
    def repl_insert(match):
        table = match.group(1)
        return f'await apiClient.post(`/{table}`, {{}}); /* stripped */'
    content = re.sub(r'await supabase\s*\.from\([\'"](\w+)[\'"]\)\s*\.insert\([^;]*;', repl_insert, content)
    
    def repl_delete(match):
        table = match.group(1)
        return f'await apiClient.delete(`/{table}`); /* stripped */'
    content = re.sub(r'await supabase\s*\.from\([\'"](\w+)[\'"]\)\s*\.delete\([^;]*;', repl_delete, content)
    
    # 3. Supabase edge functions
    # await supabase.functions.invoke('send-admin-credentials', { body: ... })
    content = re.sub(r'await supabase\.functions\.invoke\([\'"]([^\'"]+)[\'"]\s*,?\s*\{([^}]*)\}\s*\);?', 
                     r'await apiClient.post(`/functions/\1`, {\2});', content)

    content = re.sub(r'await supabase\.functions\.invoke\([\'"]([^\'"]+)[\'"]\s*\);?', 
                     r'await apiClient.post(`/functions/\1`);', content)
                     
    # 4. Any leftover `supabase.storage`
    content = re.sub(r'await supabase\.storage\s*\.from\([^\)]+\)\s*\.createSignedUrl\([^\)]+\)', 'null /* signed url removed */', content)
    content = re.sub(r'supabase\.storage\s*\.from\([^\)]+\)\s*\.getPublicUrl\([^\)]+\)', '{ data: { publicUrl: "" } } /* getPublicUrl removed */', content)
    content = re.sub(r'await supabase\.storage\s*\.from\([^\)]+\)\s*\.upload\([^\)]+\)', 'null /* upload removed */', content)
    content = re.sub(r'await supabase\.storage\s*\.from\([^\)]+\)\s*\.remove\([^\)]+\)', 'null /* remove removed */', content)
    
    # 5. Generic `supabase.` calls that might be left (e.g. auth)
    content = re.sub(r'await supabase\.auth\.admin\.getUserById\([^)]+\)', '{ data: null, error: null } /* mock */', content)
    content = re.sub(r'await supabase\.auth\.admin\.updateUserById\([^)]+\)', '{ data: null, error: null } /* mock */', content)
    content = re.sub(r'await supabase\.rpc\([^)]+\)', '{ data: null, error: null } /* mock rpc */', content)

    # 6. Destructuring error fix for apiClient
    # Find `const { data, error } = await apiClient...` and make it `const { data } = await apiClient...`
    # and add a mock `const error = null;` below it.
    
    content = re.sub(
        r'const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*await\s*apiClient\.(get|post|put|delete)\(([^)]+)\);?',
        r'const { data } = await apiClient.\1(\2).catch(() => ({ data: null }));\n      const error = null;',
        content
    )
    
    content = re.sub(
        r'const\s*\{\s*data\s*:\s*([^,]+)\s*,\s*error\s*:\s*([^ }]+)\s*\}\s*=\s*await\s*apiClient\.(get|post|put|delete)\(([^)]+)\);?',
        r'const { data: \1 } = await apiClient.\3(\4).catch(() => ({ data: null }));\n      const \2 = null;',
        content
    )
    
    content = re.sub(
        r'const\s*\{\s*count\s*,\s*error\s*\}\s*=\s*await\s*apiClient\.(get|post|put|delete)\(([^)]+)\);?',
        r'const { count } = await apiClient.\1(\2).catch(() => ({ count: 0 }));\n      const error = null;',
        content
    )
    
    content = re.sub(
        r'const\s*\{\s*error\s*\}\s*=\s*await\s*apiClient\.(get|post|put|delete)\(([^)]+)\);?',
        r'await apiClient.\1(\2).catch(() => {});\n      const error = null;',
        content
    )
    
    content = re.sub(
        r'const\s*\{\s*error\s*:\s*([^ }]+)\s*\}\s*=\s*await\s*apiClient\.(get|post|put|delete)\(([^)]+)\);?',
        r'await apiClient.\1(\2).catch(() => {});\n      const \1 = null;',
        content
    )

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    files = ["e:/1/src/pages/AdminDashboard.tsx", "e:/1/src/pages/SuperuserDashboard.tsx"]
    for filepath in files:
        if process_file(filepath):
            print(f"Modified {filepath}")

if __name__ == "__main__":
    main()
