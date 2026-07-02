import sys
from app.db.session import SessionLocal
from app.models.user import AuthUser, User, Admin, Superuser
from app.models.company import CompanyAdmin
from app.models.company import Company

def generate_report():
    db = SessionLocal()
    
    auth_users = db.query(AuthUser).all()
    users = db.query(User).all()
    admins = db.query(Admin).all()
    superusers = db.query(Superuser).all()
    company_admins = db.query(CompanyAdmin).all()
    companies = {c.id: c.company_name for c in db.query(Company).all()}
    
    # Mappings
    auth_map = {a.id: a for a in auth_users}
    
    # Find orphaned profiles
    user_auth_ids = {u.auth_id for u in users}
    admin_auth_ids = {a.auth_id for a in admins}
    super_auth_ids = {s.auth_id for s in superusers}
    company_admin_auth_ids = {c.auth_id for c in company_admins}
    
    all_profile_auth_ids = user_auth_ids | admin_auth_ids | super_auth_ids | company_admin_auth_ids
    
    orphaned_auths = [a for a in auth_users if a.id not in all_profile_auth_ids]
    
    lines = []
    lines.append("# Nerdshive User Audit Report")
    lines.append("")
    lines.append("## 1. SQL Queries Executed (via SQLAlchemy)")
    lines.append("```sql")
    lines.append("SELECT * FROM auth_users;")
    lines.append("SELECT * FROM users;")
    lines.append("SELECT * FROM admins;")
    lines.append("SELECT * FROM superuser;")
    lines.append("SELECT * FROM company_admins;")
    lines.append("SELECT * FROM companies;")
    lines.append("```")
    lines.append("")
    
    lines.append("## 2. Summary Statistics")
    lines.append(f"- **Total Auth Users:** {len(auth_users)}")
    lines.append(f"- **Total Customers (Users):** {len(users)}")
    lines.append(f"- **Total Admins:** {len(admins)}")
    lines.append(f"- **Total Superusers:** {len(superusers)}")
    lines.append(f"- **Total Company Admins:** {len(company_admins)}")
    lines.append(f"- **Total Orphaned Auth Records:** {len(orphaned_auths)}")
    lines.append("")
    
    lines.append("## 3. Account Details")
    lines.append("| Email | Role | Full Name | Active | Approved | Company Name | Login Working? | Profile Exists? | Created Date |")
    lines.append("|---|---|---|---|---|---|---|---|---|")
    
    for a in auth_users:
        email = a.email
        
        # Determine roles and profiles
        profile_exists = "No"
        roles = []
        full_name = "N/A"
        approved = "N/A"
        company_name = "N/A"
        
        # Check users
        user_prof = next((u for u in users if u.auth_id == a.id), None)
        if user_prof:
            roles.append("Customer")
            profile_exists = "Yes"
            full_name = user_prof.full_name
            approved = "Yes" if getattr(user_prof, 'is_approved', False) else "No"
            comp_id = user_prof.company_id
            if comp_id:
                company_name = companies.get(comp_id, "Unknown")
                
        # Check admins
        admin_prof = next((ad for ad in admins if ad.auth_id == a.id), None)
        if admin_prof:
            roles.append("Admin")
            profile_exists = "Yes"
            if hasattr(admin_prof, 'full_name') and admin_prof.full_name:
                full_name = admin_prof.full_name
            approved = "N/A"
            
        # Check superusers
        super_prof = next((s for s in superusers if s.auth_id == a.id), None)
        if super_prof:
            roles.append("Superuser")
            profile_exists = "Yes"
            if hasattr(super_prof, 'full_name') and super_prof.full_name:
                full_name = super_prof.full_name
            approved = "N/A"
            
        # Check company_admins
        ca_prof = next((ca for ca in company_admins if ca.auth_id == a.id), None)
        if ca_prof:
            roles.append("CompanyAdmin")
            profile_exists = "Yes"
            if hasattr(ca_prof, 'full_name') and ca_prof.full_name:
                full_name = ca_prof.full_name
            approved = "N/A"
            if getattr(ca_prof, 'company_id', None):
                company_name = companies.get(ca_prof.company_id, "Unknown")
                
        role_str = ", ".join(roles) if roles else "None (Orphan)"
        active_str = "Yes" if a.is_active else "No"
        
        # Login is working if active and has password hash
        login_works = "Yes" if a.is_active and a.hashed_password else "No"
        
        created = a.created_at.strftime('%Y-%m-%d %H:%M:%S') if a.created_at else "N/A"
        
        lines.append(f"| {email} | {role_str} | {full_name} | {active_str} | {approved} | {company_name} | {login_works} | {profile_exists} | {created} |")
        
    lines.append("")
    lines.append("## 4. Inconsistencies & Recommendations")
    
    inconsistencies = []
    if orphaned_auths:
        inconsistencies.append(f"Found {len(orphaned_auths)} orphaned auth_users records that have no corresponding profile in any role table.")
        for oa in orphaned_auths:
            inconsistencies.append(f"  - Orphan: {oa.email}")
            
    # Check for duplicate profiles
    for a in auth_users:
        count = 0
        if a.id in user_auth_ids: count += 1
        if a.id in admin_auth_ids: count += 1
        if a.id in super_auth_ids: count += 1
        if a.id in company_admin_auth_ids: count += 1
        if count > 1:
            inconsistencies.append(f"User {a.email} has multiple profiles across different role tables ({count} profiles).")
            
    if not inconsistencies:
        lines.append("No major inconsistencies found.")
    else:
        for inc in inconsistencies:
            lines.append(f"- {inc}")
            
    lines.append("")
    lines.append("### Recommended Fixes:")
    if orphaned_auths:
        lines.append("- Delete the orphaned `auth_users` records or assign them appropriate profiles.")
    lines.append("- Ensure transaction integrity when creating accounts to prevent `auth_users` records being created without a corresponding profile.")
    
    report_content = "\n".join(lines)
    
    with open('user_audit_report.md', 'w') as f:
        f.write(report_content)
        
    print("Report generated at user_audit_report.md")

if __name__ == '__main__':
    generate_report()
