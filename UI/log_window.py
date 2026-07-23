from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from Core.auth import AuthService

from . import styles


class LoginWindow(QDialog):
    """登录窗口"""

    def __init__(self):
        super().__init__()
        self.auth_service = AuthService()
        self._init_ui()
        self._load_saved_login_info()

    def _init_ui(self):
        self.setWindowTitle("系统登录 - 柔性臂控制平台")
        screen = QApplication.primaryScreen().availableGeometry()
        self.resize(int(screen.width() * 0.42), int(screen.height() * 0.58))
        self.setMinimumSize(720, 560)
        self.setSizeGripEnabled(True)
        self.setStyleSheet(f"background-color: {styles.LOGIN_BG}")

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(32, 32, 32, 32)
        main_layout.setSpacing(0)

        top_spacer = QWidget()
        top_spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        bottom_spacer = QWidget()
        bottom_spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        center_widget = QFrame()
        center_widget.setStyleSheet(styles.style_login_center())
        center_widget.setMinimumSize(500, 500)
        center_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        layout = QVBoxLayout(center_widget)
        layout.setContentsMargins(48, 48, 48, 48)
        layout.setSpacing(16)

        title = QLabel("柔性臂控制平台")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(
            f"font-size: 15pt; font-weight: bold; color: {styles.COLOR_DARK}; "
            "margin-bottom: 20px; border: none;"
        )

        form_layout = QFormLayout()
        self.user_input = QLineEdit()
        self.user_input.setPlaceholderText("请输入账号")
        self.pass_input = QLineEdit()
        self.pass_input.setPlaceholderText("请输入密码")
        self.pass_input.setEchoMode(QLineEdit.Password)

        for widget in [self.user_input, self.pass_input]:
            widget.setStyleSheet(styles.style_login_input())

        form_layout.addRow(QLabel("账号:", styleSheet="font-size: 10pt; border: none;"), self.user_input)
        form_layout.addRow(QLabel("密码:", styleSheet="font-size: 10pt; border: none;"), self.pass_input)

        checkbox_layout = QHBoxLayout()
        self.remember_checkbox = QCheckBox("记住密码")
        self.remember_checkbox.setStyleSheet(
            f"""
            QCheckBox {{
                font-size: 8pt;
                color: #333;
                spacing: 8px;
                border: none;
            }}
            QCheckBox::indicator {{
                width: 18px;
                height: 18px;
                border: 2px solid {styles.COLOR_DARK};
                border-radius: 3px;
                background-color: white;
            }}
            QCheckBox::indicator:checked {{
                background-color: {styles.COLOR_DARK};
            }}
            """
        )
        checkbox_layout.addWidget(self.remember_checkbox)
        checkbox_layout.addStretch()

        btn_layout = QHBoxLayout()
        self.btn_login = QPushButton("登录")
        self.btn_login.setStyleSheet(styles.style_login_btn("black", "grey"))
        self.btn_login.clicked.connect(self.handle_login)

        self.btn_register = QPushButton("注册")
        self.btn_register.setStyleSheet(styles.style_login_btn("#555555", "#777777"))
        self.btn_register.clicked.connect(self.handle_register)

        btn_layout.addWidget(self.btn_login)
        btn_layout.addWidget(self.btn_register)

        self.link_change_pwd = QPushButton("修改密码")
        self.link_change_pwd.setStyleSheet(
            """
            QPushButton {
                background-color: transparent;
                color: #333;
                font-size: 10pt;
                border: none;
                text-decoration: none;
                padding: 5px;
            }
            QPushButton:hover {
                color: #0078D7;
                text-decoration: underline;
                font-weight: bold;
            }
            QPushButton:pressed {
                color: #0056b3;
            }
            """
        )
        self.link_change_pwd.clicked.connect(self.handle_change_password)

        layout.addWidget(title)
        layout.addLayout(form_layout)
        layout.addSpacing(10)
        layout.addLayout(checkbox_layout)
        layout.addSpacing(20)
        layout.addLayout(btn_layout)
        layout.addWidget(self.link_change_pwd, alignment=Qt.AlignHCenter)
        layout.addStretch(1)

        main_layout.addWidget(top_spacer, 1)
        main_layout.addWidget(center_widget, 2)
        main_layout.addWidget(bottom_spacer, 1)

        self.user_input.returnPressed.connect(self.handle_login)
        self.pass_input.returnPressed.connect(self.handle_login)

    def _load_saved_login_info(self):
        username, password, remember = self.auth_service.backend.get_saved_login_info()
        if remember and username:
            self.user_input.setText(username)
            self.pass_input.setText(password)
            self.remember_checkbox.setChecked(True)

    def _save_login_info(self, username: str, password: str, remember: bool):
        self.auth_service.backend.save_login_info(username, password, remember)

    def handle_login(self):
        username = self.user_input.text().strip()
        password = self.pass_input.text()

        if not username or not password:
            QMessageBox.warning(self, "错误", "账号和密码不能为空")
            return

        success, message = self.auth_service.login(username, password)
        if success:
            self._save_login_info(username, password, self.remember_checkbox.isChecked())
            self.accept()
        else:
            QMessageBox.warning(self, "错误", message)
            self.pass_input.clear()
            self.pass_input.setFocus()

    def handle_register(self):
        dialog = RegisterDialog(self)
        if dialog.exec_() == QDialog.Accepted and dialog.registered_username:
            self.user_input.setText(dialog.registered_username)
            self.pass_input.clear()
            self.pass_input.setFocus()

    def handle_change_password(self):
        dialog = ChangePasswordDialog(self.auth_service, self)
        if dialog.exec_() == QDialog.Accepted:
            if self.remember_checkbox.isChecked() and self.auth_service.is_logged_in():
                current_user = self.auth_service.get_current_user()
                if current_user == self.user_input.text().strip():
                    self._save_login_info(current_user, dialog.new_password, True)
                    self.pass_input.setText(dialog.new_password)


