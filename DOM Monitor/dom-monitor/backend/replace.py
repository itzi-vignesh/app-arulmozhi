import sys

old = """                    if (!found) {
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                for (let idx = 0; idx < norm_headers.length; idx++) {
                                    if (norm_headers[idx].includes(cand)) {
                                        if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                            key = cellTexts[idx].trim();
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }"""

new_text = """                    if (!found) {
                        for (const candList of candidates) {
                            for (const cand of candList) {
                                const safeCand = cand.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                                const regex = new RegExp("\\\\b" + safeCand + "\\\\b", "i");
                                for (let idx = 0; idx < norm_headers.length; idx++) {
                                    if (regex.test(norm_headers[idx])) {
                                        if (idx < cellTexts.length && cellTexts[idx].trim()) {
                                            key = cellTexts[idx].trim();
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }"""

content = open('e:/2/dom-monitor/backend/worker.py').read()
if old in content:
    print('Found!', content.count(old), 'occurrences.')
    with open('e:/2/dom-monitor/backend/worker.py', 'w') as f:
        f.write(content.replace(old, new_text))
    print('Replaced successfully')
else:
    print('Not found')
