import os
import sys
import time

from PyQt5.QtCore import Qt, QTimer, pyqtSignal, pyqtSlot
from PyQt5.QtWidgets import (QApplication, QCheckBox, QComboBox, QDialog, QDockWidget,
                             QHBoxLayout, QLabel, QLineEdit, QMainWindow, QMessageBox,
                             QPushButton, QSizePolicy, QSplitter, QTabWidget, QTextEdit,
                             QToolBar, QVBoxLayout, QWidget)
import serial
import serial.tools.list_ports

from Core.frame_router import MultiHeaderFrameAssembler
from Core.GraphController_lqts import GraphController as LqtsGraphController
from Core.logger import default_log_manager as log_manager
from Core.serial_worker import SerialWorker
from UI.device_tab_lqts import LqtsDeviceTab
from UI.device_tab_lyz import LyzDeviceTab
from UI.device_tab_sw import SwDeviceTab
from UI.graph_window_lqts import GraphWindowUI as LqtsGraphWindowUI
from UI.Local3DViewer import Local3DViewer
from UI.log_manager_win import LogManagerWindow
from UI.log_window import LoginWindow
from UI.widgets import AnimatedButton


DEVICE_CONFIG = {
    "lqts": {
        "title": "LQTS",
        "tab_class": LqtsDeviceTab,
        "model_file": "LQTS.html",
    },
    "lyz": {
        "title": "LYZ",
        "tab_class": LyzDeviceTab,
        "model_file": "LYZ.html",
    },
    "sw": {
        "title": "SW",
        "tab_class": SwDeviceTab,
        "model_file": None,
    },
}


class ProbeTab(QWidget):
    """串口探测页：读取首个 AA/BB/CC 状态帧后通知主窗口切换界面。"""

    signal_detected = pyqtSignal(str, bytes)
    signal_error = pyqtSignal(str)

    def __init__(self, port_name):
        super().__init__()
        self.port_name = port_name
        self.detected = False
        self.frame_assembler = MultiHeaderFrameAssembler()
        self.worker = SerialWorker(port_name)
        self.worker.signal_data.connect(self.parse_data)
        self.worker.signal_error.connect(self._on_error)
        self._init_ui()
        self.worker.start()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.addStretch()
        title = QLabel(f"界面加载中...")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 16pt; font-weight: bold; color: #333;")
        layout.addWidget(title)
        layout.addStretch()

    @pyqtSlot(bytes)
    def parse_data(self, data):
        if self.detected:
            return
        self.frame_assembler.feed(data)
        for kind, frame in self.frame_assembler.get_frames():
            self.detected = True
            self.signal_detected.emit(kind, frame)
            return

    def _on_error(self, message):
        self.signal_error.emit(message)

    def stop(self):
        if hasattr(self, "worker") and self.worker:
            self.worker.stop()


