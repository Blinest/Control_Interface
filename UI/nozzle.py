# ==========================================
# 喷管统一基类 Nozzle
# ==========================================
# Qt类
import struct
import time
import serial
from PyQt5.QtWidgets import (QWidget, QHBoxLayout, QVBoxLayout, QLabel, QFrame, QGroupBox,
                             QDoubleSpinBox, QPushButton, QMessageBox, QAbstractSpinBox,
                             QSplitter, QSplitterHandle, QScrollArea, QProgressBar)
from PyQt5.QtGui import QPainter, QColor
from PyQt5.QtCore import Qt, QTimer

from Core.auth import GlobalHistory
from Core.serial_worker import SerialWorker


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


class ControlStatusLamp:
    """控制分组三态提示灯状态机（待机 / 运行中 / 运行完成）

    通过 feed_value 喂入最新「当前值」驱动状态：
    - 当前值持续变化 -> 运行中（记录运行时长）
    - 连续 done_frames 帧无变化 -> 运行完成（保留本次运行时长）
    - 运行完成保持 done_hold_seconds 秒后自动回待机
    tick 由 Nozzle.status_timer(200ms) 定时驱动。
    """

    STATE_IDLE, STATE_RUNNING, STATE_DONE = 0, 1, 2
    IDLE_COLOR, RUNNING_COLOR, DONE_COLOR = "#9E9E9E", "#107C10", "#0078D7"

    def __init__(self, change_threshold=0.02, done_frames=5, done_hold_seconds=1.0):
        self.state = self.STATE_IDLE
        self.last_value = None
        self.change_threshold = change_threshold    # 判定「变化」的最小差值
        self.done_frames = done_frames              # 连续无变化帧数 -> 视为完成
        self.done_hold_seconds = done_hold_seconds  # 完成后保持时间（秒），默认 1s
        self._static_frames = 0
        self.run_start_time = None                  # 运行开始时刻（time.time）
        self._done_at = None                        # 进入完成态的时刻
        self.elapsed_seconds = 0.0                  # 最近一次运行时长（秒）

        # UI：三灯 + 运行时间标签
        self.lbl_idle = QLabel("● 待机")
        self.lbl_running = QLabel("● 运行中")
        self.lbl_done = QLabel("● 完成")
        self.lbl_time = QLabel("⏱ 0.0s")
        self._apply_colors()

    def feed_value(self, value):
        """喂入最新当前值，驱动状态机（每次收到状态帧调用）"""
        if self.last_value is None:
            self.last_value = value
            return
        delta = abs(value - self.last_value)
        self.last_value = value
        if delta > self.change_threshold:
            self._static_frames = 0
            if self.state != self.STATE_RUNNING:
                self._set_state(self.STATE_RUNNING)
        else:
            if self.state == self.STATE_RUNNING:
                self._static_frames += 1
                if self._static_frames >= self.done_frames:
                    self._set_state(self.STATE_DONE)

    def tick(self):
        """定时驱动：运行中刷新时长；完成后 1s 自动回待机"""
        if self.state == self.STATE_RUNNING and self.run_start_time:
            self.lbl_time.setText(f"⏱ {time.time() - self.run_start_time:.1f}s")
        elif self.state == self.STATE_DONE:
            if time.time() - self._done_at >= self.done_hold_seconds:
                self._set_state(self.STATE_IDLE)

    def _set_state(self, state):
        self.state = state
        if state == self.STATE_RUNNING:
            if self.run_start_time is None:
                self.run_start_time = time.time()
        elif state == self.STATE_DONE:
            if self.run_start_time is not None:
                self.elapsed_seconds = time.time() - self.run_start_time
            self.lbl_time.setText(f"⏱ {self.elapsed_seconds:.1f}s")
            self._done_at = time.time()
        else:  # IDLE
            self.run_start_time = None
            self._done_at = None
            self.elapsed_seconds = 0.0
            self.lbl_time.setText("⏱ 0.0s")
        self._apply_colors()

    def reset(self):
        """强制回到待机态（系统关闭时调用）"""
        self.last_value = None
        self._static_frames = 0
        self._set_state(self.STATE_IDLE)

    def _apply_colors(self):
        # 当前状态灯高亮粗体，其余灰暗
        def style(color, active):
            if active:
                return f"color: {color}; font-size: 12pt; font-weight: bold; border: none;"
            return "color: #C0C0C0; font-size: 12pt; border: none;"
        self.lbl_idle.setStyleSheet(style(self.IDLE_COLOR, self.state == self.STATE_IDLE))
        self.lbl_running.setStyleSheet(style(self.RUNNING_COLOR, self.state == self.STATE_RUNNING))
        self.lbl_done.setStyleSheet(style(self.DONE_COLOR, self.state == self.STATE_DONE))


