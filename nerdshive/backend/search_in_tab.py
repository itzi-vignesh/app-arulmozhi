with open("e:/1/src/components/OrganizationApprovalTab.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "seat" in line.lower() or "capacity" in line.lower():
            print(f"Line {idx+1}: {line.strip()}")
