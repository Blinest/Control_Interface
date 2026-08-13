# main.py
import sys
from PyQt5.QtWidgets import QApplication, QDialog

from UI.main_window import MainWindow
from UI.log_window import LoginWindow
from Core.auth import AuthService


app = QApplication(sys.argv)
app.setStyle("Fusion")
auth_service = AuthService()

login = LoginWindow()
if login.exec_() == QDialog.Accepted:
    win = MainWindow(auth_service)
    win.show()
    sys.exit(app.exec_())
else:
    sys.exit(0)
