import re

def fix_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix inactive string
    content = content.replace(
        "description:  has been made inactive. They will need to re-register to access the system.,",
        "description: ${user.full_name} has been made inactive. They will need to re-register to access the system.,"
    )
    
    # Fix reject user strings
    content = content.replace(
        "? User's application has been rejected. Reason:  \n          : User's application has been rejected and completely removed from the system.,",
        "? User's application has been rejected. Reason:  \n          : User's application has been rejected and completely removed from the system.,"
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('e:/1/src/pages/AdminDashboard.tsx')
fix_file('e:/1/src/pages/SuperuserDashboard.tsx')
print("Fixed files.")
