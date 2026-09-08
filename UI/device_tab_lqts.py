# ==========================================
# 5. 设备选项卡 - LQTS
# ==========================================

# Qt类
import struct
import math
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
                             QLabel, QComboBox, QTabWidget,
                             QFrame, QMessageBox, QGraphicsDropShadowEffect)
from PyQt5.QtCore import Qt, QTimer, pyqtSlot

from Core.protocol_lqts import ProtocolParser, DataFilter, FrameAssembler
from Core.auth import GlobalHistory
from UI.nozzle import Nozzle, TouchSplitter
# 自定义类
from .widgets import AnimatedButton
# 工具类
import time


class LqtsDeviceTab(Nozzle):
    NOZZLE_NAME = "LQTS"
    ALLOWED_WHEN_STOPPED = {0x00, 0x01, 0x02, 0x04, 0x06, 0xFE}
    SPINBOX_BUTTON_SIZE = 44
    BEND_GRAPH_WINDOW_CLASS = None   # 延迟导入赋值，见模块底部
    BEND_GRAPH_CONTROLLER_CLASS = None

    def __init__(self, port_name, parent_logger, auth_service=None):
        super().__init__(port_name, parent_logger, auth_service)

    def init_nozzle_state(self):
        self.frame_assembler = FrameAssembler()
        self.num_m, self.num_s = 0, 0
        self.motor_data, self.sensor_data = [], []
        self.motor_target = []
        self.motor_states = []
        self.scale_data = 100.0
        self.current_bend_angle = 0.0
        self.current_area_change = 0.0
        self.target_bend_angle = 0.0
        self.target_area_change = 0.0

        self.hist_bend_time = []       # 时间列表
        self.hist_bend_target = []     # 目标角度列表
        self.hist_bend_current = []    # 当前角度列表
        self.hist_area_target = []     # 目标截面面积缩放比列表
        self.hist_area_current = []    # 当前截面面积缩放比列表
        self.bend_graph_window = None  # 角度偏转曲线窗口实例
        self.bend_graph_controller = None
        self._last_embedded_update = 0.0       # 内嵌实时曲线刷新节流
        self.embedded_update_interval = 0.1    # 与 LYZ 一致

        self.m_page, self.s_page = 0, 0
        self.cards_motor, self.cards_sensor = [], []

        self.plot_time = 0
        self.hist_time, self.hist_motors, self.hist_sensors = [], [], []
        self.active_graph = None

        # 创建滤波器
        self.data_filter = DataFilter(window_size=3)
        self.filtered_bend_angle = 0.0
        self.angle_filter_alpha = 0.3   # 滤波系数

        # 闭环角度偏转：启动仅下发一次指令，示数稳定（波动≤0.1°连续3s）后自动停止
        self.closed_loop_enabled = False
        self.closed_loop_target_angle = 0.0
        self._stop_stable_start = 0.0      # 波动开始稳定（秒）
        self._stop_stable_min = None       # 稳定窗口内最小示数
        self._stop_stable_max = None       # 稳定窗口内最大示数
        self.stop_stability_threshold = 0.05   # 示数波动阈值（度）
        self.stop_stability_duration = 5.0    # 稳定持续时间（秒）
        self.control_timer = QTimer()
        self.control_timer.timeout.connect(self.closed_loop_control)
        self.control_timer.start(200)   # 控制周期 200ms

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

        g_bend = self.create_group_box("2. 角度偏转控制")
        self.lamp_bend = self.create_status_lamp()
        v_bend_box = QVBoxLayout(g_bend)
        l_bend = QHBoxLayout()
        # 自定义带加减按钮的 SpinBox 容器
        self.spin_bend = self._create_custom_spinbox(-70, 70, 0, prefix= "Angle: ", suffix="°")
        self.btn_bend = AnimatedButton("开环角度偏转","#00BCD4","#505050")
        self.btn_bend.clicked.connect(lambda checked: self.send_bend_command())
        # 闭环角度偏转按钮（周期发送目标角度，到位后自动停止）
        self.btn_closed_bend = AnimatedButton("闭环角度偏转","#FF8C00","#B85C00")  # 橙色风格
        self.btn_closed_bend.clicked.connect(self.send_closed_loop_bend_command)
        l_bend.addWidget(self.spin_bend)
        l_bend.addWidget(self.btn_bend)
        l_bend.addWidget(self.btn_closed_bend)
        v_bend_box.addLayout(l_bend)
        v_bend_box.addWidget(self.create_status_lamp_row(self.lamp_bend))
        left_layout.addWidget(g_bend)

        g_shrink = self.create_group_box("3. 截面收缩控制")
        self.lamp_shrink = self.create_status_lamp()
        v_shrink_box = QVBoxLayout(g_shrink)
        l_shrink = QHBoxLayout()
        self.spin_scale = self._create_custom_spinbox(75, 100, 75, prefix="Scale: ", suffix='%')
        self.btn_shrink = AnimatedButton("⇲ 截面收缩","#00BCD4","#505050")
        self.btn_shrink.clicked.connect(self.send_scale_command)
        l_shrink.addWidget(self.spin_scale)
        l_shrink.addWidget(self.btn_shrink)
        v_shrink_box.addLayout(l_shrink)
        v_shrink_box.addWidget(self.create_status_lamp_row(self.lamp_shrink))
        left_layout.addWidget(g_shrink)

        g_addr = self.create_group_box("4. 电机控制")
        self.lamp_motor = self.create_status_lamp()
        v_addr_box = QVBoxLayout(g_addr)
        f_addr = QGridLayout()
        self.cb_motor_id = QComboBox()
        self.spin_m_pos = self._create_custom_spinbox(-80, 80, 0, prefix="位移：", suffix='mm')
        self.spin_m_vel = self._create_custom_spinbox(-20, 20, 10, prefix="速度: ", suffix=" mm/s")
        self.spin_m_acc = self._create_custom_spinbox(-10, 10, 10, prefix="加速度: ", suffix=" mm/s^2")
        self.btn_send_m =  AnimatedButton("发至电机","#00BCD4","#505050")
        self.btn_send_m.clicked.connect(self.send_motor)
        f_addr.addWidget(QLabel("电机ID:"), 0, 0)
        f_addr.addWidget(self.cb_motor_id, 0, 1)
        f_addr.addWidget(self.btn_send_m, 0, 2)
        self.motor_status_ball = QLabel("●")
        self.motor_status_ball.setStyleSheet("color: red; font-size: 13pt;")
        f_addr.addWidget(self.motor_status_ball, 0, 3)
        self.cb_motor_id.currentIndexChanged.connect(self.update_motor_status_ball)
        f_addr.addWidget(self.spin_m_pos, 1, 0)
        f_addr.addWidget(self.spin_m_vel, 1, 1)
        f_addr.addWidget(self.spin_m_acc, 1, 2)
        v_addr_box.addLayout(f_addr)
        v_addr_box.addWidget(self.create_status_lamp_row(self.lamp_motor))
        left_layout.addWidget(g_addr)

        g_master = self.create_group_box("5. 总控")
        self.lamp_master = self.create_status_lamp()
        v_master_box = QVBoxLayout(g_master)
        l_master = QHBoxLayout()
        self.btn_home = AnimatedButton("⌂ 一键归中","#1E1E1E","#505050")
        self.btn_home.clicked.connect(self.send_home_command)
        self.btn_motion_ctrl = AnimatedButton("⟳ 循环运动","#1E1E1E","#505050")
        self.btn_motion_ctrl.setCheckable(True)   # 切换式：启动/关闭循环运动
        self.btn_motion_ctrl.toggled.connect(self.send_motion_ctrl_command)
        l_master.addWidget(self.btn_home)
        l_master.addWidget(self.btn_motion_ctrl)
        v_master_box.addLayout(l_master)
        v_master_box.addWidget(self.create_status_lamp_row(self.lamp_master))
        left_layout.addWidget(g_master)

        left_layout.addStretch()


        # 右侧看板
        right_widget = QWidget()
        right_widget.setMinimumWidth(self.RIGHT_MIN_WIDTH)
        self.right_layout = QVBoxLayout(right_widget)
        self.tabs = QTabWidget()
        tab_all = QWidget()
        v_all = QVBoxLayout(tab_all)
        self.grid_m = QGridLayout()
        h_m_page = QHBoxLayout()
        self.btn_m_prev = AnimatedButton("◀ 上一页", "grey","#505050")
        self.btn_m_prev.clicked.connect(lambda: self.change_page('m', -1))
        self.btn_m_prev.setProperty("class", "page-btn")
        self.btn_m_next = AnimatedButton("下一页 ▶", "grey","#505050")
        self.btn_m_next.clicked.connect(lambda: self.change_page('m', 1))
        self.btn_m_next.setProperty("class", "page-btn")
        self.lbl_m_page = QLabel("电机 1/1 页")
        self.lbl_m_page.setProperty("class", "page-btn")
        self.lbl_m_page.setAlignment(Qt.AlignCenter)
        h_m_page.addWidget(self.btn_m_prev)
        h_m_page.addWidget(self.lbl_m_page)
        h_m_page.addWidget(self.btn_m_next)
        self.grid_s = QGridLayout()
        h_s_page = QHBoxLayout()
        self.btn_s_prev = AnimatedButton("◀ 上一页", "grey","#505050")
        self.btn_s_prev.clicked.connect(lambda: self.change_page('s', -1))
        self.btn_s_prev.setProperty("class", "page-btn")
        self.btn_s_next = AnimatedButton("下一页 ▶", "grey","#505050")
        self.btn_s_next.clicked.connect(lambda: self.change_page('s', 1))
        self.btn_s_next.setProperty("class", "page-btn")
        self.lbl_s_page = QLabel("IMU 1/1 页")
        self.lbl_s_page.setProperty("class", "page-btn")
        self.lbl_s_page.setAlignment(Qt.AlignCenter)
        h_s_page.addWidget(self.btn_s_prev)
        h_s_page.addWidget(self.lbl_s_page)
        h_s_page.addWidget(self.btn_s_next)
        v_all.addLayout(h_m_page)
        v_all.addLayout(self.grid_m)
        v_all.addStretch()
        v_all.addLayout(h_s_page)
        v_all.addLayout(self.grid_s)
        v_all.addStretch()
        self.tabs.addTab(tab_all, "👁 电机与IMU数据监控")

        tab_bend = QWidget()
        v_bend = QVBoxLayout(tab_bend)

        # --- 进度条卡片：偏转角度 / 截面面积缩放比 ---
        # 每张卡片内嵌一条透明背景的实时曲线（目标虚线 / 当前实线）
        self.angle_progress_frame, self.angle_progress, self.angle_progress_val, \
            self.angle_plot, self.angle_curve_target, self.angle_curve_current = \
            self.create_embedded_curve_card("偏转角度", "deg", "#D13438")
        v_bend.addWidget(self.angle_progress_frame)

        self.area_progress_frame, self.area_progress, self.area_progress_val, \
            self.area_plot, self.area_curve_target, self.area_curve_current = \
            self.create_embedded_curve_card("截面面积缩放比", "%", "#107C10")
        v_bend.addWidget(self.area_progress_frame)

        self.tabs.addTab(tab_bend, "🔧 LQTS喷管运动数据监控")

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
        for i in reversed(range(self.grid_m.count())):
            self.grid_m.itemAt(i).widget().setParent(None)
        for i in reversed(range(self.grid_s.count())):
            self.grid_s.itemAt(i).widget().setParent(None)
        self.cb_motor_id.clear()
        if self.num_m > 0:
            while len(self.motor_data) < self.num_m:
                self.motor_data.append([0.0, 0.0, 0.0])
                self.motor_target.append([0.0, 0.0, 0.0])
            while len(self.motor_states) < self.num_m:
                self.motor_states.append(0)
            self.motor_data = self.motor_data[:self.num_m]
            self.motor_states = self.motor_states[:self.num_m]
        else:
            self.motor_data = []
            self.motor_states = []
        if self.num_s > 0:
            while len(self.sensor_data) < self.num_s:
                self.sensor_data.append([0.0, 0.0, 0.0])
            self.sensor_data = self.sensor_data[:self.num_s]
        else:
            self.sensor_data = []
        self.cards_motor = []
        for i in range(self.num_m):
            card, lbls = self.create_motor_card(f"电机 ID:{i + 1}", "#000")
            self.cards_motor.append((card, lbls))
            self.grid_m.addWidget(card, 0, i % 3)
            self.cb_motor_id.addItem(f"电机 {i + 1}")
        self.cards_sensor = []
        for i in range(self.num_s):
            card, lbls = self.create_sensor_card(f"IMU ID:{i + 1}", "#D83B01")
            self.cards_sensor.append((card, lbls))
            self.grid_s.addWidget(card, 0, i % 3)
        self.refresh_pagination()
        self.update_ui()

    def change_page(self, t, delta):
        if t == 'm':
            self.m_page += delta
        else:
            self.s_page += delta
        self.refresh_pagination()

    def refresh_pagination(self):
        m_pages = max(1, math.ceil(self.num_m / 3))
        self.m_page = max(0, min(self.m_page, m_pages - 1))
        self.lbl_m_page.setText(f"电机 {self.m_page + 1}/{m_pages} 页")
        for i, (card, _) in enumerate(self.cards_motor):
            card.setVisible(self.m_page * 3 <= i < (self.m_page + 1) * 3)
        s_pages = max(1, math.ceil(self.num_s / 3))
        self.s_page = max(0, min(self.s_page, s_pages - 1))
        self.lbl_s_page.setText(f"IMU {self.s_page + 1}/{s_pages} 页")
        for i, (card, _) in enumerate(self.cards_sensor):
            card.setVisible(self.s_page * 3 <= i < (self.s_page + 1) * 3)

    # ------------------ 系统控制 ------------------

    def sys_close(self):
        self.is_started = False
        self._force_cycle_motion_off()     # 关闭循环运动状态
        self._force_closed_loop_off()      # 关闭闭环偏转状态
        self.send_cmd(0x00, "失能", "关闭LQTS喷管", is_motor=True)

    def sys_start(self):
        if self.is_started:
            return
        self.is_started = True

        self.send_cmd(0x01, "使能", "启动LQTS喷管", is_motor=True)

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

        # 紧急停止时强制关闭循环运动与闭环偏转
        self._force_cycle_motion_off()
        self._force_closed_loop_off()

        # 发送紧急停止命令
        self.send_cmd(0x02, "紧急停止", "LQTS紧急停止按钮", is_motor=True)

    def _force_closed_loop_off(self):
        """强制将闭环偏转按钮复位为关闭态（紧急停止/系统关闭时调用）"""
        self.closed_loop_enabled = False
        if hasattr(self, 'btn_closed_bend'):
            self.btn_closed_bend.setText("闭环角度偏转")
            self.btn_closed_bend.set_normal_color("#FF8C00")

    def _force_cycle_motion_off(self):
        """强制将循环运动按钮复位为关闭态（紧急停止/系统关闭时调用）"""
        if hasattr(self, 'btn_cycle_motion') or hasattr(self, 'btn_motion_ctrl'):
            btn = getattr(self, 'btn_cycle_motion', None) or self.btn_motion_ctrl
            if btn.isChecked():
                btn.blockSignals(True)
                btn.setChecked(False)
                btn.setText("⟳ 循环运动")
                btn.set_normal_color("#1E1E1E")
                btn.set_hover_color("#505050")
                btn.blockSignals(False)

    def get_error_disable_buttons(self):
        return [self.btn_stop, self.btn_home, self.btn_motion_ctrl, self.btn_m_next, self.btn_m_prev,
                self.btn_s_next, self.btn_s_prev, self.btn_send_m, self.btn_bend,
                self.btn_closed_bend, self.btn_shrink]

    def send_motor(self):
        # 检查是否有电机
        if self.num_m == 0:
            error_msg = "当前没有可用的电机设备，无法进行电机控制"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        m_id = self.cb_motor_id.currentIndex() + 1

        # 检查电机ID是否有效
        if m_id > self.num_m:
            error_msg = f"电机ID {m_id} 无效，当前只有 {self.num_m} 个电机"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        try:
            pos = int(self.spin_m_pos.spin.value() * 100)
            vel = int(self.spin_m_vel.spin.value() * 100)
            acc = int(self.spin_m_acc.spin.value() * 100)

            # 更新目标值（确保列表长度足够）
            while len(self.motor_target) < self.num_m:
                self.motor_target.append([0.0, 0.0, 0.0])

            if m_id <= len(self.motor_target):
                self.motor_target[m_id-1] = [self.spin_m_pos.spin.value(), self.spin_m_vel.spin.value(), self.spin_m_acc.spin.value()]

            self.update_ui()

            direction = 0 if pos >= 0 else 1
            distance = abs(pos)
            data = struct.pack('>BBHHH', m_id, direction, distance, vel, acc)
            self.send_cmd(0x03, f"控制电机{m_id}", f"位移:{pos/100}, 速度:{vel/100}, 加速度:{acc/100}", data, is_motor=True)

        except Exception as e:
            error_msg = f"发送电机控制命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def send_home_command(self):
        if not self.is_started:
            error_msg = "请先点击启动控制系统"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return
        if self.num_m == 0:
            error_msg = "当前没有可用的电机设备，无法归中"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        try:
            count = self.num_m
            start_addr = 1
            distances = [0] * count
            data = struct.pack('>BB', count, start_addr)
            for dist in distances:
                data += struct.pack('>H', dist)
            self.send_cmd(0x04, "一键归中", "所有电机距离复位为0", data, is_motor=True)
            # 喷管目标偏转角度置 0
            self.target_bend_angle = 0
        except Exception as e:
            error_msg = f"发送一键归中命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def _send_cycle_motion_frame(self, opened):
        """构建并发送循环运动帧：AA 05 01 00(启动) / AA 05 01 01(关闭) + 校验和"""
        frame = bytearray([0xAA, 0x05, 0x01, 0x00 if opened else 0x01])
        frame.append(sum(frame) & 0xFF)
        self.worker.send_data(bytes(frame))
        action = "循环运动启动" if opened else "循环运动关闭"
        detail = '启动循环运动' if opened else '关闭循环运动'
        GlobalHistory.add_record(self.port_name, action, detail, bytes(frame).hex().upper())
        self.logger(f"📤 {action} -> {detail}", raw_data=bytes(frame), port=self.port_name)

    def send_motion_ctrl_command(self, opened):
        """循环运动启动/关闭切换：true->AA 05 00(启动), false->AA 05 01(关闭)"""
        if not self.is_started:
            # 未启动系统时拒绝，并复位按钮状态
            btn = self.btn_motion_ctrl
            btn.blockSignals(True)
            btn.setChecked(False)
            btn.setText("⟳ 循环运动")
            btn.set_normal_color("#1E1E1E")
            btn.set_hover_color("#505050")
            btn.blockSignals(False)
            btn.style().unpolish(btn)
            btn.style().polish(btn)
            error_msg = "请先点击启动控制系统"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return
        if opened:
            self.btn_motion_ctrl.setText("⏹ 关闭循环运动")
            self.btn_motion_ctrl.set_normal_color("#D13438")
            self.btn_motion_ctrl.set_hover_color("#6B1418")
            self._send_cycle_motion_frame(True)
        else:
            self.btn_motion_ctrl.setText("⟳ 循环运动")
            self.btn_motion_ctrl.set_normal_color("#1E1E1E")
            self.btn_motion_ctrl.set_hover_color("#505050")
            self._send_cycle_motion_frame(False)
        self.btn_motion_ctrl.style().unpolish(self.btn_motion_ctrl)
        self.btn_motion_ctrl.style().polish(self.btn_motion_ctrl)

    def send_scale_command(self):
        if not self.is_started:
            error_msg = "请先点击启动控制系统"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        if self.num_m == 0:
            error_msg = "当前没有可用的电机设备,无法进行截面收缩"
            QMessageBox.warning(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)
            return

        try:
            self.target_area_change = int(self.spin_scale.spin.value())
            count = 1
            special_addr = 0xFD
            direction = 1
            data = struct.pack('>BBBH', count, special_addr, direction, self.target_area_change* 100)
            self.send_cmd(0x06, "截面收缩", f"收缩比例={self.target_area_change}%", data, is_motor=True)
        except Exception as e:
            error_msg = f"发送截面收缩命令失败: {str(e)}"
            QMessageBox.critical(self, "错误", error_msg)
            self.logger(f"❌ {error_msg}", level="ERROR", port=self.port_name)

    def send_bend_command(self, angle_deg=None):
        """发送开环角度偏转命令

        :param angle_deg: 目标角度（度），为 None 时取 spin_bend 输入框的值。
            下位机收到后自主执行闭环控制。
        """
        if not self.is_started:
            QMessageBox.warning(self, "错误", "请先点击启动控制系统")
            return
        if self.num_m == 0:
            QMessageBox.warning(self, "错误", "当前没有可用的电机设备，无法进行角度偏转")
            return

        target_angle = self.spin_bend.spin.value() if angle_deg is None else angle_deg

        # 更新界面显示的目标值
        self.target_bend_angle = target_angle

        direction = 0 if target_angle >= 0 else 1
        angle = abs(int(target_angle * 100))   # 转为整数（0.01度单位）

        count = 1
        special_addr = 0xFE
        data = struct.pack('>BBBH', count, special_addr, direction, angle)

        action = "喷管角度偏转"
        detail = f"方向:{'正' if direction == 0 else '负'}, 角度:{angle/100}度"
        self.send_cmd(0x06, action, detail, data, is_motor=True)

    def send_closed_loop_bend_command(self):
        """启动/手动停止闭环角度偏转控制

        启动仅下发一次指令，随后自动监测示数稳定（波动≤0.1°持续3s）即自动停止；
        手动点击按钮则立即停止，不等待稳定。
        """
        if not self.is_started:
            QMessageBox.warning(self, "错误", "请先点击启动控制系统")
            return
        if self.num_m == 0 or self.num_s == 0:
            QMessageBox.warning(self, "错误", "需要至少一个电机和一个 IMU 才能进行闭环角度偏转控制")
            return

        if not self.closed_loop_enabled:
            # 启动闭环控制：下发一次指令，随后自动监测稳定后自动停止
            self.closed_loop_target_angle = self.spin_bend.spin.value()
            self.closed_loop_enabled = True
            self._stop_stable_start = time.time()
            self._stop_stable_min = None
            self._stop_stable_max = None
            self.btn_closed_bend.setText("⏳ 监测稳定中...")
            self.btn_closed_bend.set_normal_color("#FF8C00")
            self.logger(f"🔄 启动闭环角度偏转控制，目标角度={self.closed_loop_target_angle}°，"
                        f"示数稳定后自动停止", port=self.port_name)
            self._send_closed_loop_once()   # 立即发送一次目标角度
        else:
            # 手动点击：立即停止，不等待稳定
            self._stop_closed_loop()

    def _stop_closed_loop(self):
        """停止闭环控制：发送停止指令并复位按钮状态"""
        # 发送停止闭环指令（flag=00，方向+角度传当前目标）
        self._send_closed_loop_frame(flag=0, angle_deg=self.closed_loop_target_angle)
        self.closed_loop_enabled = False
        self.btn_closed_bend.setText("闭环角度偏转")
        self.btn_closed_bend.set_normal_color("#FF8C00")
        self.logger("⏹ 停止闭环角度偏转控制", port=self.port_name)

    def _send_closed_loop_once(self):
        """发送一次闭环启动指令（flag=01，带目标角度）"""
        self._send_closed_loop_frame(flag=1, angle_deg=self.closed_loop_target_angle)

    def _send_closed_loop_frame(self, flag, angle_deg):
        """构建并发送闭环角度偏转指令帧

        帧格式: [AA] [06] [len] [01] [FC] [flag] [direction] [angle_hi] [angle_lo] [checksum]
        - 数据部分共 6 字节: count=01, special_addr=FC, flag(01启动/00停止), direction, angle(0.01°单位)
        """
        self.target_bend_angle = angle_deg
        direction = 0 if angle_deg >= 0 else 1
        angle = abs(int(angle_deg * 100))   # 0.01°单位
        data = struct.pack('>BBBBH', 1, 0xFC, flag, direction, angle)

        action = "闭环角度偏转"
        detail = f"{'启动' if flag else '停止'}, 目标角度:{angle_deg:.2f}°, 方向:{'正' if direction == 0 else '负'}"
        self.send_cmd(0x06, action, detail, data, is_motor=True)

    def closed_loop_control(self):
        """周期任务（200ms）：监测示数稳定（波动≤0.1°持续3s）即自动停止闭环"""
        if not self.closed_loop_enabled or not self.is_started:
            return
        if self.num_s == 0:
            return

        # 当前偏转角 = 第一个 IMU 的 pitch（sensor.x）
        current_angle = self.sensor_data[0][0] if self.sensor_data else 0.0

        # 监测示数波动，稳定持续 3s 后自动停止
        self._check_stop_stability(current_angle)

    def _check_stop_stability(self, current_angle):
        """停止稳定检测：示数波动 ≤0.1° 连续 3s 后发送停止指令"""
        now = time.time()
        # 更新稳定窗口内的最大/最小示数
        if self._stop_stable_min is None or current_angle < self._stop_stable_min:
            self._stop_stable_min = current_angle
        if self._stop_stable_max is None or current_angle > self._stop_stable_max:
            self._stop_stable_max = current_angle

        span = self._stop_stable_max - self._stop_stable_min
        if span > self.stop_stability_threshold:
            # 波动超过阈值，重置稳定计时
            self._stop_stable_start = now
            self._stop_stable_min = current_angle
            self._stop_stable_max = current_angle
            return

        # 波动在阈值内，检查是否已持续 3s
        if now - self._stop_stable_start >= self.stop_stability_duration:
            self.logger(f"✅ 示数稳定（波动 {span:.3f}° ≤ {self.stop_stability_threshold}°，"
                        f"持续 {self.stop_stability_duration:.0f}s），停止闭环控制",
                        port=self.port_name)
            self._stop_closed_loop()

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
            if self.num_s > 0:
                # 假设第一个 IMU 的 pitch 角度代表当前偏转角度
                self.current_bend_angle = self.sensor_data[0][0]
            else:
                self.current_bend_angle = 0.0
            # 一阶低通滤波
            self.filtered_bend_angle = (
                self.angle_filter_alpha * self.current_bend_angle
                + (1 - self.angle_filter_alpha) * self.filtered_bend_angle
            )
            self.current_bend_angle = self.filtered_bend_angle
            # 当前面积缩放比
            self.current_area_change = (
                (1 - self.motor_data[0][0] / (2 * 3.1415926 * 50))
                * (1 - self.motor_data[0][0] / (2 * 3.1415926 * 50))
                * 100
            )

            # 4. 驱动控制分组三态提示灯（用变化的当前值判定运行状态）
            self.lamp_bend.feed_value(self.filtered_bend_angle)
            self.lamp_shrink.feed_value(self.current_area_change)
            motor_pos = self.motor_data[0][0] if self.motor_data else 0.0
            self.lamp_motor.feed_value(motor_pos)
            self.lamp_master.feed_value(motor_pos)

            # 5. 刷新界面
            self.update_ui()

    def update_ui(self):
        if len(self.cards_motor) != self.num_m or len(self.cards_sensor) != self.num_s:
            return
        for i in range(self.m_page * 3, min((self.m_page + 1) * 3, self.num_m)):
            labels = self.cards_motor[i][1]
            cur_pos_val, cur_vel_val, cur_acc_val = self.motor_data[i]
            target_pos, target_vel, target_acc = self.motor_target[i] if i < len(self.motor_target) else (0.0, 0.0, 0.0)
            state_val = self.motor_states[i]
            labels[0].setText(f"当前: {cur_pos_val:.2f}")
            labels[1].setText(f"目标: {target_pos:.2f}")
            labels[2].setText(f"当前: {cur_vel_val:.2f}")
            labels[3].setText(f"目标: {target_vel:.2f}")
            labels[4].setText(f"当前: {cur_acc_val:.2f}")
            labels[5].setText(f"目标: {target_acc:.2f}")
            lbl_state = labels[6]
            if state_val == 0:
                lbl_state.setStyleSheet("color: #D13438; font-size:13pt; border: none;")
            else:
                lbl_state.setStyleSheet("color: #107C10; font-size:13pt; border: none;")
        for i in range(self.s_page * 3, min((self.s_page + 1) * 3, self.num_s)):
            self.cards_sensor[i][1][0].setText(f"{self.sensor_data[i][0]:.2f}")
            self.cards_sensor[i][1][1].setText(f"{self.sensor_data[i][1]:.2f}")
            self.cards_sensor[i][1][2].setText(f"{self.sensor_data[i][2]:.2f}")

        if hasattr(self, 'motor_status_ball') and hasattr(self, 'motor_states'):
            idx = self.cb_motor_id.currentIndex()
            if idx >= 0 and idx < len(self.motor_states):
                state_val = self.motor_states[idx]
                if state_val == 0:
                    self.motor_status_ball.setStyleSheet("color: #D13438; font-size: 13pt;")
                else:
                    self.motor_status_ball.setStyleSheet("color: #107C10; font-size: 13pt;")
        if hasattr(self, 'angle_progress'):
            self.set_progress_value(self.angle_progress, self.angle_progress_val,
                                    self.current_bend_angle, self.target_bend_angle)
        if hasattr(self, 'area_progress'):
            self.set_progress_value(self.area_progress, self.area_progress_val,
                                    self.current_area_change, self.target_area_change)

    def update_motor_status_ball(self, idx=None):
        if idx is None:
            idx = self.cb_motor_id.currentIndex()
        if hasattr(self, 'motor_status_ball') and hasattr(self, 'motor_states'):
            if idx >= 0 and idx < len(self.motor_states):
                state_val = self.motor_states[idx]
                if state_val == 0:
                    self.motor_status_ball.setStyleSheet("color: #D13438; font-size: 13pt;")
                else:
                    self.motor_status_ball.setStyleSheet("color: #107C10; font-size: 13pt;")

    def record_history(self):
        if self.serial_error:
            return
        # 初始化起始时间（第一次调用时）
        if self.start_time is None:
            self.start_time = time.time()

        # 计算相对时间（秒，从 0 开始）
        current_time_sec = time.time() - self.start_time

        # 角度偏转 / 截面面积缩放比
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

        # 更新内嵌实时曲线（降频刷新，避免 10ms 重绘导致主线程卡死）
        self._update_embedded_curves(current_time_sec)

        # 更新曲线窗口（如果已打开）
        if self.bend_graph_window and self.bend_graph_window.isVisible():
            self.bend_graph_controller.window.update_data(
                self.hist_bend_time, self.hist_bend_target, self.hist_bend_current
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
                elif self.active_type == 'sensor' and self.hist_sensors and len(self.hist_sensors) > 0:
                    valid_sensor_data = [data for data in self.hist_sensors if data and len(data) > 0]
                    valid_times = self.hist_time[-len(valid_sensor_data):] if valid_sensor_data else []
                    self.active_graph_controller.update_multi_data(valid_times, valid_sensor_data)

    def _update_embedded_curves(self, current_time_sec):
        """刷新喷管运动数据监控页两张卡片内嵌的实时曲线（目标虚线 / 当前实线），节流 0.1s"""
        if current_time_sec - self._last_embedded_update < self.embedded_update_interval:
            return
        self._last_embedded_update = current_time_sec
        # 只绘制最近 20 秒
        window_start = current_time_sec - 20
        start_idx = 0
        while start_idx < len(self.hist_bend_time) and self.hist_bend_time[start_idx] < window_start:
            start_idx += 1
        ts = self.hist_bend_time[start_idx:]
        if not ts:
            return
        if hasattr(self, 'angle_curve_target'):
            self.angle_curve_target.setData(ts, self.hist_bend_target[start_idx:])
            self.angle_curve_current.setData(ts, self.hist_bend_current[start_idx:])
            Nozzle.clamp_min_y_span(self.angle_plot, 140.0)  # 偏转满行程 ±70
            self.angle_plot.setXRange(max(0, ts[-1] - 20), ts[-1], padding=0)
        if hasattr(self, 'area_curve_target'):
            self.area_curve_target.setData(ts, self.hist_area_target[start_idx:])
            self.area_curve_current.setData(ts, self.hist_area_current[start_idx:])
            Nozzle.clamp_min_y_span(self.area_plot, 100.0)   # 面积 0~100
            self.area_plot.setXRange(max(0, ts[-1] - 20), ts[-1], padding=0)


# 延迟导入曲线窗口/控制器类，避免循环导入
from UI.graph_window_lqts import BendGraphWindow as _LqtsBendGraphWindow
from Core.GraphController_lqts import BendGraphController as _LqtsBendGraphController
LqtsDeviceTab.BEND_GRAPH_WINDOW_CLASS = _LqtsBendGraphWindow
LqtsDeviceTab.BEND_GRAPH_CONTROLLER_CLASS = _LqtsBendGraphController
