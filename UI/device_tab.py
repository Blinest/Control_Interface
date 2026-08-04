# ==========================================
# 5. 设备选项卡
# ==========================================

# Qt类
import struct
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QGroupBox,
                             QLabel, QDoubleSpinBox, QPushButton, QTabWidget,
                             QFrame, QSplitter, QSplitterHandle, QMessageBox,
                             QGraphicsDropShadowEffect, QAbstractSpinBox, QScrollArea)
from PyQt5.QtCore import Qt, QTimer, pyqtSlot
from PyQt5.QtGui import QPainter, QColor


from Core.serial_worker import SerialWorker
from Core.auth import GlobalHistory
from Core.protocol import ProtocolParser, DataFilter
# 自定义类
from .widgets import AnimatedButton
# 工具类
import time


class TouchSplitterHandle(QSplitterHandle):
    """可触摸的分割条手柄，中间带抓握纹理"""
    def __init__(self, orientation, parent=None):
        super().__init__(orientation, parent)
        self._hovered = False
        self.setMouseTracking(True)
        self.setCursor(Qt.SplitHCursor)

    def enterEvent(self, event):
        self._hovered = True
        self.update()

    def leaveEvent(self, event):
        self._hovered = False
        self.update()

    def paintEvent(self, event):
        super().paintEvent(event)
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        color = QColor("#42a5f5") if self._hovered else QColor("#9e9e9e")
        p.setBrush(color)
        p.setPen(Qt.NoPen)
        cx = self.width() // 2
        cy = self.height() // 2
        dot_r = 2
        gap = 10
        for i in range(-1, 2):
            p.drawEllipse(cx - dot_r, cy + i * gap - dot_r, dot_r * 2, dot_r * 2)
        p.end()


class TouchSplitter(QSplitter):
    """触摸友好的 QSplitter，手柄更宽且带纹理"""
    def __init__(self, orientation, parent=None):
        super().__init__(orientation, parent)
        self.setHandleWidth(20)

    def createHandle(self):
        return TouchSplitterHandle(self.orientation(), self)


