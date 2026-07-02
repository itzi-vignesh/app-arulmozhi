from playwright.sync_api import sync_playwright
import worker
import sys

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
            res = worker.extract_table_structure(locator)
            print('Result:', res)
        except Exception as e:
            print('Exception:', e)
        browser.close()

if __name__ == "__main__":
    test()
