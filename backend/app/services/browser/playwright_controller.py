from backend.app.services.browser.base_controller import BaseBrowserController


class PlaywrightController(BaseBrowserController):
    """
    Playwright浏览器控制器
    """

    def __init__(self, config: dict):
        super().__init__(config)
        self.browser_path = config.get('browser_path', '')

    def launch_browser(self):
        try:
            from playwright.sync_api import sync_playwright

            p = sync_playwright().start()

            proxy_settings = {
                "server": self.proxy,
                "bypass": "localhost",
            } if self.proxy else None

            launch_options = {
                "headless": False,
                "args": ['--lang=zh-CN'],
                "proxy": proxy_settings
            }

            if self.browser_path:
                launch_options["executable_path"] = self.browser_path

            b = p.chromium.launch(**launch_options)

            return p, b

        except Exception as e:
            return False, False

    def get_thread_page(self):
        browser = self.get_thread_browser()
        context = browser.new_context()
        return context.new_page()

    def handle_captcha(self, page):
        page.wait_for_event("request", lambda req: req.url.startswith("blob:https://iframe.hsprotect.net/"), timeout=22000)
        page.wait_for_timeout(800)

        for _ in range(0, self.max_captcha_retries + 1):
            page.keyboard.press('Enter')
            page.wait_for_timeout(11500)
            page.keyboard.press('Enter')

            try:
                page.wait_for_event("request", lambda req: req.url.startswith("https://browser.events.data.microsoft.com"), timeout=8000)
                try:
                    page.wait_for_event("request", lambda req: req.url.startswith("https://collector-pxzc5j78di.hsprotect.net/assets/js/bundle"), timeout=1700)
                    page.wait_for_timeout(2000)
                    continue

                except Exception:
                    if page.get_by_text('一些异常活动').count() or page.get_by_text('此站点正在维护，暂时无法使用，请稍后重试。').count() > 0:
                        return False
                    break

            except Exception:
                page.wait_for_timeout(5000)
                page.keyboard.press('Enter')
                page.wait_for_event("request", lambda req: req.url.startswith("https://browser.events.data.microsoft.com"), timeout=10000)

                try:
                    page.wait_for_event("request", lambda req: req.url.startswith("https://collector-pxzc5j78di.hsprotect.net/assets/js/bundle"), timeout=4000)
                except Exception:
                    break
                page.wait_for_timeout(500)
        else:
            return False

        return True

    def clean_up(self, page=None, type="all_browser"):
        if type == "done_browser" and page:
            context = page.context
            context.close()

        elif type == "all_browser":
            for p, b in self.active_resources:
                try:
                    b.close()
                except Exception:
                    pass
                try:
                    p.stop()
                except Exception:
                    pass
