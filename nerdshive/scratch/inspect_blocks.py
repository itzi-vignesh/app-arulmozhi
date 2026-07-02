import os

blocks = [
    "lines_1_75_step_3098.txt",
    "lines_75_180_step_3152.txt",
    "lines_300_400_step_3150.txt",
    "lines_760_810_step_3096.txt",
    "lines_780_880_step_3232.txt",
    "lines_810_950_step_3184.txt",
    "lines_880_925_step_3230.txt",
    "lines_1000_1125_step_3148.txt",
    "lines_1120_1140_step_3226.txt"
]

for b in blocks:
    path = os.path.join("scratch/blocks", b)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print(f"File {b}: lines count {len(lines)}")
        print(f"  First: {lines[0].strip() if lines else 'empty'}")
        print(f"  Last:  {lines[-1].strip() if lines else 'empty'}")
    else:
        print(f"File {b} does not exist")
