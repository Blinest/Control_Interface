# ==========================================
# 5. 设备选项卡
# ==========================================

# Qt类
import struct
import serial
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QGroupBox, QGridLayout,
                             QLabel, QComboBox, QDoubleSpinBox, QPushButton, QTabWidget,
                             QFrame, QSplitter, QSplitterHandle, QMessageBox, QGraphicsDropShadowEffect, QAbstractSpinBox, QScrollArea,
                             QSlider)
from PyQt5.QtCore import Qt, QTimer, pyqtSlot
from PyQt5.QtGui import QPainter, QColor


from Core.serial_worker import SerialWorker
from Core.auth import GlobalHistory
from Core.protocol import ProtocolParser, DataFilter, FrameAssembler
from Core import kinematics
# 自定义类
from .widgets import AnimatedButton
# 工具类
import time

# 滑杆统一样式（深色轨道 + 蓝色滑块，适合工业控制面板）
_SLIDER_STYLE = """
QSlider::groove:horizontal {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
}
QSlider::sub-page:horizontal {
    background: #00BCD4;
    border-radius: 3px;
}
QSlider::handle:horizontal {
    background: #0078D7;
    width: 18px;
    height: 18px;
    margin: -6px 0;
    border-radius: 9px;
}
QSlider::handle:horizontal:hover {
    background: #005A9E;
}
"""


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
        self.auth_service = auth_service #添加权限控制
        if self.auth_service and not self.auth_service.is_admin():
            # 普通用户可能没有某些高级操作权限
            pass

        self.start_time = None   # 起始时间戳（None) 表示未初始化
        self.port_name, self.logger = port_name, parent_logger
        self.worker = SerialWorker(port_name)
        self.worker.signal_data.connect(self.parse_data)
        self.worker.signal_error.connect(self.handle_serial_error)
        self.serial_error = False

        self.recv_buffer = bytearray()
        self.frame_assembler = FrameAssembler()
        self.is_started = False
        self.num_m, self.num_s = 0, 0
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

        # 数据记录定时器
        self.history_timer = QTimer()
        self.history_timer.timeout.connect(self.record_history)
        self.history_timer.start(10) # 刷新率定义

        self.init_ui()
        self.worker.start()

    def init_ui(self):
        main_layout = QHBoxLayout(self)
        splitter = TouchSplitter(Qt.Horizontal)

        # 创建内容容器
        content_widget = QWidget()
        main_layout = QHBoxLayout(content_widget)   # 将原有布局应用到 content_widget
        splitter = TouchSplitter(Qt.Horizontal)

        # 左侧面板
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_widget.setMinimumWidth(300)
        g_power = QGroupBox("1. 系统操作权限")
        l_power = QHBoxLayout(g_power)


        self.btn_toggle = AnimatedButton("▶ 启动控制系统","#107C10", "#063A06")
        self.btn_toggle.setCheckable(True) # 设置为可选中状态(开关模式)
        # self.btn_toggle.setFixedSize(300, 100)

        shadow = QGraphicsDropShadowEffect()

        # 连接后状态改变为触发
        self.btn_toggle.toggled.connect(self.sys_toggle)
        self.btn_toggle.setGraphicsEffect(shadow)

        self.btn_stop = AnimatedButton("⏹紧急停止","red", "#A80000")
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

        g_quick = QGroupBox("2. 反推控制")
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

        g_deflection = QGroupBox("3. 偏转控制")
        l_deflection = QVBoxLayout(g_deflection)
        row_deflection = QHBoxLayout()
        self.spin_deflection = self._create_custom_spinbox(-12, 12, 0, prefix="偏转角度: ", suffix="°")
        self.btn_deflection = AnimatedButton("偏转角度", "#00BCD4", "#505050")
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
        self.slider_deflection.setStyleSheet(_SLIDER_STYLE)
        l_deflection.addWidget(self.slider_deflection)
        left_layout.addWidget(g_deflection)

        g_section = QGroupBox("4. 截面控制")
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
        self.slider_section.setStyleSheet(_SLIDER_STYLE)
        l_section.addWidget(self.slider_section)
        left_layout.addWidget(g_section)

        g_total = QGroupBox("5. 总控")
        l_total = QHBoxLayout(g_total)
        self.btn_initial_state = AnimatedButton("初态复位", "#1E1E1E", "#505050")
        self.btn_initial_state.clicked.connect(self.send_initial_state_command)
        l_total.addWidget(self.btn_initial_state)
        left_layout.addWidget(g_total)
        left_layout.addStretch()


        # 右侧看板
        right_widget = QWidget()
        right_widget.setMinimumWidth(300)
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

        # 创建滚动区域，将 content_widget 放入其中
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setWidget(content_widget)
        scroll_area.setMaximumHeight(750)   # 限制整体高度不超过 750px
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)   # 水平滚动按需显示
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)     # 垂直滚动按需显示

        # 触摸友好的滚动条样式（同时设置垂直和水平）
        scroll_area.setStyleSheet("""
            /* 垂直滚动条样式 */
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
            
            /* 水平滚动条样式 */
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
        # 将滚动区域设置为 DeviceTab 的主布局
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

    def create_motor_card(self, title, color):
        frame = QFrame()
        frame.setObjectName("motorCard")
        frame.setStyleSheet("""
            QFrame#motorCard { 
                background: #d9d9d6; 
                border: 1px solid white; 
                border-radius: 6px;
            }
            QFrame#motorCard:hover {
                border: 2px solid white;
            }
        """)
        main_layout = QVBoxLayout(frame)
        main_layout.setContentsMargins(6, 6, 6, 6)
        main_layout.setSpacing(10)
        top_widget = QWidget()
        top_layout = QHBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #333; font-weight: bold; font-size: 10pt; border: none;")
        title_label.setAlignment(Qt.AlignCenter)
        top_layout.addWidget(title_label)
        top_layout.addStretch()
        state_ball = QLabel("●")
        state_ball.setStyleSheet("color: #888; font-size: 8pt; border: none;")
        top_layout.addWidget(state_ball)
        main_layout.addWidget(top_widget)

        def create_block(block_name, unit, color):
            block_widget = QWidget()
            block_layout = QVBoxLayout(block_widget)
            block_layout.setContentsMargins(0, 0, 0, 0)
            block_layout.setSpacing(4)
            title_lbl = QLabel(f"{block_name} ({unit})")
            title_lbl.setStyleSheet(f"background-color: #d9d9d6;color: {color}; font-size: 10pt; font-weight: bold; border: none;")
            title_lbl.setAlignment(Qt.AlignCenter)
            block_layout.addWidget(title_lbl)
            value_widget = QWidget()
            value_layout = QHBoxLayout(value_widget)
            value_layout.setContentsMargins(0, 0, 0, 0)
            value_layout.setSpacing(30)
            cur_label = QLabel("当前: 0.00")
            cur_label.setStyleSheet("color: #0078D7; font-size: 8pt; font-weight: bold; border: none;")
            cur_label.setAlignment(Qt.AlignCenter)
            tar_label = QLabel("目标: 0.00")
            tar_label.setStyleSheet("color: #666; font-size: 8pt; border: none;")
            tar_label.setAlignment(Qt.AlignCenter)
            value_layout.addStretch()
            value_layout.addWidget(cur_label)
            value_layout.addWidget(tar_label)
            value_layout.addStretch()
            block_layout.addWidget(value_widget)
            return block_widget, cur_label, tar_label

        block_pos, cur_pos, tar_pos = create_block("位移", "mm", "#D13438")
        block_vel, cur_vel, tar_vel = create_block("速度", "mm/s", "#D13438")
        block_acc, cur_acc, tar_acc = create_block("加速度", "mm/s²", "#D13438")
        main_layout.addWidget(block_pos)
        line1 = QFrame()
        line1.setFrameShape(QFrame.HLine)
        line1.setStyleSheet("background-color: white; border: none; height: 3px;")
        main_layout.addWidget(line1)
        main_layout.addWidget(block_vel)
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setStyleSheet("background-color: white; border: none; height: 3px;")
        main_layout.addWidget(line2)
        main_layout.addWidget(block_acc)
        lbls = [cur_pos, tar_pos, cur_vel, tar_vel, cur_acc, tar_acc, state_ball]
        return frame, lbls

    def create_sensor_card(self, title, color):
        frame = QFrame()
        frame.setObjectName("sensorCard")
        frame.setStyleSheet("""
            QFrame#sensorCard { 
                background: #d9d9d6; 
                border: 1px solid white; 
                border-radius: 6px;
            }
            QFrame#sensorCard:hover {
                border: 2px solid white;
            }
        """)
        main_layout = QVBoxLayout(frame)
        main_layout.setContentsMargins(6, 6, 6, 6)
        main_layout.setSpacing(8)
        top_widget = QWidget()
        top_layout = QHBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #333; font-weight: bold; font-size: 10pt; border: none;")
        title_label.setAlignment(Qt.AlignLeft)
        top_layout.addWidget(title_label)
        main_layout.addWidget(top_widget)

        def create_axis_block(axis_name, unit):
            block_widget = QWidget()
            block_layout = QHBoxLayout(block_widget)
            block_layout.setContentsMargins(0, 0, 0, 0)
            block_layout.setSpacing(10)
            block_layout.addStretch()
            label = QLabel(f"{axis_name} ({unit}):")
            label.setStyleSheet(f"color: {color}; font-size: 8pt; font-weight: bold; border: none;")
            label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            block_layout.addWidget(label)
            value_label = QLabel("0.00")
            value_label.setStyleSheet(f"color: #000; font-size: 8pt; font-weight: bold; border: none;")
            value_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
            block_layout.addWidget(value_label)
            block_layout.addStretch()
            return block_widget, value_label

        block_pitch, val_pitch = create_axis_block("Pitch", "deg")
        block_roll, val_roll = create_axis_block("Roll", "deg")
        block_yaw, val_yaw = create_axis_block("Yaw", "deg")
        main_layout.addWidget(block_pitch)
        line1 = QFrame()
        line1.setFrameShape(QFrame.HLine)
        line1.setStyleSheet("background-color: white; border: none; height: 1px;")
        main_layout.addWidget(line1)
        main_layout.addWidget(block_roll)
        line2 = QFrame()
        line2.setFrameShape(QFrame.HLine)
        line2.setStyleSheet("background-color: white; border: none; height: 1px;")
        main_layout.addWidget(line2)
        main_layout.addWidget(block_yaw)
        lbls = [val_pitch, val_roll, val_yaw]
        return frame, lbls

    def create_flat_card(self, title, val, color):
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #d9d9d6; border: 3px solid white; border-radius: 6px; }")
        layout = QHBoxLayout(frame)
        lbl_val = QLabel(val)
        lbl_val.setStyleSheet(f"color: {color}; font-size: 12pt; font-weight: bold; border: none;")
        layout.addWidget(QLabel(title, styleSheet="color: black; font-weight:bold; border:none; font-size:12pt;"))
        layout.addStretch()
        layout.addWidget(lbl_val)
        return frame, lbl_val

    def expand_device(self, dev_type):
        if dev_type == 'motor':
            self.num_m += 1
            self.motor_data.append([0.0, 0.0, 0.0])
            self.motor_states.append(0)
            self.motor_target.append([0.0, 0.0, 0.0])
            self.hist_motors = [step + [[0.0, 0.0, 0.0]] for step in self.hist_motors]
            self.m_page = 0
        else:
            self.num_s += 1
            self.sensor_data.append([0.0, 0.0, 0.0])
            self.hist_sensors = [step + [[0.0, 0.0, 0.0]] for step in self.hist_sensors]
            self.s_page = 0
        self.rebuild_cards()
        self.refresh_pagination()
        self.logger(f"🔧 成功扩容了一个{dev_type}，当前 M:{self.num_m}, S:{self.num_s}", port=self.port_name)

    def rebuild_cards(self):
        if self.num_m > 0:
            while len(self.motor_data) < self.num_m:
                self.motor_data.append([0.0, 0.0, 0.0])
                self.motor_target.append([0.0, 0.0, 0.0])
            while len(self.motor_states) < self.num_m:
                self.motor_states.append(0)
            self.motor_data = self.motor_data[:self.num_m]
            self.motor_target = self.motor_target[:self.num_m]
            self.motor_states = self.motor_states[:self.num_m]
        else:
            self.motor_data = []
            self.motor_target = []
            self.motor_states = []
        if self.num_s > 0:
            while len(self.sensor_data) < self.num_s:
                self.sensor_data.append([0.0, 0.0, 0.0])
            self.sensor_data = self.sensor_data[:self.num_s]
        else:
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

    def sys_toggle(self,checked):
        """开关按钮状态变化时的处理函数"""
        if checked:
            # 按钮被按下（开启状态）
            self.btn_toggle.setText("⏹ 关闭控制系统")
            self.btn_toggle.set_normal_color("#D13438")  # 改为危险样式（红色）
            self.btn_toggle.set_hover_color("#6B1418")
            # 刷新样式表，使属性生效
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            self.sys_start()   # 启动系统
        else:
            # 按钮弹起（关闭状态）
            self.btn_toggle.setText("▶ 启动控制系统")
            self.btn_toggle.set_normal_color("#107C10")  # 恢复成功样式（绿色）
            self.btn_toggle.set_hover_color("#063A06")
            self.btn_toggle.style().unpolish(self.btn_toggle)
            self.btn_toggle.style().polish(self.btn_toggle)
            self.sys_close()    # 关闭系统

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

    def handle_serial_error(self, error_msg):
        self.serial_error = True
        if self.history_timer.isActive():
            self.history_timer.stop()
        self.hist_time.clear()
        self.hist_motors.clear()
        self.hist_sensors.clear()
        self.logger(f"❌ 串口异常: {error_msg}", port=self.port_name)
        msg_box = QMessageBox(self)
        msg_box.setIcon(QMessageBox.Critical)
        msg_box.setWindowTitle("串口断连")
        msg_box.setText(f"当前串口设备 {self.port_name} 已断开连接！")
        msg_box.setInformativeText("请关闭当前数据页面，重新连接串口设备。")
        msg_box.setStandardButtons(QMessageBox.Ok)
        msg_box.exec_()
        # 禁用所有操作按钮
        for btn in [self.btn_stop, self.btn_home, self.btn_motion_ctrl,
                    self.btn_deflection, self.btn_section, self.btn_initial_state]:
            btn.setEnabled(False)

    def send_cmd(self, func_code, action, detail, data=b'', is_motor=True):
        try:
            if func_code not in [0x00, 0x01, 0x02, 0x04, 0x06, 0xFE] and not self.is_started:
                error_msg = "请先点击启动控制系统"
                QMessageBox.warning(self, "拒绝", error_msg)
                self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
                return

            frame_head = 0xAA if is_motor else 0xBB
            frame = struct.pack('>BBB', frame_head, func_code, len(data)) + data
            frame += bytes([sum(frame) & 0xFF])
            self.worker.send_data(frame)
            # 记录操作历史
            GlobalHistory.add_record(self.port_name, action, detail, frame.hex().upper())

            # 根据功能码选择不同的日志级别
            if func_code == 0x02:  # 紧急停止 - 使用 WARNING 级别
                self.logger(f"📤 {action} -> {detail}", raw_data=frame, level="WARNING", port=self.port_name)
            else:  # 其他操作 - 使用 INFO 级别
                self.logger(f"📤 {action} -> {detail}", raw_data=frame, port=self.port_name)

        except serial.SerialException as e:
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

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
            GlobalHistory.add_record(self.port_name, "初态复位", "偏转角度=0°, 截面面积变化=100%, 所有电机距离复位为0", frame.hex().upper())
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

            # ---------- 根据解析结果更新前端状态 ----------
            # 1. 若设备数量变化，重建卡片
            if status.num_motors != self.num_m or status.num_sensors != self.num_s:
                self.num_m = status.num_motors
                self.num_s = status.num_sensors
                self.rebuild_cards()

            # 2. 更新电机和传感器数据（格式转换为原前端使用的列表）
            self.motor_data = [[m.pos, m.vel, m.acc] for m in status.motors]
            self.motor_states = [m.status for m in status.motors]
            self.sensor_data = [[s.pitch, s.roll, s.yaw] for s in status.sensors]

            # 3. 更新喷管参数
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

        # 电机/传感器数据
        should_record_motor = (self.num_m > 0 and self.motor_data and len(self.motor_data) == self.num_m)
        should_record_sensor = (self.num_s > 0 and self.sensor_data and len(self.sensor_data) == self.num_s)

        if should_record_motor or should_record_sensor:
            self.hist_time.append(current_time_sec)
            if should_record_motor:
                self.hist_motors.append(self.motor_data.copy())
            else:
                self.hist_motors.append([])
            if should_record_sensor:
                self.hist_sensors.append(self.sensor_data.copy())
            else:
                self.hist_sensors.append([])

            # 保持最近60s的点
            time_window = 60.0  # 秒
            while self.hist_time and self.hist_time[0] < current_time_sec - time_window:
                self.hist_time.pop(0)
                if self.hist_motors:
                    self.hist_motors.pop(0)
                if self.hist_sensors:
                    self.hist_sensors.pop(0)

        if hasattr(self, 'active_graph_controller') and self.active_graph_controller:
            # 检查对应的 UI 窗口是否可见
            if hasattr(self, 'active_graph_ui') and self.active_graph_ui and self.active_graph_ui.isVisible():
                if self.active_type == 'motor' and self.hist_motors and len(self.hist_motors) > 0:
                    valid_motor_data = [data for data in self.hist_motors if data and len(data) > 0]
                    valid_times = self.hist_time[-len(valid_motor_data):] if valid_motor_data else []
                    self.active_graph_controller.update_multi_data(valid_times, valid_motor_data)
                    if valid_motor_data and len(valid_motor_data) > 0:
                        self.active_graph_controller.update_multi_data(valid_times, valid_motor_data)
                elif self.active_type == 'sensor' and self.hist_sensors and len(self.hist_sensors) > 0:
                    valid_sensor_data = [data for data in self.hist_sensors if data and len(data) > 0]
                    valid_times = self.hist_time[-len(valid_sensor_data):] if valid_sensor_data else []
                    if valid_sensor_data and len(valid_sensor_data) > 0:
                        self.active_graph_controller.update_multi_data(valid_times, valid_sensor_data)

    def open_bend_graph(self):
        """打开偏转角度历史曲线窗口"""
        if self.bend_graph_window is None:
            from UI.graph_window import BendGraphWindow
            from Core.GraphController import BendGraphController
            self.bend_graph_window = BendGraphWindow(self)
            self.bend_graph_controller = BendGraphController(self.bend_graph_window, self)
        self.bend_graph_window.show()
        self.bend_graph_window.raise_()
        # 立即更新数据：打开瞬间也只绘制最近 20 秒，避免一次性加载过多点导致卡顿
        if self.hist_bend_time:
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

    #----------辅助函数----------------#
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
                min-height: 34px;
                font-size: 10pt;
                font-weight: bold;
                border: 2px solid #b0b0b0;
                border-radius: 10px;
                background: white;
                padding-right: 5px;
            }
            QDoubleSpinBox:focus {
                border-color: #0078D7;
            }
        """)

        btn_plus = QPushButton("+")
        btn_plus.setFixedSize(34, 34)
        btn_plus.setCursor(Qt.PointingHandCursor)
        btn_plus.setStyleSheet("""
            QPushButton {
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 5px;
                font-size: 10pt;
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
        btn_minus.setFixedSize(34, 34)
        btn_minus.setCursor(Qt.PointingHandCursor)
        btn_minus.setStyleSheet("""
            QPushButton {
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 5px;
                font-size: 10pt;
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