class Nozzle(QWidget):
    """喷管统一基类

    提供三类喷管界面（LQTS / LYZ / S弯）的公共初始化、系统启停、
    命令发送、串口断连处理、曲线窗口打开与通用控件创建。
    子类通过类属性配置差异，通过钩子方法表达喷管特有行为。
    """

    # 类属性（子类可覆盖）
    NOZZLE_NAME = "喷管"                  # 显示名称
    ALLOWED_WHEN_STOPPED = {0x00, 0x01, 0x02, 0x04, 0x06, 0xFE}  # 未启动时可发送的功能码
    SPINBOX_BUTTON_SIZE = 42            # 自定义 SpinBox 加减按钮尺寸
    SPINBOX_FONT_SIZE = "14pt"          # SpinBox 输入框字号
    SPINBOX_BUTTON_FONT_SIZE = "16pt"   # SpinBox 加减按钮字号
    CARD_VALUE_FONT_SIZE = "16pt"       # 数据卡片数值字号
    CARD_TITLE_FONT_SIZE = "14pt"       # 数据卡片标题字号
    BEND_GRAPH_WINDOW_CLASS = None      # 历史曲线窗口类
    BEND_GRAPH_CONTROLLER_CLASS = None  # 历史曲线控制器类

    # ---------- 布局配置（子类可覆盖） ----------
    LEFT_MIN_WIDTH = 380                # 左侧控制面板最小宽度
    RIGHT_MIN_WIDTH = 300               # 右侧看板最小宽度
    LEFT_STRETCH = 3                    # 左右分割条伸缩权重（左侧占比更大）
    RIGHT_STRETCH = 4
    SCROLL_AREA_MAX_HEIGHT = 750        # 滚动区域最大高度

    # ---------- 统一样式（子类可覆盖） ----------
    GROUPBOX_STYLE = (
        "QGroupBox { font-size: 14pt; font-weight: bold; border: 3px solid white; "
        "border-radius: 5px; margin-top: 15px; padding: 8px; }"
    )
    SECTION_LABEL_STYLE = "font-size: 16pt; font-weight: bold;"
    SPLITTER_STYLE = """
        QSplitter::handle {
            background: #e0e0e0;
            border-left: 1px solid #bdbdbd;
            border-right: 1px solid #bdbdbd;
        }
        QSplitter::handle:hover { background: #bbdefb; }
        QSplitter::handle:pressed { background: #90caf9; }
    """
    SLIDER_STYLE = """
        QSlider::groove:horizontal {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
        }
        QSlider::sub-page:horizontal { background: #00BCD4; border-radius: 3px; }
        QSlider::handle:horizontal {
            background: #0078D7;
            width: 18px;
            height: 18px;
            margin: -6px 0;
            border-radius: 9px;
        }
        QSlider::handle:horizontal:hover { background: #005A9E; }
    """
    PROGRESS_STYLE = """
        QProgressBar {
            border: 2px solid #b0b0b0;
            border-radius: 8px;
            background: #e0e0e0;
            min-height: 22px;
        }
        QProgressBar::chunk {
            background: #006400;
            border-radius: 6px;
        }
    """
    SCROLLBAR_STYLE = """
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
        QScrollBar::handle:vertical:hover { background: #666; }
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0px; }

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
        QScrollBar::handle:horizontal:hover { background: #666; }
        QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0px; }
    """

    def __init__(self, port_name, parent_logger, auth_service=None):
        super().__init__()
        self.auth_service = auth_service
        if self.auth_service and not self.auth_service.is_admin():
            # 普通用户可能没有某些高级操作权限，子类可在 init_nozzle_state 中处理
            pass

        self.port_name = port_name
        self.logger = parent_logger

        self.start_time = None     # 起始时间戳（None 表示未初始化）
        self.serial_error = False  # 串口是否发生错误
        self.recv_buffer = bytearray()
        self.is_started = False

        # 数据记录定时器（统一在这里启动，子类无须重复创建）
        self.history_timer = QTimer()
        self.history_timer.timeout.connect(self.record_history)
        self.history_timer.start(10)

        # 控制分组三态提示灯：注册表 + 定时刷新定时器
        self.status_lamps = []
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self._tick_status_lamps)
        self.status_timer.start(200)

        # 曲线窗口实例
        self.bend_graph_window = None
        self.bend_graph_controller = None

        # 串口 worker
        self.worker = SerialWorker(port_name)
        self.worker.signal_data.connect(self.parse_data)
        self.worker.signal_error.connect(self.handle_serial_error)

        # 子类钩子：初始化喷管特有状态
        self.init_nozzle_state()

        # 子类钩子：创建具体界面
        self.init_ui()

        # 启动串口 worker
        self.worker.start()

    # ---------- 子类需要实现的钩子 ----------
    def init_nozzle_state(self):
        """初始化喷管特有状态（必须由子类实现）"""
        raise NotImplementedError

    def init_ui(self):
        """创建具体界面（必须由子类实现）"""
        raise NotImplementedError

    def parse_data(self, data):
        """解析串口数据（必须由子类实现）"""
        raise NotImplementedError

    def record_history(self):
        """记录历史数据（必须由子类实现）"""
        raise NotImplementedError

    def get_error_disable_buttons(self):
        """返回串口断连时需要禁用的按钮列表"""
        return []

    def clear_error_history(self):
        """清空错误发生时需要清理的历史数据（可选覆盖）"""
        for attr in ("hist_time", "hist_motors", "hist_sensors"):
            if hasattr(self, attr):
                getattr(self, attr).clear()

    # ---------- 系统启停 ----------
    def sys_toggle(self, checked):
        """开关按钮状态变化时的处理函数"""
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

    def sys_start(self):
        if self.is_started:
            return
        self.is_started = True
        self.send_cmd(0x01, "使能", f"启动{self.NOZZLE_NAME}喷管", is_motor=True)

    def sys_close(self):
        self.is_started = False
        self.reset_status_lamps()   # 系统关闭，全部提示灯回待机
        self.send_cmd(0x00, "失能", f"关闭{self.NOZZLE_NAME}喷管", is_motor=True)

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
        self.send_cmd(0x02, "紧急停止", f"{self.NOZZLE_NAME}紧急停止按钮", is_motor=True)

    # ---------- 命令发送 ----------
    def send_cmd(self, func_code, action, detail, data=b'', is_motor=True):
        try:
            if func_code not in self.ALLOWED_WHEN_STOPPED and not self.is_started:
                error_msg = "请先点击启动控制系统"
                QMessageBox.warning(self, "拒绝", error_msg)
                self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
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
            error_msg = f"串口通信失败: {str(e)}"
            QMessageBox.critical(self, "串口错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
        except Exception as e:
            error_msg = f"发送命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    # ---------- 串口错误处理 ----------
    def handle_serial_error(self, error_msg):
        self.serial_error = True
        if self.history_timer.isActive():
            self.history_timer.stop()
        self.clear_error_history()
        self.logger(f"❌ 串口异常: {error_msg}", port=self.port_name)
        msg_box = QMessageBox(self)
        msg_box.setIcon(QMessageBox.Critical)
        msg_box.setWindowTitle("串口断连")
        msg_box.setText(f"当前串口设备 {self.port_name} 已断开连接！")
        msg_box.setInformativeText("请关闭当前数据页面，重新连接串口设备。")
        msg_box.setStandardButtons(QMessageBox.Ok)
        msg_box.exec_()
        for btn in self.get_error_disable_buttons():
            btn.setEnabled(False)

    # ---------- 曲线窗口 ----------
    def open_bend_graph(self):
        """打开偏转/弯曲历史曲线窗口"""
        if self.bend_graph_window is None:
            BendGraphWindow = self.BEND_GRAPH_WINDOW_CLASS
            BendGraphController = self.BEND_GRAPH_CONTROLLER_CLASS
            if BendGraphWindow is None or BendGraphController is None:
                QMessageBox.warning(self, "提示", "当前喷管类型未配置历史曲线窗口。")
                return
            self.bend_graph_window = BendGraphWindow(self)
            self.bend_graph_controller = BendGraphController(self.bend_graph_window, self)
        self.bend_graph_window.show()
        self.bend_graph_window.raise_()
        self.refresh_bend_graph()

    def refresh_bend_graph(self):
        """用最新历史数据刷新曲线窗口（可选覆盖）"""
        if (self.bend_graph_window and self.bend_graph_window.isVisible()
                and self.bend_graph_controller and self.hist_bend_time):
            self.bend_graph_controller.window.update_data(
                self.hist_bend_time, self.hist_bend_target, self.hist_bend_current
            )

    # ---------- 通用控件 ----------
    def create_flat_card(self, title, val, color):
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #d9d9d6; border: 3px solid white; border-radius: 6px; }")
        layout = QHBoxLayout(frame)
        lbl_val = QLabel(val)
        lbl_val.setStyleSheet(f"color: {color}; font-size: {self.CARD_VALUE_FONT_SIZE}; font-weight: bold; border: none;")
        layout.addWidget(QLabel(title, styleSheet=f"color: black; font-weight:bold; border:none; font-size:{self.CARD_TITLE_FONT_SIZE};"))
        layout.addStretch()
        layout.addWidget(lbl_val)
        return frame, lbl_val

    def create_progress_card(self, title, unit, color):
        """创建"目标/当前"进度条卡片：进度条终点=目标值，进度=当前值

        返回 (frame, progress_bar, lbl_val)；配合 set_progress_value 更新。
        """
        frame = QFrame()
        frame.setStyleSheet("QFrame { background: #d9d9d6; border: 3px solid white; border-radius: 6px; }")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(8, 6, 8, 6)
        header = QHBoxLayout()
        header.addWidget(QLabel(f"{title} ({unit})", styleSheet=f"color: black; font-weight:bold; border:none; font-size:{self.CARD_TITLE_FONT_SIZE};"))
        lbl_val = QLabel("0.00")
        lbl_val.setStyleSheet(f"color: {color}; font-size: {self.CARD_VALUE_FONT_SIZE}; font-weight: bold; border: none;")
        header.addStretch()
        header.addWidget(lbl_val)
        layout.addLayout(header)

        progress = QProgressBar()
        progress.setRange(0, 100)          # 默认 0~100，set_progress_value 动态调整
        progress.setTextVisible(False)     # 数值由 lbl_val 显示
        progress.setStyleSheet(self.PROGRESS_STYLE)
        layout.addWidget(progress)
        return frame, progress, lbl_val

    def set_progress_value(self, progress, lbl_val, current, target):
        """更新进度条：终点=目标值，进度=当前值。进度条始终从左向右填充"""
        lbl_val.setText(f"{current:.2f}")
        # 无论目标正负，进度条均从左向右：用 |目标| 定终点，|当前| 填进度
        mag = abs(target)
        progress.setRange(0, max(1, int(round(mag * 100))))
        progress.setInvertedAppearance(False)
        # 进度 = |当前值|，clamp 到 [0, |目标|]
        value = max(min(abs(current), mag), 0)
        progress.setValue(int(value * 100))


    def create_motor_card(self, title, color="#000"):
        """创建电机状态卡片（LQTS用）"""
        frame = QFrame()
        frame.setObjectName("motorCard")
        frame.setStyleSheet("""
            QFrame#motorCard {
                background: #d9d9d6;
                border: 1px solid white;
                border-radius: 6px;
            }
            QFrame#motorCard:hover { border: 2px solid white; }
        """)
        main_layout = QVBoxLayout(frame)
        main_layout.setContentsMargins(6, 6, 6, 6)
        main_layout.setSpacing(10)
        top_widget = QWidget()
        top_layout = QHBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #333; font-weight: bold; font-size: 13pt; border: none;")
        title_label.setAlignment(Qt.AlignCenter)
        top_layout.addWidget(title_label)
        top_layout.addStretch()
        state_ball = QLabel("●")
        state_ball.setStyleSheet("color: #888; font-size: 13pt; border: none;")
        top_layout.addWidget(state_ball)
        main_layout.addWidget(top_widget)

        def create_block(block_name, unit, color):
            block_widget = QWidget()
            block_layout = QVBoxLayout(block_widget)
            block_layout.setContentsMargins(0, 0, 0, 0)
            block_layout.setSpacing(4)
            title_lbl = QLabel(f"{block_name} ({unit})")
            title_lbl.setStyleSheet(f"background-color: #d9d9d6;color: {color}; font-size: 13pt; font-weight: bold; border: none;")
            title_lbl.setAlignment(Qt.AlignCenter)
            block_layout.addWidget(title_lbl)
            value_widget = QWidget()
            value_layout = QHBoxLayout(value_widget)
            value_layout.setContentsMargins(0, 0, 0, 0)
            value_layout.setSpacing(30)
            cur_label = QLabel("当前: 0.00")
            cur_label.setStyleSheet("color: #0078D7; font-size: 13pt; font-weight: bold; border: none;")
            cur_label.setAlignment(Qt.AlignCenter)
            tar_label = QLabel("目标: 0.00")
            tar_label.setStyleSheet("color: #666; font-size: 13pt; border: none;")
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

    def create_sensor_card(self, title, color="#D83B01"):
        """创建 IMU 传感器状态卡片（LQTS 专用）"""
        frame = QFrame()
        frame.setObjectName("sensorCard")
        frame.setStyleSheet("""
            QFrame#sensorCard {
                background: #d9d9d6;
                border: 1px solid white;
                border-radius: 6px;
            }
            QFrame#sensorCard:hover { border: 2px solid white; }
        """)
        main_layout = QVBoxLayout(frame)
        main_layout.setContentsMargins(6, 6, 6, 6)
        main_layout.setSpacing(8)
        top_widget = QWidget()
        top_layout = QHBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #333; font-weight: bold; font-size: 13pt; border: none;")
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
            label.setStyleSheet(f"color: {color}; font-size: 13pt; font-weight: bold; border: none;")
            label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            block_layout.addWidget(label)
            value_label = QLabel("0.00")
            value_label.setStyleSheet("color: #000; font-size: 13pt; font-weight: bold; border: none;")
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

    def create_single_monitor_card(self, title, color, font_size="15pt"):
        """创建定点监测卡片（LQTS 专用）"""
        card_frame = QFrame()
        card_frame.setStyleSheet("QFrame { background: #d9d9d6; border: 3px solid white; border-radius: 10px; }")
        card_layout = QHBoxLayout(card_frame)
        title_label = QLabel(title)
        title_label.setStyleSheet("color: black; font-weight:bold; border:none; font-size:15pt;")
        value_label = QLabel("0.00")
        value_label.setStyleSheet(f"color: {color}; font-size: {font_size}; font-weight: bold; border: none;")
        value_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        card_layout.addWidget(title_label)
        card_layout.addStretch()
        card_layout.addWidget(value_label)
        return card_frame, title_label, value_label

    # ---------- 布局样式 ----------
    def create_splitter(self, left_widget, right_widget):
        """创建左右分割条并应用统一样式与伸缩权重"""
        splitter = TouchSplitter(Qt.Horizontal)
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, self.LEFT_STRETCH)
        splitter.setStretchFactor(1, self.RIGHT_STRETCH)
        splitter.setStyleSheet(self.SPLITTER_STYLE)
        return splitter

    def create_scroll_area(self, content_widget):
        """创建带统一滚动条样式的滚动区域"""
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setWidget(content_widget)
        scroll_area.setMaximumHeight(self.SCROLL_AREA_MAX_HEIGHT)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll_area.setStyleSheet(self.SCROLLBAR_STYLE)
        return scroll_area

    def build_page_layout(self, left_widget, right_widget):
        """组装标准页面：内容容器 + 分割条 + 滚动区域"""
        main_layout = QHBoxLayout(self)
        content_widget = QWidget()
        content_layout = QHBoxLayout(content_widget)
        splitter = self.create_splitter(left_widget, right_widget)
        content_layout.addWidget(splitter)

        scroll_area = self.create_scroll_area(content_widget)
        self.setLayout(QVBoxLayout())
        self.layout().addWidget(scroll_area)
        return splitter

    def create_group_box(self, title):
        """创建带统一样式的 GroupBox"""
        group_box = QGroupBox(title)
        group_box.setStyleSheet(self.GROUPBOX_STYLE)
        return group_box

    # ---------- 控制状态提示灯 ----------
    def create_status_lamp(self, **kw):
        """创建并注册一个三态提示灯，子类为每个控制 GroupBox 调用"""
        lamp = ControlStatusLamp(**kw)
        self.status_lamps.append(lamp)
        return lamp

    def create_status_lamp_row(self, lamp):
        """创建三灯 + 运行时间的一行控件，用于 GroupBox 内布局"""
        row = QWidget()
        h = QHBoxLayout(row)
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(8)
        h.addWidget(lamp.lbl_idle)
        h.addWidget(lamp.lbl_running)
        h.addWidget(lamp.lbl_done)
        h.addStretch()
        h.addWidget(lamp.lbl_time)
        return row

    def reset_status_lamps(self):
        """所有提示灯强制回到待机态"""
        for lamp in self.status_lamps:
            lamp.reset()

    def _tick_status_lamps(self):
        """定时刷新所有提示灯（运行时长 / 完成后回待机）"""
        for lamp in self.status_lamps:
            lamp.tick()

    def create_section_label(self, text):
        """创建控制区段标签"""
        label = QLabel(text)
        label.setStyleSheet(self.SECTION_LABEL_STYLE)
        return label

    def _create_custom_spinbox(self, min_val, max_val, default, prefix='', suffix='', step=1.0):
        """创建带自定义 +/- 按钮的 SpinBox 组合控件"""
        size = self.SPINBOX_BUTTON_SIZE
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
        spin.setStyleSheet(f"""
            QDoubleSpinBox {{
                min-height: {size}px;
                font-size: {self.SPINBOX_FONT_SIZE};
                font-weight: bold;
                border: 2px solid #b0b0b0;
                border-radius: 10px;
                background: white;
                padding-right: 5px;
            }}
            QDoubleSpinBox:focus {{
                border-color: #0078D7;
            }}
        """)

        btn_plus = QPushButton("+")
        btn_plus.setFixedSize(size, size)
        btn_plus.setCursor(Qt.PointingHandCursor)
        btn_plus.setStyleSheet(f"""
            QPushButton {{
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 5px;
                font-size: {self.SPINBOX_BUTTON_FONT_SIZE};
                font-weight: bold;
                color: #333;
            }}
            QPushButton:hover {{ background-color: #e0e0e0; }}
            QPushButton:pressed {{ background-color: #c0c0c0; }}
        """)
        btn_plus.clicked.connect(lambda: spin.stepUp())

        btn_minus = QPushButton("-")
        btn_minus.setFixedSize(size, size)
        btn_minus.setCursor(Qt.PointingHandCursor)
        btn_minus.setStyleSheet(f"""
            QPushButton {{
                background-color: #f2f2f2;
                border: 2px solid #b0b0b0;
                border-radius: 5px;
                font-size: {self.SPINBOX_BUTTON_FONT_SIZE};
                font-weight: bold;
                color: #333;
            }}
            QPushButton:hover {{ background-color: #e0e0e0; }}
            QPushButton:pressed {{ background-color: #c0c0c0; }}
        """)
        btn_minus.clicked.connect(lambda: spin.stepDown())

        layout.addWidget(spin)
        layout.addWidget(btn_plus)
        layout.addWidget(btn_minus)

        container.spin = spin
        return container
