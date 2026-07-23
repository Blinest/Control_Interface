import logging
import sys

import matplotlib

matplotlib.use("Qt5Agg")
matplotlib.rcParams["font.sans-serif"] = [
    "WenQuanYi Micro Hei",
    "Noto Sans CJK SC",
    "SimHei",
    "Microsoft YaHei",
    "DejaVu Sans",
]
matplotlib.rcParams["axes.unicode_minus"] = False
logging.getLogger("matplotlib").setLevel(logging.WARNING)

from PyQt5.QtWidgets import QApplication, QDialog

from Core.auth import AuthService
from UI.log_window import LoginWindow
from UI.main_window import MainWindow


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("SoftUI")
    app.setStyle("Fusion")

    auth_service = AuthService()
    login = LoginWindow()
    if login.exec_() == QDialog.Accepted:
        win = MainWindow(auth_service)
        win.show()
        return app.exec_()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
