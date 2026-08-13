# ==========================================
# 5. 设备选项卡 - LYZ
# ==========================================

# Qt类
import struct
import serial
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTabWidget,
                             QFrame, QMessageBox, QGraphicsDropShadowEffect, QSlider)
from PyQt5.QtCore import Qt, QTimer, pyqtSlot

from Core.auth import GlobalHistory
from Core.protocol_lyz import ProtocolParser, DataFilter, FrameAssembler
from Core import kinematics
from UI.nozzle import Nozzle, TouchSplitter
# 自定义类
from .widgets import AnimatedButton
# 工具类
import time


class LyzDeviceTab(Nozzle):
    NOZZLE_NAME = "LYZ"
    ALLOWED_WHEN_STOPPED = {0x00, 0x01, 0x02, 0x04, 0x06, 0xFE}
    SPINBOX_BUTTON_SIZE = 40
    SPINBOX_FONT_SIZE = "12pt"
    SPINBOX_BUTTON_FONT_SIZE = "12pt"
    GROUPBOX_STYLE = (
        "QGroupBox { font-size: 12pt; font-weight: bold; border: 3px solid white; "
        "border-radius: 5px; margin-top: 15px; padding: 5px; }"
    )
    BEND_GRAPH_WINDOW_CLASS = None   # 延迟导入赋值，见模块底部
    BEND_GRAPH_CONTROLLER_CLASS = None

    def __init__(self, port_name, parent_logger, auth_service=None):
        super().__init__(port_name, parent_logger, auth_service)

    def init_nozzle_state(self):
        self.frame_assembler = FrameAssembler()
        self.num_m, self.num_s = 0, 0
        # LYZ 界面只展示喷管运动数据，不创建电机/IMU 卡片。
        self.motor_data, self.sensor_data = [], []
        self.motor_target = []
        self.motor_states = []
        self.scale_data = 100.0
        self.current_bend_angle = 0.0
        self.current_actuator_displacement = 0.0
        self.current_area_change = 100.0
        self.target_bend_angle = 0.0
        self.target_area_change = 100.0

        self.hist_bend_time = []       # 时间列表
        self.hist_bend_target = []     # 目标偏转角度列表
        self.hist_bend_current = []    # 当前偏转角度列表
        self.hist_area_target = []     # 目标截面面积变化列表
        self.hist_area_current = []    # 当前截面面积变化列表
        self.bend_graph_window = None  # 偏转曲线窗口实例
        self.bend_graph_controller = None
        self._last_bend_graph_update = 0.0
        self.bend_graph_update_interval = 0.1  # 曲线窗口刷新间隔，避免 10ms 重绘导致卡顿

        self.m_page, self.s_page = 0, 0
        self.cards_motor, self.cards_sensor = [], []

        self.plot_time = 0
        self.hist_time, self.hist_motors, self.hist_sensors = [], [], []
        self.active_graph = None

        # 创建滤波器
        self.data_filter = DataFilter(window_size=3)
        self.filtered_bend_angle = 0.0
        self.angle_filter_alpha = 0.3   # 滤波系数

    def _set_button_font(self, button, point_size=12):
        font = button.font()
        font.setPointSize(point_size)
        button.setFont(font)

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
        g_power = self.create_group_box("1. 系统操作权限")
        l_power = QHBoxLayout(g_power)


        self.btn_toggle = AnimatedButton("▶ 启动控制系统","#107C10", "#063A06")
        self._set_button_font(self.btn_toggle)
        self.btn_toggle.setCheckable(True) # 设置为可选中状态(开关模式)
        # self.btn_toggle.setFixedSize(300, 100)

        shadow = QGraphicsDropShadowEffect()

        # 连接后状态改变为触发
        self.btn_toggle.toggled.connect(self.sys_toggle)
        self.btn_toggle.setGraphicsEffect(shadow)

        self.btn_stop = AnimatedButton("⏹紧急停止","red", "#A80000")
        self._set_button_font(self.btn_stop)
        shadow = QGraphicsDropShadowEffect()
        # shadow.setBlurRadius(15)      # 阴影模糊半径
        # shadow.setOffset(20, 20)      # 阴影偏移量 (X, Y)
        #shadow.setColor(Qt.black)      # 阴影颜色
        self.btn_stop.setGraphicsEffect(shadow)
        self.btn_stop.setProperty("class", "emergency")     # 使用自定义属性 emergency
        self.btn_stop.clicked.connect(self.sys_stop)

        l_power.addWidget(self.btn_toggle)
        l_power.addWidget(self.btn_stop)
        left_layout.addWidget(g_power)

        g_quick = self.create_group_box("2. 反推控制")
        l_quick = QVBoxLayout(g_quick)
        self.btn_motion_ctrl = AnimatedButton("闭合", "#1E1E1E", "#505050")
        self.btn_motion_ctrl.clicked.connect(self.send_motion_ctrl_command)
        self.btn_home = AnimatedButton("展开", "#1E1E1E", "#505050")
        self.btn_home.clicked.connect(self.send_home_command)
        l_home_row = QHBoxLayout()
        l_home_row.addWidget(self.btn_motion_ctrl)
        l_home_row.addWidget(self.btn_home)
        l_quick.addLayout(l_home_row)
        left_layout.addWidget(g_quick)

        g_deflection = self.create_group_box("3. 偏转控制")
        l_deflection = QVBoxLayout(g_deflection)
        row_deflection = QHBoxLayout()
        self.spin_deflection = self._create_custom_spinbox(-12, 12, 0, prefix="偏转角度: ", suffix="°")
        self.btn_deflection = AnimatedButton("偏转角度", "#00BCD4", "#505050")
        self._set_button_font(self.btn_deflection)
        self.btn_deflection.clicked.connect(lambda: self.send_deflection_command())
        row_deflection.addWidget(self.spin_deflection)
        row_deflection.addWidget(self.btn_deflection)
        l_deflection.addLayout(row_deflection)
        # 滑杆（0.1° 精度，范围 -12° ~ 12°）
        self.slider_deflection = QSlider(Qt.Horizontal)
        self.slider_deflection.setRange(-120, 120)
        self.slider_deflection.setValue(0)
        self.slider_deflection.setTickPosition(QSlider.TicksBelow)
        self.slider_deflection.setTickInterval(100)
        self.slider_deflection.setStyleSheet(self.SLIDER_STYLE)
        l_deflection.addWidget(self.slider_deflection)
        left_layout.addWidget(g_deflection)

        g_section = self.create_group_box("4. 截面控制")
        l_section = QVBoxLayout(g_section)
        row_section = QHBoxLayout()
        self.spin_section = self._create_custom_spinbox(0, 100, 100, prefix="截面面积变化: ", suffix="%")
        self.btn_section = AnimatedButton("截面面积变化", "#00BCD4", "#505050")
        self.btn_section.clicked.connect(self.send_section_command)
        row_section.addWidget(self.spin_section)
        row_section.addWidget(self.btn_section)
        l_section.addLayout(row_section)
        # 滑杆（0.1% 精度，范围 0% ~ 100%）
        self.slider_section = QSlider(Qt.Horizontal)
        self.slider_section.setRange(0, 1000)
        self.slider_section.setValue(1000)
        self.slider_section.setTickPosition(QSlider.TicksBelow)
        self.slider_section.setTickInterval(25)
        self.slider_section.setStyleSheet(self.SLIDER_STYLE)
        l_section.addWidget(self.slider_section)
        left_layout.addWidget(g_section)

        g_total = self.create_group_box("5. 总控")
        l_total = QHBoxLayout(g_total)
        self.btn_initial_state = AnimatedButton("初态复位", "#1E1E1E", "#505050")
        self.btn_initial_state.clicked.connect(self.send_initial_state_command)
        l_total.addWidget(self.btn_initial_state)
        left_layout.addWidget(g_total)
        left_layout.addStretch()


        # 右侧看板
        right_widget = QWidget()
        right_widget.setMinimumWidth(self.RIGHT_MIN_WIDTH)
        self.right_layout = QVBoxLayout(right_widget)
        self.tabs = QTabWidget()

        tab_bend = QWidget()
        v_bend = QVBoxLayout(tab_bend)

        # --- 第一行：目标偏转角度 + 当前偏转角度 ---
        hbox_angles = QHBoxLayout()

        self.target_angle_card, self.target_angle_val = self.create_flat_card(
            "目标偏转角度(deg)", "0.00", "#D13438"
        )
        hbox_angles.addWidget(self.target_angle_card)

        self.current_angle_card, self.current_angle_val = self.create_flat_card(
            "当前偏转角度(deg)", "0.00", "#D13438"
        )
        hbox_angles.addWidget(self.current_angle_card)

        v_bend.addLayout(hbox_angles)

        # --- 第二行：目标截面面积 + 当前截面面积 ---
        hbox_area = QHBoxLayout()

        self.target_area_card, self.target_area_val = self.create_flat_card(
            "目标截面面积变化(%)", "0.00", "#107C10"
        )
        hbox_area.addWidget(self.target_area_card)

        self.current_area_card, self.current_area_val = self.create_flat_card(
            "当前截面面积变化(%)", "0.00", "#107C10"
        )
        hbox_area.addWidget(self.current_area_card)

        v_bend.addLayout(hbox_area)

        self.tabs.addTab(tab_bend, "🔧 LYZ喷管运动数据监控")

        self.right_layout.addWidget(self.tabs)
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, self.LEFT_STRETCH)
        splitter.setStretchFactor(1, self.RIGHT_STRETCH)
        splitter.setStyleSheet(self.SPLITTER_STYLE)

        # 创建滚动区域，将 content_widget 放入其中
        scroll_area = self.create_scroll_area(content_widget)
        self.setLayout(QVBoxLayout())
        self.layout().addWidget(scroll_area)

        self.rebuild_cards()

        # ---------- 滑杆与输入框双向绑定 ----------
        # 滑杆值变化 -> 更新输入框（拖动滑杆时）
        self.slider_deflection.valueChanged.connect(self._on_deflection_slider_changed)
        self.slider_section.valueChanged.connect(self._on_section_slider_changed)
        # 滑杆松手时记录最终指令日志
        self.slider_deflection.sliderReleased.connect(self.send_deflection_command)
        self.slider_section.sliderReleased.connect(self.send_section_command)
        # 输入框值变化 -> 更新滑杆（输入/加减按钮时）
        self.spin_deflection.spin.valueChanged.connect(self._on_deflection_spin_changed)
        self.spin_section.spin.valueChanged.connect(self._on_section_spin_changed)

    def _on_deflection_slider_changed(self, value):
        """滑杆拖动 -> 同步输入框并连续发送指令，拖动中不记录日志"""
        self.spin_deflection.spin.blockSignals(True)
        self.spin_deflection.spin.setValue(value / 10.0)
        self.spin_deflection.spin.blockSignals(False)
        if self.slider_deflection.isSliderDown():
            self.send_deflection_command(log_enabled=False)

    def _on_section_slider_changed(self, value):
        """滑杆拖动 -> 同步输入框并连续发送指令，拖动中不记录日志"""
        self.spin_section.spin.blockSignals(True)
        self.spin_section.spin.setValue(value / 10.0)
        self.spin_section.spin.blockSignals(False)
        if self.slider_section.isSliderDown():
            self.send_section_command(log_enabled=False)

    def _on_deflection_spin_changed(self, value):
        """输入框变化 -> 同步滑杆"""
        self.slider_deflection.blockSignals(True)
        self.slider_deflection.setValue(int(round(value * 10)))
        self.slider_deflection.blockSignals(False)

    def _on_section_spin_changed(self, value):
        """输入框变化 -> 同步滑杆"""
        self.slider_section.blockSignals(True)
        self.slider_section.setValue(int(round(value * 10)))
        self.slider_section.blockSignals(False)

    def expand_device(self, dev_type):
        self.logger(f"ℹ️ LYZ不需要电机/IMU卡片，忽略{dev_type}扩容请求", port=self.port_name)

    def rebuild_cards(self):
        self.num_m, self.num_s = 0, 0
        self.motor_data = []
        self.motor_target = []
        self.motor_states = []
        self.sensor_data = []
        self.cards_motor = []
        self.cards_sensor = []
        self.refresh_pagination()
        self.update_ui()

    def change_page(self, t, delta):
        if t == 'm':
            self.m_page += delta
        else:
            self.s_page += delta
        self.refresh_pagination()

    def refresh_pagination(self):
        self.m_page = max(0, self.m_page)
        self.s_page = max(0, self.s_page)

    # ------------------ 系统控制 ------------------

    def sys_close(self):
        self.is_started = False
        self.send_cmd(0x00, "失能", "关闭LYZ喷管", is_motor=True)

    def sys_start(self):
        if self.is_started:
            return
        self.is_started = True

        self.send_cmd(0x01, "使能", "启动LYZ喷管", is_motor=True)

    def sys_stop(self):
        if self.is_started:
            # 临时阻止信号，避免 setChecked 触发 toggled 导致递归
            self.btn_toggle.blockSignals(True)

            # 保持 checkable=True，只改变 checked 状态
            self.btn_toggle.setChecked(False)   # ✅ 不是 setCheckable(False)
            self.btn_toggle.setText("▶ 启动控制系统")
            self.btn_toggle.set_normal_color("#107C10")
            self.btn_toggle.set_hover_color("#063A06")
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            # 恢复信号（尽快恢复，避免长时间阻塞）
            self.btn_toggle.blockSignals(False)

        self.is_started = False

        # 发送紧急停止命令
        self.send_cmd(0x02, "紧急停止", "LYZ紧急停止按钮", is_motor=True)

    def get_error_disable_buttons(self):
        return [self.btn_stop, self.btn_home, self.btn_motion_ctrl,
                self.btn_deflection, self.btn_section, self.btn_initial_state]

    def send_home_command(self):
        self.send_reverse_thrust_command(opened=False)

    def send_reverse_thrust_command(self, opened):
        if not self.is_started:
            error_msg = "请先点击启动控制系统"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        frame = bytes.fromhex("AA 04 01 00 AF" if opened else "AA 04 01 01 B0")
        action = "闭合" if opened else "展开"
        detail = "反推控制闭合" if opened else "反推控制展开"
        try:
            self.worker.send_data(frame)
            GlobalHistory.add_record(self.port_name, action, detail, frame.hex().upper())
            self.logger(f"📤 {action} -> {detail}", raw_data=frame, port=self.port_name)
        except serial.SerialException as e:
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送{action}命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def _send_home_frame(self, action, detail):
        frame = bytes.fromhex("AA 04 01 01 B0")
        self.worker.send_data(frame)
        GlobalHistory.add_record(self.port_name, action, detail, frame.hex().upper())
        self.logger(f"📤 {action} -> {detail}", raw_data=frame, port=self.port_name)

    def send_initial_state_command(self):
        if not self.is_started:
            error_msg = "请先点击启动控制系统"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        try:
            self.spin_deflection.spin.setValue(0)
            self.spin_section.spin.setValue(100)
            self.target_bend_angle = 0
            self.target_area_change = 100
            frame = bytearray([0xAA, 0x05, 0x00])
            frame.append(sum(frame) & 0xFF)
            frame = bytes(frame)
            self.worker.send_data(frame)
            GlobalHistory.add_record(self.port_name, "初态复位", "偏转角度=0°, 截面面积变化=100%, 执行器位移复位为0", frame.hex().upper())
            self.logger("📤 初态复位 -> AA 05 00 [校验]", raw_data=frame, port=self.port_name)
            self.update_ui()
        except serial.SerialException as e:
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送初态复位命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def send_motion_ctrl_command(self):
        self.send_reverse_thrust_command(opened=True)

    def _build_param_frame(self, direction, special_addr, value):
        frame = bytearray([0xAA, 0x03, 0x04, direction, special_addr])
        frame += struct.pack('>H', value)
        frame.append(sum(frame) & 0xFF)
        return bytes(frame)

    def _send_param_frame(self, action, detail, direction, special_addr, value, log_enabled=True):
        frame = self._build_param_frame(direction, special_addr, value)
        self.worker.send_data(frame)
        if log_enabled:
            GlobalHistory.add_record(self.port_name, action, detail, frame.hex().upper())
            self.logger(f"📤 {action} -> {detail}", raw_data=frame, port=self.port_name)

    def send_section_command(self, log_enabled=True):
        if not self.is_started:
            if log_enabled:
                error_msg = "请先点击启动控制系统"
                QMessageBox.warning(self, "错误", error_msg)
                self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        try:
            self.target_area_change = self.spin_section.spin.value()
            # 面积变化百分比 → 目标出口面积 → 解算 Sc1 → 相对行程 Sc1-130 (mm)
            sc1 = kinematics.percentage_to_sc1(self.target_area_change)
            displacement = sc1 - kinematics.SC1_MIN
            value = int(round(displacement * 100))   # 厘mm，与电机位移指令单位一致
            direction = 0
            # 低于物理下限时执行器饱和在相对位移 70mm，给出提示
            if self.target_area_change < kinematics.MIN_EXIT_AREA / kinematics.MAX_EXIT_AREA * 100:
                self.logger(f"⚠️ 面积变化 {self.target_area_change:.1f}% 低于物理下限 "
                            f"({kinematics.MIN_EXIT_AREA / kinematics.MAX_EXIT_AREA * 100:.2f}%)，"
                            f"执行器饱和在相对位移 70.00mm", level="WARNING", port=self.port_name)
            detail = (f"方向:正, 面积变化={self.target_area_change:.1f}% → "
                      f"Sc1={sc1:.2f}mm → 位移={displacement:.2f}mm")
            self._send_param_frame("截面面积变化", detail, direction, 0xFF, value, log_enabled=log_enabled)
            self.update_ui()
        except serial.SerialException as e:
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送截面面积变化命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def send_scale_command(self):
        self.send_section_command()

    def send_deflection_command(self, angle_deg=None, log_enabled=True):
        """
        发送偏转命令。
        :param angle_deg: 目标角度（度），若为 None 则从 spin_deflection 取值
        :param log_enabled: 是否显示交互提示
        """
        if not self.is_started:
            if log_enabled:
                QMessageBox.warning(self, "错误", "请先点击启动控制系统")
            return

        if angle_deg is None:
            target_angle = self.spin_deflection.spin.value()
        else:
            target_angle = angle_deg

        self.target_bend_angle = target_angle

        direction = 0 if target_angle >= 0 else 1
        angle = abs(int(target_angle * 100))   # 转为整数（0.01度单位）
        action = "喷管偏转"
        direction_text = "正" if direction == 0 else "负"
        detail = f"方向:{direction_text}, 偏转角度:{angle/100}度"

        try:
            self._send_param_frame(action, detail, direction, 0xFE, angle, log_enabled=log_enabled)
            self.update_ui()
        except serial.SerialException as e:
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送偏转角度命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def send_bend_command(self, angle_deg=None, log_enabled=True):
        self.send_deflection_command(angle_deg, log_enabled)

    # ------------------ 核心：数据解析（调用后端）------------------
    @pyqtSlot(bytes)
    def parse_data(self, data):
        """接收串口原始数据，通过 FrameAssembler 组帧并调用 ProtocolParser 解析"""
        # 喂入帧组装器（内部完成缓冲管理、帧头搜索、校验和验证）
        self.frame_assembler.feed(data)

        # 提取所有完整的、校验通过的帧
        for frame in self.frame_assembler.get_frames():
            # 调用后端解析器（启用滤波）
            status = ProtocolParser.parse_frame(
                frame,
                apply_filter=True,
                filter_obj=self.data_filter
            )
            if status is None:
                continue   # 解析失败（非 0x02 帧或数据不足）

            # 1. LYZ 不展示电机/IMU卡片，忽略协议中的电机数量
            self.num_m, self.num_s = 0, 0
            self.motor_data = []
            self.motor_states = []
            self.sensor_data = []

            # 2. 更新喷管参数
            # 状态反馈帧末尾两个系统值分别为当前偏转角度、当前电推杆位移量
            self.current_bend_angle = status.bend_angle
            self.current_actuator_displacement = status.actuator_displacement
            # 一阶低通滤波
            self.filtered_bend_angle = (
                self.angle_filter_alpha * self.current_bend_angle
                + (1 - self.angle_filter_alpha) * self.filtered_bend_angle
            )
            self.current_bend_angle = self.filtered_bend_angle
            # 当前电推杆位移量 -> 运动学正解出口面积 -> 当前截面面积变化百分比
            self.current_area_change = kinematics.displacement_to_percentage(
                self.current_actuator_displacement
            )

            # 4. 刷新界面
            self.update_ui()

    def update_ui(self):
        if hasattr(self, 'target_angle_val'):
            self.target_angle_val.setText(f"{self.target_bend_angle:.2f}")
        if hasattr(self, 'current_angle_val'):
            self.current_angle_val.setText(f"{self.current_bend_angle:.2f}")
        if hasattr(self, 'target_area_val'):
            self.target_area_val.setText(f"{self.target_area_change:.2f}")
        if hasattr(self, 'current_area_val'):
            self.current_area_val.setText(f"{self.current_area_change:.2f}")

    def update_motor_status_ball(self, idx=None):
        pass

    def update_sensor_monitor(self, idx=None):
        pass

    def record_history(self):
        if self.serial_error:
            return
        # 初始化起始时间（第一次调用时）
        if self.start_time is None:
            self.start_time = time.time()

        # 计算相对时间（秒，从 0 开始）
        current_time_sec = time.time() - self.start_time

        # 偏转角度
        self.hist_bend_time.append(current_time_sec)
        self.hist_bend_target.append(self.target_bend_angle)
        self.hist_bend_current.append(self.current_bend_angle)
        self.hist_area_target.append(self.target_area_change)
        self.hist_area_current.append(self.current_area_change)

        # 限制长度（保留最近60秒）
        while len(self.hist_bend_time) > 0 and self.hist_bend_time[0] < current_time_sec - 60:
            self.hist_bend_time.pop(0)
            self.hist_bend_target.pop(0)
            self.hist_bend_current.pop(0)
            self.hist_area_target.pop(0)
            self.hist_area_current.pop(0)

        # 更新曲线窗口（如果已打开）：降频刷新 + 只绘制最近 20 秒数据，
        # 避免 10ms 一次全量重绘（60s*100Hz≈6000 点 * 4 条曲线）导致主线程卡死
        if self.bend_graph_window and self.bend_graph_window.isVisible():
            if current_time_sec - self._last_bend_graph_update >= self.bend_graph_update_interval:
                self._last_bend_graph_update = current_time_sec
                window_start = current_time_sec - 20
                start_idx = 0
                while start_idx < len(self.hist_bend_time) and self.hist_bend_time[start_idx] < window_start:
                    start_idx += 1
                self.bend_graph_controller.window.update_data(
                    self.hist_bend_time[start_idx:],
                    self.hist_bend_target[start_idx:],
                    self.hist_bend_current[start_idx:],
                    self.hist_area_target[start_idx:],
                    self.hist_area_current[start_idx:]
                )

        # LYZ 不记录电机/IMU历史数据，电机/IMU曲线仅 LQTS 使用。

    #----------辅助函数----------------#
    def refresh_bend_graph(self):
        """用最近 20 秒数据刷新 LYZ 偏转/面积曲线窗口，避免一次性加载过多点导致卡顿"""
        if not (self.bend_graph_window and self.bend_graph_window.isVisible() and self.hist_bend_time):
            return
        last_t = self.hist_bend_time[-1]
        window_start = last_t - 20
        start_idx = 0
        while start_idx < len(self.hist_bend_time) and self.hist_bend_time[start_idx] < window_start:
            start_idx += 1
        self.bend_graph_controller.window.update_data(
            self.hist_bend_time[start_idx:],
            self.hist_bend_target[start_idx:],
            self.hist_bend_current[start_idx:],
            self.hist_area_target[start_idx:],
            self.hist_area_current[start_idx:]
        )


# 延迟导入曲线窗口/控制器类，避免循环导入
from UI.graph_window_lyz import BendGraphWindow as _LyzBendGraphWindow
from Core.GraphController_lyz import BendGraphController as _LyzBendGraphController
LyzDeviceTab.BEND_GRAPH_WINDOW_CLASS = _LyzBendGraphWindow
LyzDeviceTab.BEND_GRAPH_CONTROLLER_CLASS = _LyzBendGraphController