class RegisterDialog(QDialog):
    """注册对话框"""

    def __init__(self, parent=None, is_admin=False):
        super().__init__(parent)
        self.auth_service = AuthService()
        self.registered_username = None
        self.is_admin_context = is_admin
        self._init_ui()

    def _init_ui(self):
        self.setWindowTitle("用户注册")
        self.setFixedSize(500, 450 if self.is_admin_context else 400)
        self.setStyleSheet(f"background-color: {styles.LOGIN_CENTER};")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(15)

        title = QLabel("创建新账号" if not self.is_admin_context else "创建用户账号")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 12pt; font-weight: bold; border: none;")
        layout.addWidget(title)

        form_widget = QWidget()
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(10)

        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("至少3个字符")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("至少3个字符")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.confirm_input = QLineEdit()
        self.confirm_input.setPlaceholderText("再次输入密码")
        self.confirm_input.setEchoMode(QLineEdit.Password)

        for widget in [self.username_input, self.password_input, self.confirm_input]:
            widget.setStyleSheet(styles.style_login_input())

        form_layout.addRow(QLabel("用户名:", styleSheet="font-size: 12pt;"), self.username_input)
        form_layout.addRow(QLabel("密码:", styleSheet="font-size: 12pt;"), self.password_input)
        form_layout.addRow(QLabel("确认密码:", styleSheet="font-size: 12pt;"), self.confirm_input)

        if self.is_admin_context:
            self.role_combo = QComboBox()
            self.role_combo.addItems(["user", "admin"])
            self.role_combo.setStyleSheet(styles.style_login_input())
            form_layout.addRow(QLabel("角色:", styleSheet="font-size: 12pt;"), self.role_combo)

        layout.addWidget(form_widget)

        btn_layout = QHBoxLayout()
        btn_register = QPushButton("注册")
        btn_register.setStyleSheet(styles.style_login_btn("black", "grey"))
        btn_register.clicked.connect(self.handle_register)

        btn_cancel = QPushButton("取消")
        btn_cancel.setStyleSheet(styles.style_login_btn("#999", "#777"))
        btn_cancel.clicked.connect(self.reject)

        btn_layout.addWidget(btn_register)
        btn_layout.addWidget(btn_cancel)
        layout.addLayout(btn_layout)

    def handle_register(self):
        username = self.username_input.text().strip()
        password = self.password_input.text()
        confirm = self.confirm_input.text()

        role = "user"
        if self.is_admin_context and hasattr(self, "role_combo"):
            role = self.role_combo.currentText()

        success, message = self.auth_service.register(username, password, confirm)
        if success and self.is_admin_context and role == "admin":
            users = self.auth_service.backend._load_users()
            if username in users:
                users[username]["role"] = "admin"
                self.auth_service.backend._save_users(users)

        if success:
            QMessageBox.information(self, "成功", message)
            self.registered_username = username
            self.accept()
        else:
            QMessageBox.warning(self, "错误", message)