class DeviceTab(QWidget):
    def __init__(self, port_name, parent_logger, auth_service=None):
        super().__init__()
        self.auth_service = auth_service
        if self.auth_service and not self.auth_service.is_admin():
            pass

        self.start_time = None
        self.port_name, self.logger = port_name, parent_logger
        self.worker = SerialWorker(port_name)
        self.worker.signal_data.connect(self.parse_data)
        self.worker.signal_error.connect(self.handle_serial_error)
        self.serial_error = False

        self.recv_buffer = bytearray()
        self.is_started = False
        self.current_bend_angle1 = 0.0   # 向下当前偏转角（实时反馈）
        self.current_bend_angle2 = 0.0   # 向上当前偏转角（实时反馈）
        self.target_bend_angle1 = 0.0    # 向下目标偏转角（控制设定）
        self.target_bend_angle2 = 0.0    # 向上目标偏转角（控制设定）

        self.hist_bend_time = []                  # 时间列表
        self.hist_bend_up_current = []            # 向上当前偏转角列表
        self.hist_bend_down_current = []          # 向下当前偏转角列表
        self.hist_bend_up_target = []             # 向上目标偏转角列表
        self.hist_bend_down_target = []           # 向下目标偏转角列表
        self.bend_graph_window = None  # 弯曲曲线窗口实例
        self.bend_graph_controller = None

        # 创建滤波器
        self.data_filter = DataFilter(window_size=3)
        self.filtered_bend_angle1 = 0.0
        self.filtered_bend_angle2 = 0.0
        self.angle_filter_alpha = 0.3

        # 数据记录定时器
        self.history_timer = QTimer()
        self.history_timer.timeout.connect(self.record_history)
        self.history_timer.start(10)

        self.init_ui()
        self.worker.start()

    def init_ui(self):
        main_layout = QHBoxLayout(self)
        splitter = TouchSplitter(Qt.Horizontal)

        # 创建内容容器
        content_widget = QWidget()
        main_layout = QHBoxLayout(content_widget)
        splitter = TouchSplitter(Qt.Horizontal)

        # 左侧面板
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_widget.setMinimumWidth(300)

        # ---------- GroupBox 1: 系统操作权限 ----------
        g_power = QGroupBox("1. 系统操作权限")
        g_power.setStyleSheet("QGroupBox { font-size: 14pt; font-weight: bold; border: 3px solid white; border-radius: 5px; margin-top: 15px; padding: 10px; }")
        l_power = QHBoxLayout(g_power)

        self.btn_toggle = AnimatedButton("▶ 启动控制系统", "#107C10", "#063A06")
        self.btn_toggle.setCheckable(True)
        shadow = QGraphicsDropShadowEffect()
        self.btn_toggle.toggled.connect(self.sys_toggle)
        self.btn_toggle.setGraphicsEffect(shadow)

        self.btn_stop = AnimatedButton("⏹紧急停止", "red", "#A80000")
        shadow = QGraphicsDropShadowEffect()
        self.btn_stop.setGraphicsEffect(shadow)
        self.btn_stop.setProperty("class", "emergency")
        self.btn_stop.clicked.connect(self.sys_stop)

        l_power.addWidget(self.btn_toggle)
        l_power.addWidget(self.btn_stop)
        left_layout.addWidget(g_power)

        # ---------- GroupBox 2: 弯曲控制 ----------
        g_quick = QGroupBox("2. 弯曲控制")
        g_quick.setStyleSheet("QGroupBox { font-size: 14pt; font-weight: bold; border: 3px solid white; border-radius: 5px; margin-top: 15px; padding: 10px; }")
        l_quick = QVBoxLayout(g_quick)

        # 向下偏转
        l_bend1 = QHBoxLayout()
        lbl_seg1 = QLabel("向下偏转:")
        lbl_seg1.setStyleSheet("font-size: 12pt; font-weight: bold;")
        l_bend1.addWidget(lbl_seg1)
        self.spin_bend1 = self._create_custom_spinbox(0, 30, 0, "Angle1: ", "°")
        self.btn_bend1 = AnimatedButton("向下偏转控制", "#00BCD4", "#505050")
        self.btn_bend1.clicked.connect(lambda: self.send_bend_command(1))
        l_bend1.addWidget(self.spin_bend1)
        l_bend1.addWidget(self.btn_bend1)
        l_quick.addLayout(l_bend1)

        #
        l_bend2 = QHBoxLayout()
        lbl_seg2 = QLabel("向上偏转:")
        lbl_seg2.setStyleSheet("font-size: 12pt; font-weight: bold;")
        l_bend2.addWidget(lbl_seg2)
        self.spin_bend2 = self._create_custom_spinbox(0, 30, 0, "Angle2: ", "°")
        self.btn_bend2 = AnimatedButton("向上偏转控制", "#00BCD4", "#505050")
        self.btn_bend2.clicked.connect(lambda: self.send_bend_command(2))
        l_bend2.addWidget(self.spin_bend2)
        l_bend2.addWidget(self.btn_bend2)
        l_quick.addLayout(l_bend2)

        # 偏转复位
        self.btn_home = AnimatedButton("⌂ 偏转复位", "#1E1E1E", "#505050")
        self.btn_home.clicked.connect(self.send_home_command)
        l_quick.addWidget(self.btn_home)

        left_layout.addWidget(g_quick)
        left_layout.addStretch()

        # ---------- 右侧看板：弯曲数据监控 ----------
        right_widget = QWidget()
        right_widget.setMinimumWidth(300)
        self.right_layout = QVBoxLayout(right_widget)
        self.tabs = QTabWidget()

        tab_bend = QWidget()
        v_bend = QVBoxLayout(tab_bend)

        # 第一行：向下偏转（当前 + 目标）
        hbox_seg1 = QHBoxLayout()
        self.angle1_cur_card, self.angle1_cur_val = self.create_flat_card(
            "向下当前偏转角(deg)", "0.00", "#D13438"
        )
        hbox_seg1.addWidget(self.angle1_cur_card)
        self.angle1_tar_card, self.angle1_tar_val = self.create_flat_card(
            "向下目标偏转角(deg)", "0.00", "#0078D7"
        )
        hbox_seg1.addWidget(self.angle1_tar_card)
        v_bend.addLayout(hbox_seg1)

        # 第二行：向上偏转（当前 + 目标）
        hbox_seg2 = QHBoxLayout()
        self.angle2_cur_card, self.angle2_cur_val = self.create_flat_card(
            "向上当前偏转角(deg)", "0.00", "#D13438"
        )
        hbox_seg2.addWidget(self.angle2_cur_card)
        self.angle2_tar_card, self.angle2_tar_val = self.create_flat_card(
            "向上目标偏转角(deg)", "0.00", "#0078D7"
        )
        hbox_seg2.addWidget(self.angle2_tar_card)
        v_bend.addLayout(hbox_seg2)

        self.tabs.addTab(tab_bend, "🔧 偏转数据监控")

        self.right_layout.addWidget(self.tabs)
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 3)
        splitter.setStyleSheet("""
            QSplitter::handle {
                background: #e0e0e0;
                border-left: 1px solid #bdbdbd;
                border-right: 1px solid #bdbdbd;
            }
            QSplitter::handle:hover {
                background: #bbdefb;
            }
            QSplitter::handle:pressed {
                background: #90caf9;
            }
        """)
        main_layout.addWidget(splitter)

        # 滚动区域
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setWidget(content_widget)
        scroll_area.setMaximumHeight(750)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll_area.setStyleSheet("""
            QScrollBar:vertical {
                background: #e0e0e0;
                width: 30px;
                border-radius: 15px;
            }
            QScrollBar::handle:vertical {
                background: #aaa;
                min-height: 60px;
                border-radius: 15px;
            }
            QScrollBar::handle:vertical:hover {
                background: #666;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QScrollBar:horizontal {
                background: #e0e0e0;
                height: 30px;
                border-radius: 15px;
            }
            QScrollBar::handle:horizontal {
                background: #aaa;
                min-width: 60px;
                border-radius: 15px;
            }
            QScrollBar::handle:horizontal:hover {
                background: #666;
            }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
                width: 0px;
            }
        """)
        self.setLayout(QVBoxLayout())
        self.layout().addWidget(scroll_area)

    # ------------------ 弯曲命令 ------------------

    def send_bend_command(self, segment=1):
        """发送偏转控制命令（两段偏转共用，功能码0x03）"""
        if not self.is_started:
            QMessageBox.warning(self, "错误", "请先点击启动控制系统")
            return

        if segment == 1:
            # 向下偏转
            target_angle = abs(self.spin_bend1.spin.value()) * -1
            special_addr = 0xFE
            self.target_bend_angle1 = target_angle
        else:
            # 向上偏转
            target_angle = abs(self.spin_bend2.spin.value())
            special_addr = 0xFD
            self.target_bend_angle2 = target_angle

        direction = 0 if target_angle >= 0 else 1
        angle = abs(int(target_angle * 100))

        # 数据包：special_addr + direction + angle（无count）
        data = struct.pack('>BBH', special_addr, direction, angle)

        action = f"喷管偏转(第{segment}段)"
        detail = f"方向:{'正' if direction == 0 else '负'}, 角度:{angle/100}度"
        self.send_cmd(0x03, action, detail, data, is_motor=True)
        self.update_ui()

    def send_home_command(self):
        if not self.is_started:
            QMessageBox.warning(self, "错误", "请先点击启动控制系统")
            return

        try:
            # 偏转复位：特殊地址0xFC，角度0
            data = struct.pack('>BBH', 0xFC, 0, 0)
            self.send_cmd(0x03, "偏转复位", "所有角度复位为0", data, is_motor=True)
            self.target_bend_angle1 = 0
            self.target_bend_angle2 = 0
            self.update_ui()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"发送偏转复位命令失败: {str(e)}")
            self.logger(f"❌ 发送偏转复位命令失败: {str(e)}", level="ERROR", port=self.port_name)

    # ------------------ 系统控制 ------------------

    def sys_toggle(self, checked):
        if checked:
            self.btn_toggle.setText("⏹ 关闭控制系统")
            self.btn_toggle.set_normal_color("#D13438")
            self.btn_toggle.set_hover_color("#6B1418")
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            self.sys_start()
        else:
            self.btn_toggle.setText("▶ 启动控制系统")
            self.btn_toggle.set_normal_color("#107C10")
            self.btn_toggle.set_hover_color("#063A06")
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            self.sys_close()

    def sys_close(self):
        self.is_started = False
        self.send_cmd(0x00, "失能", "关闭S弯喷管", is_motor=True)

    def sys_start(self):
        if self.is_started:
            return
        self.is_started = True
        self.send_cmd(0x01, "使能", "启动S弯喷管", is_motor=True)

    def sys_stop(self):
        if self.is_started:
            self.btn_toggle.blockSignals(True)
            self.btn_toggle.setChecked(False)
            self.btn_toggle.setText("▶ 启动控制系统")
            self.btn_toggle.set_normal_color("#107C10")
            self.btn_toggle.set_hover_color("#063A06")
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            self.btn_toggle.blockSignals(False)
        self.is_started = False
        self.send_cmd(0x02, "紧急停止", "LQTS紧急停止按钮", is_motor=True)

    def handle_serial_error(self, error_msg):
        self.serial_error = True
        if self.history_timer.isActive():
            self.history_timer.stop()
        self.logger(f"❌ 串口异常: {error_msg}", port=self.port_name)
        msg_box = QMessageBox(self)
        msg_box.setIcon(QMessageBox.Critical)
        msg_box.setWindowTitle("串口断连")
        msg_box.setText(f"当前串口设备 {self.port_name} 已断开连接！")
        msg_box.setInformativeText("请关闭当前数据页面，重新连接串口设备。")
        msg_box.setStandardButtons(QMessageBox.Ok)
        msg_box.exec_()
        for btn in [self.btn_stop, self.btn_home, self.btn_bend1, self.btn_bend2]:
            btn.setEnabled(False)

    def send_cmd(self, func_code, action, detail, data=b'', is_motor=True):
        try:
            if func_code not in [0x00, 0x01, 0x02, 0x03, 0xFE] and not self.is_started:
                QMessageBox.warning(self, "拒绝", "请先点击启动控制系统")
                return

            frame_head = 0xAA if is_motor else 0xBB
            frame = struct.pack('>BBB', frame_head, func_code, len(data)) + data
            frame += bytes([sum(frame) & 0xFF])
            self.worker.send_data(frame)
            GlobalHistory.add_record(self.port_name, action, detail, frame.hex().upper())

            if func_code == 0x02:
                self.logger(f"📤 {action} -> {detail}", raw_data=frame, level="WARNING", port=self.port_name)
            else:
                self.logger(f"📤 {action} -> {detail}", raw_data=frame, port=self.port_name)

        except serial.SerialException as e:
            QMessageBox.critical(self, "串口错误", f"串口通信失败: {str(e)}")
            self.logger(f"❌ 串口通信失败: {str(e)}", level="ERROR", port=self.port_name)
        except Exception as e:
            QMessageBox.critical(self, "错误", f"发送命令失败: {str(e)}")
            self.logger(f"❌ 发送命令失败: {str(e)}", level="ERROR", port=self.port_name)

    # ------------------ 数据解析 ------------------

    @pyqtSlot(bytes)
    def parse_data(self, data):
        """接收串口原始数据，组帧并调用后端解析器"""
        self.recv_buffer.extend(data)
        if len(self.recv_buffer) > 1024:
            self.recv_buffer.clear()
            return

        while len(self.recv_buffer) >= 5:
            if self.recv_buffer[0] != 0xBB:
                self.recv_buffer.pop(0)
                continue

            d_len = self.recv_buffer[2]
            if d_len > 255:
                self.recv_buffer.pop(0)
                continue

            frame_len = 3 + d_len + 1
            if len(self.recv_buffer) < frame_len:
                break

            frame = bytes(self.recv_buffer[:frame_len])
            self.recv_buffer = self.recv_buffer[frame_len:]

            if (sum(frame[:-1]) & 0xFF) != frame[-1]:
                continue

            status = ProtocolParser.parse_frame(
                frame,
                apply_filter=True,
                filter_obj=self.data_filter
            )

            if status is None:
                continue

            # 更新两段偏转角度（直读 theta1 / theta2）
            raw1 = status.theta1
            raw2 = status.theta2

            self.filtered_bend_angle1 = self.angle_filter_alpha * raw1 + \
                (1 - self.angle_filter_alpha) * self.filtered_bend_angle1
            self.current_bend_angle1 = self.filtered_bend_angle1

            self.filtered_bend_angle2 = self.angle_filter_alpha * raw2 + \
                (1 - self.angle_filter_alpha) * self.filtered_bend_angle2
            self.current_bend_angle2 = self.filtered_bend_angle2

            self.update_ui()

    def update_ui(self):
        if hasattr(self, 'angle1_cur_val'):
            self.angle1_cur_val.setText(f"{abs(self.current_bend_angle1):.2f}")
        if hasattr(self, 'angle1_tar_val'):
            self.angle1_tar_val.setText(f"{abs(self.spin_bend1.spin.value()):.2f}")
        if hasattr(self, 'angle2_cur_val'):
            self.angle2_cur_val.setText(f"{abs(self.current_bend_angle2):.2f}")
        if hasattr(self, 'angle2_tar_val'):
            self.angle2_tar_val.setText(f"{abs(self.spin_bend2.spin.value()):.2f}")

    def create_flat_card(self, title, val, color):
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #d9d9d6; border: 3px solid white; border-radius: 6px; }")
        layout = QHBoxLayout(frame)
        lbl_val = QLabel(val)
        lbl_val.setStyleSheet(f"color: {color}; font-size: 16pt; font-weight: bold; border: none;")
        layout.addWidget(QLabel(title, styleSheet="color: black; font-weight:bold; border:none; font-size:14pt;"))
        layout.addStretch()
        layout.addWidget(lbl_val)
        return frame, lbl_val

    # ------------------ 数据记录 ------------------

    def record_history(self):
        if self.serial_error:
            return
        if self.start_time is None:
            self.start_time = time.time()

        current_time_sec = time.time() - self.start_time

        self.hist_bend_time.append(current_time_sec)
        self.hist_bend_up_current.append(abs(self.current_bend_angle2))
        self.hist_bend_down_current.append(abs(self.current_bend_angle1))
        self.hist_bend_up_target.append(abs(self.target_bend_angle2))
        self.hist_bend_down_target.append(abs(self.target_bend_angle1))

        while len(self.hist_bend_time) > 0 and self.hist_bend_time[0] < current_time_sec - 60:
            self.hist_bend_time.pop(0)
            self.hist_bend_up_current.pop(0)
            self.hist_bend_down_current.pop(0)
            self.hist_bend_up_target.pop(0)
            self.hist_bend_down_target.pop(0)

        if self.bend_graph_window and self.bend_graph_window.isVisible():
            self.bend_graph_controller.window.update_data(
                self.hist_bend_time,
                self.hist_bend_up_current,
                self.hist_bend_down_current,
                self.hist_bend_up_target,
                self.hist_bend_down_target
            )

    def open_bend_graph(self):
        """打开弯曲角度历史曲线窗口"""
        if self.bend_graph_window is None:
            from UI.graph_window import BendGraphWindow
            from Core.GraphController import BendGraphController
            self.bend_graph_window = BendGraphWindow(self)
            self.bend_graph_controller = BendGraphController(self.bend_graph_window, self)
        self.bend_graph_window.show()
        self.bend_graph_window.raise_()
        if self.hist_bend_time:
            self.bend_graph_controller.window.update_data(
                self.hist_bend_time,
                self.hist_bend_up_current,
                self.hist_bend_down_current,
                self.hist_bend_up_target,
                self.hist_bend_down_target
            )

    # ---------- 辅助函数 ----------

    def _create_custom_spinbox(self, min_val, max_val, default, prefix='', suffix='', step=1.0):
        """创建带自定义 +/- 按钮的 SpinBox 组合控件"""
        container = QWidget()
        layout = QHBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(2)

        spin = QDoubleSpinBox()
        spin.setRange(min_val, max_val)
        spin.setValue(default)
        if prefix:
            spin.setPrefix(prefix)
        if suffix:
            spin.setSuffix(suffix)
        spin.setSingleStep(step)

        spin.setButtonSymbols(QAbstractSpinBox.NoButtons)
        spin.setStyleSheet("""
            QDoubleSpinBox {
                min-height: 44px;
                font-size: 12pt;
                font-weight: bold;
                border: 2px solid #b0b0b0;
                border-radius: 10px;
                background: white;
                padding-right: 8px;
            }
            QDoubleSpinBox:focus {
                border-color: #0078D7;
            }
        """)

        btn_plus = QPushButton("+")
        btn_plus.setFixedSize(44, 44)
        btn_plus.setCursor(Qt.PointingHandCursor)
        btn_plus.setStyleSheet("""
            QPushButton {
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 8px;
                font-size: 14pt;
                font-weight: bold;
                color: #333;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #c0c0c0;
            }
        """)
        btn_plus.clicked.connect(lambda: spin.stepUp())

        btn_minus = QPushButton("−")
        btn_minus.setFixedSize(44, 44)
        btn_minus.setCursor(Qt.PointingHandCursor)
        btn_minus.setStyleSheet("""
            QPushButton {
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 8px;
                font-size: 14pt;
                font-weight: bold;
                color: #333;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #c0c0c0;
            }
        """)
        btn_minus.clicked.connect(lambda: spin.stepDown())

        layout.addWidget(spin)
        layout.addWidget(btn_plus)
        layout.addWidget(btn_minus)

        container.spin = spin
        return container
