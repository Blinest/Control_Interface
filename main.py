# main.py
import sys
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import QApplication, QDialog

from UI.main_window import MainWindow
from UI.log_window import LoginWindow
from Core.auth import AuthService


QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
app = QApplication(sys.argv)
app.setStyle("Fusion")
app.setFont(QFont("Noto Sans CJK SC", 13))
auth_service = AuthService()

login = LoginWindow()
if login.exec_() == QDialog.Accepted:
    win = MainWindow(auth_service)
    win.showMaximized()
    sys.exit(app.exec_())
else:
    sys.exit(0)