class MainWindow(QMainWindow):
    def __init__(self, auth_service=None):
        super().__init__()
        self.auth_service = auth_service
        self.setWindowTitle("喷管统一控制界面")
        self.setWindowFlags(self.windowFlags() | Qt.WindowMaximizeButtonHint)

        screen = QApplication.primaryScreen()
        size = screen.availableGeometry().size()
        new_height = min(size.height(), 800)
        self.resize(size.width(), new_height)

        self.devices = {}
        self.probes = {}
        self.device_kinds = {}
        self.auto_added_ports = set()
        self.target_port = "COM3" if sys.platform == "win32" else "/dev/ttyCH341USB0"

        self.statusBar().showMessage("就绪")
        self._setup_toolbar()
        self._setup_tabs()
        self._setup_log_dock()
        self._setup_style()

        self.auto_connect_timer = QTimer()
        self.auto_connect_timer.timeout.connect(self.auto_check_target_port)
        self.auto_connect_timer.start(200)

        if self.auth_service and self.auth_service.is_logged_in():
            username = self.auth_service.get_current_user()
            QTimer.singleShot(200, lambda: self._show_welcome(username))

    def _setup_toolbar(self):
        toolbar = QToolBar("管理栏")
        self.addToolBar(toolbar)

        self.combo_ports = QComboBox()
        self.refresh_ports()
        self.btn_add = AnimatedButton("🔌 接入新设备", "grey", "#505050")
        self.btn_add.setProperty("class", "page-btn")
        self.btn_add.clicked.connect(self.add_device)
        toolbar.addWidget(QLabel(" 端口:"))
        toolbar.addWidget(self.combo_ports)
        toolbar.addWidget(self.btn_add)
        toolbar.addSeparator()

        toolbar.addWidget(QLabel("手动输入: "))
        self.manual_port_edit = QLineEdit()
        self.manual_port_edit.setPlaceholderText(self.target_port)
        self.manual_port_edit.setFixedWidth(150)
        self.btn_manual_add = AnimatedButton("➕ 手动添加", "grey", "#505050")
        self.btn_manual_add.setProperty("class", "page-btn")
        self.btn_manual_add.clicked.connect(self.add_manual_device)
        toolbar.addWidget(self.manual_port_edit)
        toolbar.addWidget(self.btn_manual_add)
        toolbar.addSeparator()

        self.action_motor_graph = toolbar.addAction("📈 电机反馈数据曲线", lambda: self.open_graph("motor"))
        self.action_sensor_graph = toolbar.addAction("📉 IMU反馈数据曲线", lambda: self.open_graph("sensor"))
        self.separator_graph = toolbar.addSeparator()
        self.action_bend_graph = toolbar.addAction("📊 喷管历史曲线", self.open_bend_graph)
        self.separator_device_tools = toolbar.addSeparator()

        self.log_manager_action = toolbar.addAction("📋 日志管理")
        self.log_manager_action.triggered.connect(self.open_log_manager)

        self.btn_3D = toolbar.addAction("🌐 3D模型")
        self.btn_3D.triggered.connect(self.open_3d_viewer)

        if self.auth_service and not self.auth_service.is_admin():
            self.log_manager_action.setVisible(False)
            self.btn_3D.setVisible(False)

        self._setup_toolbar_with_user(toolbar)
        self._update_context_actions()

    def _setup_toolbar_with_user(self, toolbar):
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        toolbar.addWidget(spacer)

        if self.auth_service:
            username = self.auth_service.get_current_user()
            role = self.auth_service.get_current_role()
            role_icon = "👑" if role == "admin" else "👤"
            self.role_text = "管理员" if role == "admin" else "普通用户"
            user_label = QLabel(f"{role_icon} {username} ({self.role_text})")
            user_label.setStyleSheet("""
                font-weight: bold;
                color: #0078D7;
                padding: 5px 15px;
                font-size: 13pt;
                background-color: rgba(255, 255, 255, 0.3);
                border-radius: 15px;
                margin-right: 5px;
            """)
            toolbar.addWidget(user_label)

            btn_logout = QPushButton("🚪 登出")
            btn_logout.setProperty("class", "page-btn")
            btn_logout.setStyleSheet("""
                QPushButton {
                    background-color: #555;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 4px;
                    font-size: 13pt;
                }
                QPushButton:hover { background-color: #D13438; }
            """)
            btn_logout.clicked.connect(self.logout)
            toolbar.addWidget(btn_logout)

    def _setup_tabs(self):
        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.close_device)
        self.tabs.currentChanged.connect(lambda _: self._update_context_actions())
        self.setCentralWidget(self.tabs)

    def _setup_log_dock(self):
        dock_log = QDockWidget("通信日志与调试器", self)
        log_widget = QWidget()
        log_layout = QVBoxLayout(log_widget)
        log_ctrl_layout = QHBoxLayout()
        self.chk_debug = QCheckBox("🐛 启用 Debug 模式 (分屏同步显示底层发送的十六进制码)")
        self.chk_debug.setStyleSheet("font-weight: bold; color: #D13438;")
        self.chk_debug.stateChanged.connect(self.toggle_debug_view)
        log_ctrl_layout.addWidget(self.chk_debug)
        log_ctrl_layout.addStretch()
        log_layout.addLayout(log_ctrl_layout)

        self.log_splitter = QSplitter(Qt.Horizontal)
        self.text_log = QTextEdit()
        self.text_log.setReadOnly(True)
        self.text_log.setStyleSheet("background-color: #a7a8aa; border: 3px solid #E0E0E0;")
        self.text_raw = QTextEdit()
        self.text_raw.setReadOnly(True)
        self.text_raw.setStyleSheet("background-color: #1E1E1E; color: #4EC9B0; font-family: Consolas; border: 3px solid #1E1E1E;")
        self.text_raw.hide()
        self.log_splitter.addWidget(self.text_log)
        self.log_splitter.addWidget(self.text_raw)
        log_layout.addWidget(self.log_splitter)
        dock_log.setWidget(log_widget)
        self.addDockWidget(Qt.BottomDockWidgetArea, dock_log)

    def _setup_style(self):
        self.setStyleSheet("""
            QMainWindow, QWidget {
                background: #d9d9d6;
                font-family: 'Microsoft YaHei UI', '微软雅黑 Control_Interface';
                font-size: 13pt;
            }
            QToolBar { spacing: 8px; padding: 6px; }
            QToolButton { font-size: 13pt; padding: 8px 10px; }
            QLabel, QCheckBox, QComboBox, QLineEdit, QTextEdit { font-size: 13pt; }
            QTabBar::tab { font-size: 13pt; padding: 10px 18px; min-width: 110px; }
            QPushButton { padding: 10px 14px; border: 3px solid black; border-radius: 4px; background: #53565b; font-size: 13pt; }
            QPushButton[class="page-btn"] { background-color: grey; color: white; font-weight: bold; border: 3px solid #ccc; border-radius: 4px; padding: 8px 14px; }
            QPushButton[class="emergency"] { border-radius: 15px; background-color: red; color: #a7a8aa; font-weight: bold; font-size: 14pt; border: none; }
            QGroupBox { border: 3px solid white; border-radius: 5px; margin-top: 18px; padding: 8px; font-size: 14pt; font-weight:bold; }
            QComboBox, QLineEdit { padding: 6px; min-height: 30px; border: 2px solid white; border-radius: 3px; background: #d9d9d6; color: #333; }
            QStatusBar { background-color: #d7d2cb; color: #333; font-weight: bold; border-top: 2px solid #ccc; font-size: 13pt; }
            QStatusBar::item { border: none; }
        """)

    def logout(self):
        reply = QMessageBox.question(self, "确认登出", "确定要退出登录吗？", QMessageBox.Yes | QMessageBox.No)
        if reply != QMessageBox.Yes:
            return

        if self.auth_service:
            self.auth_service.logout()
        self.auto_connect_timer.stop()
        self._stop_all_ports()
        self.close()

        self.login_window = LoginWindow()
        if self.login_window.exec_() == QDialog.Accepted:
            self.main_window = MainWindow(self.auth_service)
            self.main_window.show()

    def _show_welcome(self, username):
        self.setWindowTitle(f"喷管控制界面 - 当前用户: {username}")
        self.statusBar().showMessage(f"👤 当前用户: {username} | ✅ 就绪", 0)
        self.log("=" * 50, level="INFO")
        self.log("🎉 欢迎使用喷管控制平台", level="INFO")
        self.log(f"👤 当前登录用户: {username}({getattr(self, 'role_text', '')})", level="INFO")
        self.log(f"🕐 登录时间: {time.strftime('%Y-%m-%d %H:%M:%S')}", level="INFO")
        self.log("=" * 50, level="INFO")

    def log(self, msg, raw_data=None, level="INFO", port=None):
        t_str = time.strftime("%H:%M:%S")
        if not self.chk_debug.isChecked():
            formatted_msg = log_manager.create_log_entry(level, msg, port, raw_data)
            self.text_log.append(f"[{t_str}] {formatted_msg}")
            self.text_log.verticalScrollBar().setValue(self.text_log.verticalScrollBar().maximum())

        if self.chk_debug.isChecked() and raw_data is not None:
            hex_str = " ".join([f"{b:02X}" for b in raw_data])
            self.text_raw.append(f"[{t_str}] TX >>  {hex_str}")
            self.text_raw.verticalScrollBar().setValue(self.text_raw.verticalScrollBar().maximum())
            debug_log_msg = f"[{msg}] 发送原始数据: {hex_str}" if msg else f"发送原始数据: {hex_str}"
            debug_formatted = log_manager.create_log_entry("DEBUG", debug_log_msg, port)
            self.text_log.append(f"[{t_str}] {debug_formatted}")
            self.text_log.verticalScrollBar().setValue(self.text_log.verticalScrollBar().maximum())

    def toggle_debug_view(self, state):
        if state == Qt.Checked:
            self.text_raw.show()
            self.text_raw.append(">>> DEBUG_MODE_ENABLED: HEX MACHINE CODE TERMINAL <<<")
        else:
            self.text_raw.hide()

    _PORT_BLACKLIST_KEYWORDS = [
        "BLUETOOTH", "BTHENUM", "MODEM", "IRDA", "VIRTUAL", "VCOM",
        "SERIAL MOUSE", "FAX", "RAS", "VPN",
    ]

    def _is_real_device(self, port_info):
        desc = (port_info.description or "").upper()
        hwid = (port_info.hwid or "").upper()
        for kw in self._PORT_BLACKLIST_KEYWORDS:
            if kw in desc or kw in hwid:
                return False
        return True

    def _get_valid_ports(self):
        valid_ports = []
        seen = set()
        all_ports = serial.tools.list_ports.comports()
        existing_ports = [port.device for port in all_ports]

        if self.target_port in existing_ports:
            seen.add(self.target_port)
            valid_ports.append(self.target_port)

        for port_info in all_ports:
            device = port_info.device
            if device in seen:
                continue
            if sys.platform == "win32":
                is_valid = device.upper().startswith("COM") and self._is_real_device(port_info)
            else:
                is_system_port = device.startswith("/dev/ttyS") or device.startswith("/dev/ttyAMA")
                device_upper = device.upper()
                is_valid = not is_system_port and any(keyword in device_upper for keyword in ("USB", "ACM", "CH341", "CH340"))
            if is_valid:
                seen.add(device)
                valid_ports.append(device)

        # pyserial 在 Linux 上枚举端口时使用固定 glob 模式，不包含 CH341 官方驱动
        # 创建的 /dev/ttyCH341USB0 这类设备，这里手动补全。
        if sys.platform != "win32":
            try:
                import glob as _glob
                import os as _os
                ch341_candidates = _glob.glob('/dev/ttyCH341USB*')
                for device in ch341_candidates:
                    if device not in seen:
                        seen.add(device)
                        valid_ports.append(device)
            except Exception:
                pass
        return valid_ports

    def auto_check_target_port(self):
        valid_ports = self._get_valid_ports()
        if not valid_ports:
            if self.combo_ports.currentText() != "无可用串口":
                self.combo_ports.clear()
                self.combo_ports.addItem("无可用串口")
            return

        current_items = [self.combo_ports.itemText(i) for i in range(self.combo_ports.count())]
        if set(valid_ports) != set(current_items):
            old_selection = self.combo_ports.currentText()
            self.combo_ports.clear()
            self.combo_ports.addItems(valid_ports)
            if self.target_port in valid_ports and old_selection != self.target_port:
                self.combo_ports.setCurrentText(self.target_port)
            elif old_selection in valid_ports:
                self.combo_ports.setCurrentText(old_selection)

        for port in valid_ports:
            if port not in self.devices and port not in self.probes and port not in self.auto_added_ports:
                self.connect_port(port)
                self.auto_added_ports.add(port)

    def refresh_ports(self):
        self.combo_ports.clear()
        valid_ports = self._get_valid_ports()
        if valid_ports:
            self.combo_ports.addItems(valid_ports)
            if self.target_port in valid_ports:
                self.combo_ports.setCurrentText(self.target_port)
        else:
            self.combo_ports.addItem("无可用串口")

    def connect_port(self, port):
        if port in self.devices or port in self.probes:
            return
        probe = ProbeTab(port)
        probe.signal_detected.connect(lambda kind, frame, p=port: self._on_device_detected(p, kind, frame))
        probe.signal_error.connect(lambda message, p=port: self._on_probe_error(p, message))
        self.probes[port] = probe
        self.tabs.addTab(probe, f"🔎 {port} - 界面加载中")
        self.tabs.setCurrentWidget(probe)
        self.statusBar().showMessage(f"正在识别 {port} 的下位机类型...")

    def _on_device_detected(self, port, kind, first_frame):
        probe = self.probes.pop(port, None)
        tab_index = self.tabs.indexOf(probe) if probe else -1
        if probe:
            probe.stop()
            if tab_index >= 0:
                self.tabs.removeTab(tab_index)
            probe.deleteLater()

        config = DEVICE_CONFIG.get(kind)
        if not config:
            self.log(f"❌ 未知设备类型: {kind}", level="ERROR", port=port)
            return

        device_tab = config["tab_class"](port, self.log, self.auth_service)
        device_tab.device_kind = kind
        self.devices[port] = device_tab
        self.device_kinds[device_tab] = kind
        title = config["title"]
        insert_index = tab_index if tab_index >= 0 else self.tabs.count()
        self.tabs.insertTab(insert_index, device_tab, f"📍 {port} - {title}")
        self.tabs.setCurrentWidget(device_tab)
        self.log(f"🎉 欢迎进入{title}喷管控制界面", port=port)
        self.statusBar().showMessage(f"{port} 已切换到 {title} 控制界面")
        self._update_context_actions()

        QTimer.singleShot(300, lambda: device_tab.parse_data(first_frame))

    def _on_probe_error(self, port, message):
        self.log(f"❌ 串口识别失败: {message}", level="ERROR", port=port)
        probe = self.probes.pop(port, None)
        if probe:
            index = self.tabs.indexOf(probe)
            probe.stop()
            if index >= 0:
                self.tabs.removeTab(index)
            probe.deleteLater()
        self.auto_added_ports.discard(port)
        QMessageBox.warning(self, "串口识别失败", f"设备 {port} 无法识别或已断开：\n{message}")

    def add_device(self):
        port = self.combo_ports.currentText()
        if not port or port == "无可用串口":
            QMessageBox.warning(self, "提示", "没有可用的串口设备，请检查硬件连接后刷新重试。")
            return
        if port in self.devices or port in self.probes:
            QMessageBox.warning(self, "提示", f"设备 {port} 已经添加")
            return
        self.connect_port(port)

    def add_manual_device(self):
        port = self.manual_port_edit.text().strip()
        if not port:
            QMessageBox.warning(self, "提示", f"请输入串口路径，如 {self.target_port}")
            return
        if port in self.devices or port in self.probes:
            QMessageBox.warning(self, "提示", f"设备 {port} 已经添加")
            return
        if not self.port_exists(port):
            QMessageBox.warning(self, "错误", f"设备 {port} 不存在")
            return
        self.connect_port(port)

    def port_exists(self, port):
        try:
            ser = serial.Serial(port, timeout=0.1)
            ser.close()
            return True
        except (serial.SerialException, FileNotFoundError):
            return False

    def close_device(self, index):
        widget = self.tabs.widget(index)
        port_name = getattr(widget, "port_name", None)
        if hasattr(widget, "stop"):
            widget.stop()
        if hasattr(widget, "worker"):
            widget.worker.stop()
        for timer_name in ("history_timer", "control_timer"):
            timer = getattr(widget, timer_name, None)
            if timer and timer.isActive():
                timer.stop()
        if port_name:
            self.devices.pop(port_name, None)
            self.probes.pop(port_name, None)
            self.auto_added_ports.discard(port_name)
        self.device_kinds.pop(widget, None)
        self.tabs.removeTab(index)
        widget.deleteLater()
        self._update_context_actions()

    def _current_device(self):
        if not hasattr(self, "tabs"):
            return None
        widget = self.tabs.currentWidget()
        if widget in self.device_kinds:
            return widget
        return None

    def _current_kind(self):
        widget = self._current_device()
        if widget:
            return self.device_kinds.get(widget)
        return None

    def _update_context_actions(self):
        if not hasattr(self, "action_motor_graph"):
            return

        kind = self._current_kind()
        has_device = kind is not None
        is_lqts = kind == "lqts"
        is_admin = not self.auth_service or self.auth_service.is_admin()

        self.action_motor_graph.setVisible(is_lqts)
        self.action_sensor_graph.setVisible(is_lqts)
        self.action_bend_graph.setVisible(has_device)
        self.separator_graph.setVisible(is_lqts)
        self.separator_device_tools.setVisible(has_device)
        self.btn_3D.setVisible(is_admin and kind in ("lqts", "lyz"))

        self.action_motor_graph.setEnabled(is_lqts)
        self.action_sensor_graph.setEnabled(is_lqts)
        self.action_bend_graph.setEnabled(has_device)
        self.btn_3D.setEnabled(is_admin and kind in ("lqts", "lyz"))

    def open_graph(self, g_type):
        dev = self._current_device()
        if not dev or self._current_kind() != "lqts":
            QMessageBox.warning(self, "提示", "电机/IMU反馈曲线仅适用于 LQTS 界面。")
            return

        dev.active_type = g_type
        if g_type == "motor":
            title = f"电机反馈数据曲线图 ({dev.port_name})"
            is_motor = True
            num_devices = dev.num_m
        else:
            title = f"IMU反馈数据曲线图 ({dev.port_name})"
            is_motor = False
            num_devices = dev.num_s

        ui = LqtsGraphWindowUI(title, is_motor=is_motor, num_devices=num_devices)
        controller = LqtsGraphController(ui, is_history_mode=False)
        controller.main_window = self
        ui.set_controller(controller)
        dev.active_graph_ui = ui
        dev.active_graph_controller = controller
        ui.show()

    def open_bend_graph(self):
        current_tab = self._current_device()
        if not current_tab:
            QMessageBox.warning(self, "提示", "没有打开任何已识别设备，请先添加串口设备。")
            return
        if hasattr(current_tab, "open_bend_graph"):
            current_tab.open_bend_graph()
        else:
            QMessageBox.warning(self, "提示", "当前设备选项卡不支持喷管历史曲线功能。")

    def open_3d_viewer(self):
        kind = self._current_kind()
        config = DEVICE_CONFIG.get(kind or "")
        model_file = config.get("model_file") if config else None
        if not model_file:
            QMessageBox.warning(self, "提示", "当前界面没有配置 3D 模型文件。")
            return
        file_path = os.path.expanduser(f"~/.lqts/auth_data/{model_file}")
        if not os.path.exists(file_path):
            QMessageBox.warning(self, "错误", f"3D模型文件不存在:\n{file_path}\n请检查文件是否放置正确。")
            return
        self.viewer = Local3DViewer()
        self.viewer.load_file(file_path)
        self.viewer.show()

    def open_log_manager(self):
        log_window = LogManagerWindow(self)
        log_window.exec_()

    def _stop_all_ports(self):
        for widget in list(self.probes.values()) + list(self.devices.values()):
            if hasattr(widget, "stop"):
                widget.stop()
            if hasattr(widget, "worker"):
                widget.worker.stop()
            for timer_name in ("history_timer", "control_timer"):
                timer = getattr(widget, timer_name, None)
                if timer and timer.isActive():
                    timer.stop()
        self.probes.clear()
        self.devices.clear()
        self.device_kinds.clear()
