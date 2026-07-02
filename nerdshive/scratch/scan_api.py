import os
import re

def scan_api_calls():
    src_dir = 'e:/1/src'
    results = []
    
    for root, _, files in os.walk(src_dir):
        for file in files:
            if not file.endswith(('.ts', '.tsx')): continue
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            for i, line in enumerate(lines):
                # match apiClient.get/post/put/delete( "url" or `url` or 'url' )
                match = re.search(r'apiClient\.(get|post|put|delete|patch)\s*\(\s*([\'"`].*?[\'"`])', line)
                if match:
                    method = match.group(1).upper()
                    endpoint = match.group(2)
                    rel_path = os.path.relpath(filepath, src_dir)
                    results.append(f"{rel_path}:{i+1} - {method} {endpoint}")
                    
    with open('e:/1/scratch/api_inventory.txt', 'w', encoding='utf-8') as out:
        out.write('\n'.join(results))

if __name__ == '__main__':
    scan_api_calls()
