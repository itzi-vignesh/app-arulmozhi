import os

orig_path = "src/pages/CorporateDashboard.tsx"
with open(orig_path, 'r', encoding='utf-8') as f:
    orig_lines = f.readlines()

print("Original lines count:", len(orig_lines))

def get_block_lines(filename):
    path = os.path.join("scratch/blocks", filename)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().splitlines()

# Rebuilding step-by-step
# 1. Imports and state declarations (1-180)
block_1 = get_block_lines("lines_1_75_step_3098.txt")
block_2 = get_block_lines("lines_75_180_step_3152.txt")

# Let's align imports and states:
# block_1 ends at: if (empsResult.status === 'fulfilled') setEmployees(empsResult.value);
# block_2 starts at: if (empsResult.status === 'fulfilled') setEmployees(empsResult.value);
# So we concatenate block_1 and block_2[1:]
part_1 = block_1 + block_2[1:]

# 2. Reconstruct the middle clean lines (180 to 300 in clean file, which corresponds to handling saveCompanyInfo, edit modals, etc.)
# In the original file, we have:
# line 177:   setLoading(true);
# Let's search in original file where 'setLoading(true);' is inside saveCompanyInfo:
original_idx = -1
for i, line in enumerate(orig_lines):
    if "await corporateService.updateCompanyInfo(editData);" in line:
        original_idx = i
        break
print("Found original saveCompanyInfo index:", original_idx)

# Let's take original lines from the match to the start of return (which is line 252: return ()
original_idx_return = -1
for i, line in enumerate(orig_lines):
    if "return (" in line and i > original_idx:
        original_idx_return = i
        break
print("Found original return index:", original_idx_return)

part_2 = [line.rstrip('\n') for line in orig_lines[original_idx:original_idx_return]]

# 3. Reconstruct return header and main tabs (300 to 400)
# block_3 (lines_300_400_step_3150.txt) starts at: setRequestSeatsModalOpen(true); (which is inside the component return or some action, wait)
# Wait! Let's check block_3 content.
block_3 = get_block_lines("lines_300_400_step_3150.txt")
print("Block 3 starts with:", block_3[0])
print("Block 3 ends with:", block_3[-1])

# Wait, in orig_lines:
# 'setRequestSeatsModalOpen(true);' is in:
# const openRequestSeatsModal = () => {
#   setRequestedSeatsInput((companyInfo?.max_employee_capacity || 0) + 1);
#   setRequestSeatsModalOpen(true);
# };
# Let's find this index in clean file:
seats_modal_idx = -1
for i, line in enumerate(orig_lines):
    if "setRequestSeatsModalOpen(true);" in line:
        seats_modal_idx = i
        break
print("Seats modal index in clean file:", seats_modal_idx)