class ChangePasswordDialog(QDialog):
    """修改密码对话框"""

    def __init__(self, auth_service: "AuthService", parent=None):
        super().__init__(parent)
        self.auth_service = auth_service
        self.password_changed = False
        self.new_password = ""
        self._init_ui()

    def _init_ui(self):
        self.setWindowTitle("修改密码")
        self.setFixedSize(500, 450)
        self.setStyleSheet(f"background-color: {styles.LOGIN_CENTER};")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(15)

        title = QLabel("修改密码")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 10pt; font-weight: bold; border: none;")
        layout.addWidget(title)

        form_widget = QWidget()
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(10)

        self.old_password = QLineEdit()
        self.old_password.setPlaceholderText("输入旧密码")
        self.old_password.setEchoMode(QLineEdit.Password)

        self.new_password = QLineEdit()
        self.new_password.setPlaceholderText("至少3个字符")
        self.new_password.setEchoMode(QLineEdit.Password)

        self.confirm_password = QLineEdit()
        self.confirm_password.setPlaceholderText("再次输入新密码")
        self.confirm_password.setEchoMode(QLineEdit.Password)

        for widget in [self.old_password, self.new_password, self.confirm_password]:
            widget.setStyleSheet(styles.style_login_input())

        form_layout.addRow(QLabel("旧密码:", styleSheet="font-size: 10pt;"), self.old_password)
        form_layout.addRow(QLabel("新密码:", styleSheet="font-size: 10pt;"), self.new_password)
        form_layout.addRow(QLabel("确认密码:", styleSheet="font-size: 10pt;"), self.confirm_password)

        if not self.auth_service.is_logged_in():
            self.username_input = QLineEdit()
            self.username_input.setPlaceholderText("输入用户名")
            self.username_input.setStyleSheet(styles.style_login_input())
            form_layout.insertRow(0, QLabel("用户名:", styleSheet="font-size: 10pt;"), self.username_input)

        layout.addWidget(form_widget)

        btn_layout = QHBoxLayout()
        btn_confirm = QPushButton("确认修改")
        btn_confirm.setStyleSheet(styles.style_login_btn("black", "grey"))
        btn_confirm.clicked.connect(self.handle_change_password)

        btn_cancel = QPushButton("取消")
        btn_cancel.setStyleSheet(styles.style_login_btn("#999", "#777"))
        btn_cancel.clicked.connect(self.reject)

        btn_layout.addWidget(btn_confirm)
        btn_layout.addWidget(btn_cancel)
        layout.addLayout(btn_layout)

    def handle_change_password(self):
        old_pwd = self.old_password.text()
        new_pwd = self.new_password.text()
        confirm_pwd = self.confirm_password.text()

        if new_pwd != confirm_pwd:
            QMessageBox.warning(self, "错误", "两次输入的新密码不一致")
            return

        if hasattr(self, "username_input"):
            username = self.username_input.text().strip()
            if not username:
                QMessageBox.warning(self, "错误", "请输入用户名")
                return
            success, message = self.auth_service.backend.change_password(username, old_pwd, new_pwd)
        else:
            success, message = self.auth_service.change_password(old_pwd, new_pwd)
            if success:
                self.password_changed = True
                self.new_password = new_pwd

        if success:
            QMessageBox.information(self, "成功", message)
            self.accept()
        else:
            QMessageBox.warning(self, "错误", message)
