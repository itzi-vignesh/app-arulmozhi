import re

with open('worker.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update table_diff_summary_dict
dict_to_replace = """                                    "header_changes": [
                                        {
                                            "index": hc["index"],
                                            "old": hc["old"],
                                            "new": hc["new"]
                                        }
                                        for hc in diff_result.get("header_changes", [])
                                    ]
                                }"""

dict_new = """                                    "header_changes": [
                                        {
                                            "index": hc["index"],
                                            "old": hc["old"],
                                            "new": hc["new"]
                                        }
                                        for hc in diff_result.get("header_changes", [])
                                    ],
                                    "title_change": diff_result.get("title_change")
                                }"""

if dict_to_replace in content:
    content = content.replace(dict_to_replace, dict_new)
    print("Patched table_diff_summary_dict")
else:
    print("Could not find table_diff_summary_dict block")

# 2. Update fragments
frag_to_replace = """                                # Format change text fragment
                                fragments = []
                                for hc in diff_result.get("header_changes", []):"""

frag_new = """                                # Format change text fragment
                                fragments = []
                                if diff_result.get("title_change"):
                                    tc = diff_result["title_change"]
                                    fragments.append(f"Modified Title:\\n{tc['old']}\\n→\\n{tc['new']}")

                                for hc in diff_result.get("header_changes", []):"""

if frag_to_replace in content:
    content = content.replace(frag_to_replace, frag_new)
    print("Patched fragments")
else:
    print("Could not find fragments block")

with open('worker.py', 'w', encoding='utf-8') as f:
    f.write(content)
