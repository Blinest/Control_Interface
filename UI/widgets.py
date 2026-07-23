# ui/widgets.py
from PyQt5.QtWidgets import (QPushButton, QGraphicsDropShadowEffect,
                             QWidget, QSizePolicy)
from PyQt5.QtCore import Qt, QPointF
from PyQt5.QtGui import QColor, QPainter, QPen, QRadialGradient, QFont
import math
from .styles import BG_BTN, BORDER_GROUP, BORDER_HOVER, TEXT_SECONDARY, TEXT_LIGHT

class AnimatedButton(QPushButton):
    def __init__(self, text, normal_color, hover_color):
        super().__init__(text)
        self.normal_color = normal_color
        self.hover_color = hover_color
        self.update_style(self.normal_color)   # 初始样式
        self._init_shadow()

    def update_style(self, color):
        """更新按钮的背景色，保留其他样式"""
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {color};
                border-radius: 6px;
                padding: 8px 16px;
                margin: 0px 0px 0px 0px;
                font-weight: bold;
                color: white;
                border: none;
            }}
        """)

    def _init_shadow(self):
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(10)
        shadow.setOffset(0, 0)
        shadow.setColor(Qt.gray)
        self.setGraphicsEffect(shadow)

    def _get_shadow(self):
        effect = self.graphicsEffect()
        if effect is None or not isinstance(effect, QGraphicsDropShadowEffect):
            self._init_shadow()
            effect = self.graphicsEffect()
        return effect

    def enterEvent(self, event):
        # 改变背景色为 hover_color
        self.update_style(self.hover_color)
        # 阴影浮起效果
        shadow = self._get_shadow()
        shadow.setOffset(0, 3)        # 向下偏移3像素（原代码中写的是10,10，建议改为(0,3)更自然）
        shadow.setBlurRadius(15)
        super().enterEvent(event)

    def leaveEvent(self, event):
        # 恢复背景色为 normal_color
        self.update_style(self.normal_color)
        # 阴影恢复
        shadow = self._get_shadow()
        shadow.setOffset(0, 0)
        shadow.setBlurRadius(10)
        super().leaveEvent(event)
    def set_normal_color(self, color):
        self.normal_color = color
        if not self.underMouse():  # 如果鼠标不在按钮上，立即更新
            self.update_style(color)

    def set_hover_color(self, color):
        self.hover_color = color
        if self.underMouse():
            self.update_style(color)


class SensorDiskWidget(QWidget):
    """周向分布圆盘：中心圆盘 + N 个周向小圆圈，代表传感器阈值状态。
    绿色 = 低于阈值（安全），红色 = 达到或超过阈值（报警）。
    """

    def __init__(self, num_sensors=6, parent=None):
        super().__init__(parent)
        self.num_sensors = num_sensors
        self.sensor_values = [0.0] * num_sensors
        self.thresholds = [10.0] * num_sensors
        self.sensor_labels = [f"S{i+1}" for i in range(num_sensors)]
        self.setMinimumSize(300, 300)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

    # ---- 外部接口 ----

    def set_num_sensors(self, n):
        """传感器数量变化时调用"""
        self.num_sensors = n
        self.sensor_values = [0.0] * n
        self.thresholds = [10.0] * n
        self.sensor_labels = [f"S{i+1}" for i in range(n)]
        self.update()

    def set_threshold(self, index, value):
        """设置单个传感器的阈值"""
        if 0 <= index < len(self.thresholds):
            self.thresholds[index] = value
            self.update()

    def set_global_threshold(self, value):
        """统一设置所有传感器阈值"""
        self.thresholds = [value] * self.num_sensors
        self.update()

    def update_sensor_values(self, values):
        """更新传感器读数并重绘"""
        for i, v in enumerate(values):
            if i < len(self.sensor_values):
                self.sensor_values[i] = v
        self.update()

    # ---- 颜色计算 ----

    @staticmethod
    def _threshold_color(ratio):
        """根据 ratio (0~1+) 返回渐变色。
        0.0  → 亮绿 (#4CAF50)
        0.5  → 黄色 (#FFC107)
        0.8  → 橙色 (#FF9800)
        1.0  → 红色 (#D13438)
        >1.0 → 深红 (#B71C1C)
        """
        # 关键色标
        stops = [
            (0.0,  (76, 175, 80)),    # 绿
            (0.5,  (255, 193, 7)),    # 黄
            (0.8,  (255, 152, 0)),    # 橙
            (1.0,  (209, 52, 56)),    # 红
            (1.5,  (183, 28, 28)),    # 深红
        ]
        ratio = max(0.0, min(ratio, 1.5))
        # 找到 ratio 所在区间
        for j in range(len(stops) - 1):
            r0, c0 = stops[j]
            r1, c1 = stops[j + 1]
            if ratio <= r1:
                t = (ratio - r0) / (r1 - r0) if r1 != r0 else 0
                r = int(c0[0] + t * (c1[0] - c0[0]))
                g = int(c0[1] + t * (c1[1] - c0[1]))
                b = int(c0[2] + t * (c1[2] - c0[2]))
                return QColor(r, g, b)
        return QColor(*stops[-1][1])

    # ---- 绘制 ----

    def paintEvent(self, event):
        if self.num_sensors == 0:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        w, h = self.width(), self.height()
        cx, cy = w / 2.0, h / 2.0
        max_r = min(w, h) / 2.0 - 40          # 边距
        outer_r = max_r * 0.65                  # 中心到小圆圆心距离
        small_r = max_r * 0.18                  # 小圆半径
        big_r = max_r * 0.35                    # 中心圆盘半径

        # —— 中心圆盘 ——
        c_grad = QRadialGradient(cx, cy, big_r)
        c_grad.setColorAt(0, QColor(BG_BTN))
        c_grad.setColorAt(1, QColor(BORDER_GROUP))
        painter.setBrush(c_grad)
        painter.setPen(QPen(QColor(BORDER_HOVER), 2))
        painter.drawEllipse(QPointF(cx, cy), big_r, big_r)

        # 中心文字
        painter.setPen(QColor(TEXT_SECONDARY))
        c_font = QFont("Segoe UI", 10)
        c_font.setBold(True)
        painter.setFont(c_font)
        painter.drawText(
            int(cx - big_r), int(cy - big_r),
            int(big_r * 2), int(big_r * 2),
            Qt.AlignCenter, "传感器\n状态"
        )

        # —— 连接线（中心 → 小圆）——
        painter.setPen(QPen(QColor(BORDER_GROUP), 1, Qt.DashLine))
        for i in range(self.num_sensors):
            angle_rad = math.radians(90 - i * (360.0 / self.num_sensors))
            sx = cx + outer_r * math.cos(angle_rad)
            sy = cy - outer_r * math.sin(angle_rad)
            painter.drawLine(QPointF(cx, cy), QPointF(sx, sy))

        # —— 周向小圆 ——
        for i in range(self.num_sensors):
            angle_rad = math.radians(90 - i * (360.0 / self.num_sensors))
            sx = cx + outer_r * math.cos(angle_rad)
            sy = cy - outer_r * math.sin(angle_rad)

            val = self.sensor_values[i] if i < len(self.sensor_values) else 0.0
            thr = self.thresholds[i] if i < len(self.thresholds) else 10.0

            # 根据比值做渐变：0% 时亮绿，100% 时深红，中间经过黄/橙过渡
            if thr > 0:
                ratio = min(val / thr, 1.5)  # 最多算到 150%
            else:
                ratio = 1.0 if val > 0 else 0.0

            fill = self._threshold_color(ratio)
            border = fill.darker(140)

            # 渐变填充
            grad = QRadialGradient(sx, sy, small_r)
            grad.setColorAt(0, fill.lighter(140))
            grad.setColorAt(1, fill)
            painter.setBrush(grad)
            painter.setPen(QPen(border, 2))
            painter.drawEllipse(QPointF(sx, sy), small_r, small_r)

            # 标签 + 数值
            painter.setPen(QColor(TEXT_LIGHT))
            l_font = QFont("Segoe UI", 8)
            l_font.setBold(True)
            painter.setFont(l_font)
            lbl = self.sensor_labels[i] if i < len(self.sensor_labels) else f"S{i+1}"
            painter.drawText(
                int(sx - small_r), int(sy - small_r),
                int(small_r * 2), int(small_r * 2),
                Qt.AlignCenter, f"{lbl}\n{val:.1f}"
            )

        painter.end()
