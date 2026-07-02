import re

with open('worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Old Screenshot Drawing
old_to_replace = """                                                    draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                     
                                            if drawn_any:"""

old_new = """                                                    draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True

                                            # 4. Modified Title -> RED outline
                                            if diff_result.get("title_change"):
                                                t_box = old_table.get("title_box")
                                                if t_box:
                                                    eb = t_box.get("element_box")
                                                    if eb:
                                                        tx, ty, tw, th_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                    else:
                                                        tx = max(0, t_box['x'] - table_x)
                                                        ty = max(0, t_box['y'] - (table_y + 40))
                                                        tw, th_h = t_box['width'], t_box['height']
                                                    draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(255, 0, 0, 255), width=4)
                                                    drawn_any = True
                                                     
                                            if drawn_any:"""

if old_to_replace in content:
    content = content.replace(old_to_replace, old_new)
    print("Patched old drawing")
else:
    print("Could not find old drawing block")


# 2. Update New Screenshot Drawing
new_to_replace = """                                                draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                     
                                        if drawn_any:"""

new_new = """                                                draw_overlay.rectangle([hx, hy, hx + hw, hy + hh], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True
                                                     
                                        # 4. Modified Title -> GREEN outline
                                        if diff_result.get("title_change"):
                                            t_box = new_table.get("title_box")
                                            if t_box:
                                                eb = t_box.get("element_box")
                                                if eb:
                                                    tx, ty, tw, th_h = eb['x'], eb['y'], eb['width'], eb['height']
                                                else:
                                                    tx = max(0, t_box['x'] - table_x)
                                                    ty = max(0, t_box['y'] - (table_y + 40))
                                                    tw, th_h = t_box['width'], t_box['height']
                                                draw_overlay.rectangle([tx, ty, tx + tw, ty + th_h], outline=(0, 255, 0, 255), width=4)
                                                drawn_any = True

                                        if drawn_any:"""

if new_to_replace in content:
    content = content.replace(new_to_replace, new_new)
    print("Patched new drawing")
else:
    print("Could not find new drawing block")

with open('worker.py', 'w', encoding='utf-8') as f:
    f.write(content)
