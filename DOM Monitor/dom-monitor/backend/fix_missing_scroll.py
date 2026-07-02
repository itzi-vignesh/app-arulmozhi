import os

with open('worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update monitor.last_value with post-scroll coordinates
target = "monitor.last_value = json.dumps(new_table)"
replacement = """                                new_table_recalc = extract_table_structure(table_locator)
                                if new_table_recalc:
                                    monitor.last_value = json.dumps(new_table_recalc)
                                else:
                                    monitor.last_value = json.dumps(new_table)"""
content = content.replace(target, replacement)

# 2. Add elif change_type == "removed" to draw GREEN box
target2 = """                                            elif change_type == "modified":"""
replacement2 = """                                            elif change_type == "removed":
                                                # Draw GREEN around the adjacent row to show where it was removed from
                                                a_box = coords.get("element_box") or coords.get("box")
                                                if a_box:
                                                    ax, ay, aw, ah = a_box['x'], a_box['y'], a_box['width'], a_box['height']
                                                    draw.rectangle([ax, ay, ax + aw, ay + ah], outline="green", width=4)
                                                    drawn_any = True
                                            elif change_type == "modified":"""
content = content.replace(target2, replacement2)

with open('worker.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied fixes to worker.py")
