from playwright.sync_api import sync_playwright
import worker
import traceback

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content('''
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Ts hi</h2>
            <table>
                <tr><th>Srt De</th><th>Dpartme</th><th>Teer etas</th></tr>
                <tr><td>1</td><td>13-02-2026</td><td>Admin</td></tr>
            </table>
        </div>
        ''')
        locator = page.locator('.modal-content')
        try:
            table_locator = locator.first
            new_table = worker.extract_table_structure(table_locator)
            if not new_table:
                raise ValueError("Failed to extract table structure")
                
            print("new_table:", new_table)
            print("[TABLE STRUCTURE]")
            print("Headers:", new_table.get("headers", []))
            print("Rows:", len(new_table.get("rows", [])))
            
            headers_str = " | ".join(new_table.get("headers", []))
            rows_lines = []
            for row in new_table.get("rows", []):
                rows_lines.append(row.get("text", ""))
            text_snapshot = f"Headers: {headers_str}\n" + "\n".join(rows_lines)
            print("text_snapshot:", repr(text_snapshot))
            
            old_table = {"headers": [], "rows": []}
            diff_result = worker.compute_table_diff(old_table, new_table)
            print("diff_result keys:", diff_result.keys())
            
        except Exception as e:
            traceback.print_exc()
        browser.close()

if __name__ == "__main__":
    test()
