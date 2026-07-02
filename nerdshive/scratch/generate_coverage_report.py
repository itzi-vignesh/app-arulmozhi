import os
import re
import json
from collections import defaultdict

def scan_frontend(directory):
    api_calls = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Look for apiClient.get, post, put, delete
                    # Format: apiClient.get('/users/me') or apiClient.post(`/auth/${id}`)
                    pattern = r'apiClient\.(get|post|put|delete)\(\s*[`\'"](.*?)[`\'"]'
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        method = match.group(1).upper()
                        url = match.group(2)
                        # Normalize url slightly (replace template variables with {param})
                        url = re.sub(r'\$\{.*?\}', '{param}', url)
                        if url.startswith('/'):
                            url = url[1:] # strip leading slash to match backend router
                        api_calls.append({
                            'file': os.path.relpath(filepath, directory),
                            'method': method,
                            'url': url
                        })
    return api_calls

def scan_backend(directory):
    endpoints = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Look for @router.get, @router.post, etc.
                    pattern = r'@router\.(get|post|put|delete)\(\s*["\'](.*?)["\']'
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        method = match.group(1).upper()
                        url = match.group(2)
                        if url.startswith('/'):
                            url = url[1:]
                            
                        # Extract the function block associated with this endpoint
                        # We'll just look for TODO, mock, stub within the next 20 lines as a heuristic, 
                        # or properly extract the function body.
                        func_body = ""
                        idx = match.end()
                        lines = content[idx:].split('\n')[:50]
                        func_body = '\n'.join(lines)
                        
                        is_mock = bool(re.search(r'(?i)(mock|stub|TODO|NotImplementedError|\bpass\b)', func_body))
                        
                        endpoints.append({
                            'file': os.path.relpath(filepath, directory),
                            'method': method,
                            'url': url,
                            'is_mock': is_mock
                        })
    return endpoints

def check_tests(backend_dir, endpoints):
    test_dir = os.path.join(os.path.dirname(os.path.dirname(backend_dir)), 'tests')
    if not os.path.exists(test_dir):
        for ep in endpoints:
            ep['is_tested'] = False
        return
        
    test_files_content = ""
    for root, dirs, files in os.walk(test_dir):
        for file in files:
            if file.endswith('.py'):
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    test_files_content += f.read() + "\n"
                    
    for ep in endpoints:
        # A simple heuristic: check if the URL or a test string related to the URL is in the test files
        # Alternatively, check if client.get(...) is called.
        method = ep['method'].lower()
        # url might have path params like {user_id}. Replace with regex.
        url_pattern = re.sub(r'\{.*?\}', r'.*?', ep['url'])
        pattern = rf'client\.{method}\(.*?(/{url_pattern}).*?\)'
        is_tested = bool(re.search(pattern, test_files_content))
        ep['is_tested'] = is_tested

if __name__ == '__main__':
    frontend_dir = r'e:\1\src'
    backend_endpoints_dir = r'e:\1\backend\app\api\v1\endpoints'
    
    frontend_calls = scan_frontend(frontend_dir)
    backend_endpoints = scan_backend(backend_endpoints_dir)
    check_tests(backend_endpoints_dir, backend_endpoints)
    
    # Prefix handling: Backend routers usually are prefixed in a main router, e.g. /users -> /users/me
    # Let's read the main router to see prefixes
    main_router_path = r'e:\1\backend\app\api\v1\api.py'
    prefixes = {}
    if os.path.exists(main_router_path):
        with open(main_router_path, 'r', encoding='utf-8') as f:
            for line in f:
                # router.include_router(users.router, prefix="/users", tags=["users"])
                match = re.search(r'include_router\([^,]+,\s*prefix=["\'](.*?)["\']', line)
                if match:
                    prefix = match.group(1)
                    if prefix.startswith('/'):
                        prefix = prefix[1:]
                    # Which module?
                    mod_match = re.search(r'include_router\((.*?)\.', line)
                    if mod_match:
                        mod = mod_match.group(1)
                        prefixes[mod] = prefix

    # Apply prefixes to backend endpoints
    for ep in backend_endpoints:
        file_path = ep['file']
        assert isinstance(file_path, str)
        mod = file_path.replace('.py', '')
        if mod in prefixes:
            prefix = prefixes[mod]
            if ep['url']:
                ep['full_url'] = f"{prefix}/{ep['url']}"
            else:
                ep['full_url'] = prefix
        else:
            ep['full_url'] = ep['url']
            
    # Also handle auth/session, rpc/ calls
    # Let's normalize URLs by replacing {} with {param}
    for ep in backend_endpoints:
        full_url = ep['full_url']
        assert isinstance(full_url, str)
        ep['norm_url'] = re.sub(r'\{.*?\}', '{param}', full_url).rstrip('/')
        
    frontend_unique = {}
    for fc in frontend_calls:
        url = fc['url'].rstrip('/')
        key = f"{fc['method']} {url}"
        frontend_unique[key] = fc
        
    backend_unique = {}
    for ep in backend_endpoints:
        url = ep['norm_url']
        key = f"{ep['method']} {url}"
        backend_unique[key] = ep
        
    # Matching
    unmatched_frontend = []
    for key, fc in frontend_unique.items():
        if key not in backend_unique:
            # Maybe try to find a prefix match or without trailing slashes
            matched = False
            for b_key in backend_unique:
                if fc['method'] == b_key.split(' ')[0]:
                    fc_url = fc['url'].split('?')[0] # remove query params
                    b_url = b_key.split(' ', 1)[1]
                    if fc_url == b_url:
                        matched = True
                        break
            if not matched:
                unmatched_frontend.append(fc)
                
    report = {
        'total_frontend_calls': len(frontend_unique),
        'total_backend_endpoints': len(backend_endpoints),
        'unmatched_frontend': unmatched_frontend,
        'backend_endpoints': backend_endpoints,
        'frontend_unique': list(frontend_unique.values())
    }
    
    with open(r'e:\1\scratch\coverage_data.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print("Coverage data generated.")
