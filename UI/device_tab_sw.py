# ==========================================
# 5. 设备选项卡 - SW
# ==========================================

# Qt类
import struct
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTabWidget,
                             QMessageBox, QGraphicsDropShadowEffect)
from PyQt5.QtCore import Qt, QTimer, pyqtSlot

from Core.auth import GlobalHistory
from Core.protocol_sw import ProtocolParser, DataFilter
from UI.nozzle import Nozzle, TouchSplitter
# 自定义类
from .widgets import AnimatedButton
# 工具类
import time


class SwDeviceTab(Nozzle):
    NOZZLE_NAME = "SW"
    ALLOWED_WHEN_STOPPED = {0x00, 0x01, 0x02, 0x03, 0xFE}
    SPINBOX_BUTTON_SIZE = 44
    SPINBOX_FONT_SIZE = "14pt"
    SPINBOX_BUTTON_FONT_SIZE = "16pt"
    CARD_VALUE_FONT_SIZE = "18pt"
    CARD_TITLE_FONT_SIZE = "16pt"
    BEND_GRAPH_WINDOW_CLASS = None   # 延迟导入赋值，见模块底部
    BEND_GRAPH_CONTROLLER_CLASS = None

    def __init__(self, port_name, parent_logger, auth_service=None):
        super().__init__(port_name, parent_logger, auth_service)

    def init_nozzle_state(self):
        self.current_bend_angle1 = 0.0   # 向下当前偏转角（实时反馈）
        self.current_bend_angle2 = 0.0   # 向上当前偏转角（实时反馈）
        self.target_bend_angle1 = 0.0    # 向下目标偏转角（控制设定）
        self.target_bend_angle2 = 0.0    # 向上目标偏转角（控制设定）

        self.hist_bend_time = []                  # 时间列表
        self.hist_bend_up_current = []            # 向上当前偏转角列表
        self.hist_bend_down_current = []          # 向下当前偏转角列表
        self.hist_bend_up_target = []             # 向上目标偏转角列表
        self.hist_bend_down_target = []           # 向下目标偏转角列表

        # 创建滤波器
        self.data_filter = DataFilter(window_size=3)
        self.filtered_bend_angle1 = 0.0
        self.filtered_bend_angle2 = 0.0
        self.angle_filter_alpha = 0.3

    def init_ui(self):
        # 创建内容容器
        content_widget = QWidget()
        content_layout = QHBoxLayout(content_widget)
        splitter = TouchSplitter(Qt.Horizontal)
        content_layout.addWidget(splitter)

        # 左侧面板
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_widget.setMinimumWidth(self.LEFT_MIN_WIDTH)

        # ---------- GroupBox 1: 系统操作权限 ----------
        g_power = self.create_group_box("1. 系统操作权限")
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

        # ---------- GroupBox 2: 偏转控制 ----------
        g_quick = self.create_group_box("2. 偏转控制")
        l_quick = QVBoxLayout(g_quick)

        # 向下偏转
        l_bend1 = QHBoxLayout()
        lbl_seg1 = self.create_section_label("向下偏转:")
        l_bend1.addWidget(lbl_seg1)
        self.spin_bend1 = self._create_custom_spinbox(0, 30, 0, "Angle1: ", "°")
        self.btn_bend1 = AnimatedButton("向下偏转控制", "#00BCD4", "#505050")
        self.btn_bend1.clicked.connect(lambda: self.send_bend_command(1))
        l_bend1.addWidget(self.spin_bend1)
        l_bend1.addWidget(self.btn_bend1)
        l_quick.addLayout(l_bend1)

        #
        l_bend2 = QHBoxLayout()
        lbl_seg2 = self.create_section_label("向上偏转:")
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

        # ---------- 右侧看板：偏转数据监控 ----------
        right_widget = QWidget()
        right_widget.setMinimumWidth(self.RIGHT_MIN_WIDTH)
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
        splitter.setStretchFactor(0, self.LEFT_STRETCH)
        splitter.setStretchFactor(1, self.RIGHT_STRETCH)
        splitter.setStyleSheet(self.SPLITTER_STYLE)

        # 滚动区域
        scroll_area = self.create_scroll_area(content_widget)
        self.setLayout(QVBoxLayout())
        self.layout().addWidget(scroll_area)

    # ------------------ 偏转命令 ------------------

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

    def sys_close(self):
        self.is_started = False
        self.send_cmd(0x00, "失能", "关闭SW喷管", is_motor=True)

    def sys_start(self):
        if self.is_started:
            return
        self.is_started = True
        self.send_cmd(0x01, "使能", "启动SW喷管", is_motor=True)

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
        self.send_cmd(0x02, "紧急停止", "SW紧急停止按钮", is_motor=True)

    def get_error_disable_buttons(self):
        return [self.btn_stop, self.btn_home, self.btn_bend1, self.btn_bend2]

    # ------------------ 数据解析 ------------------

    @pyqtSlot(bytes)
    def parse_data(self, data):
        """接收串口原始数据，组帧并调用后端解析器"""
        self.recv_buffer.extend(data)
        if len(self.recv_buffer) > 1024:
            self.recv_buffer.clear()
            return

        while len(self.recv_buffer) >= 5:
            if self.recv_buffer[0] != 0xCC:
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

    # ---------- 辅助函数 ----------
    def refresh_bend_graph(self):
        """用最新历史数据刷新 SW 偏转曲线窗口"""
        if (self.bend_graph_window and self.bend_graph_window.isVisible()
                and self.bend_graph_controller and self.hist_bend_time):
            self.bend_graph_controller.window.update_data(
                self.hist_bend_time,
                self.hist_bend_up_current,
                self.hist_bend_down_current,
                self.hist_bend_up_target,
                self.hist_bend_down_target
            )


# 延迟导入曲线窗口/控制器类，避免循环导入
from UI.graph_window_sw import BendGraphWindow as _SwBendGraphWindow
from Core.GraphController_sw import BendGraphController as _SwBendGraphController
SwDeviceTab.BEND_GRAPH_WINDOW_CLASS = _SwBendGraphWindow
SwDeviceTab.BEND_GRAPH_CONTROLLER_CLASS = _SwBendGraphController

