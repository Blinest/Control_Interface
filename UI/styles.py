# UI/styles.py
# ============================================================
# 样式中心 — 所有颜色常量、全局 QSS、样式工具函数
# ============================================================

# ===================== 颜色常量 =====================

# 基础色
BG_PRIMARY      = "#fbf7f0"    # 主背景
BG_CARD         = "#fdfaf5"    # 卡片/输入框背景
BG_BTN          = "#f0e9de"    # 通用按钮背景
BG_HOVER        = "#e8dfd0"    # 通用按钮悬停
BG_PRESSED      = "#d9cfbd"    # 通用按钮按下
BG_TOOLBAR      = "#ede4d3"    # 状态栏背景
BORDER_DEFAULT  = "#c4b49a"    # 默认边框
BORDER_HOVER    = "#b5956b"    # 悬停边框
BORDER_PRESSED  = "#8b6f4c"    # 按下边框
BORDER_GROUP    = "#d9cfbd"    # 分组框边框
TEXT_PRIMARY    = "#2e241b"    # 主文本
TEXT_SECONDARY  = "#5a4636"    # 次要文本
TEXT_LIGHT      = "#fff8f0"    # 浅色文本（按钮上）
TEXT_ON_DARK    = "#c6a77d"    # 深色背景上的文本
ACCENT          = "#b5956b"    # 强调色
ACCENT_HOVER    = "#c6a77d"    # 强调色悬停
ACCENT_PRESSED  = "#9a7b54"    # 强调色按下

# 功能色
COLOR_SUCCESS      = "#107C10"    # 绿：启动/正常
COLOR_SUCCESS_DARK = "#063A06"
COLOR_DANGER       = "#D13438"    # 红：停止/报警
COLOR_DANGER_DARK  = "#A80000"
COLOR_WARNING      = "#FF8C00"    # 橙：循环检测
COLOR_WARNING_DARK = "#B85C00"
COLOR_INFO         = "#00BCD4"    # 青：发送/弯曲
COLOR_DARK         = "#1E1E1E"    # 深色按钮
COLOR_GREY         = "#505050"    # 灰色悬停

# 图表曲线色
CURVE_COLORS = [
    '#b5956b', '#c46b5b', '#7a8b5e', '#4a6b8a',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
]

# 登录界面色
LOGIN_BG        = "#d9d9d6"
LOGIN_CENTER    = "#d7d2cb"
LOGIN_INPUT_BG  = "#ffffff"

# 图表窗口色
GRAPH_DIALOG_BG   = "#fdfaf5"    # 绘图窗口/对话框背景
GRAPH_FIGURE_BG   = "#fbf7f0"    # matplotlib 画布背景 / 文件列表背景
GRAPH_AXES_COLOR  = "#5a4636"    # 坐标轴文字/标题色
GRAPH_SPINE_COLOR = "#c4b49a"    # 坐标轴边框色
GRAPH_STATUS_CLR  = "#997b5e"    # 文件对话框状态标签色


# ===================== 全局 QSS =====================

GLOBAL_QSS = """
    /* ========== 全局 ========== */
    QMainWindow, QWidget {
        background-color: %(BG_PRIMARY)s;
        color: %(TEXT_PRIMARY)s;
        font-family: 'Segoe UI', '微软雅黑';
    }

    /* ========== 通用按钮 ========== */
    QPushButton {
        background-color: %(BG_BTN)s;
        color: %(TEXT_PRIMARY)s;
        border: 1px solid %(BORDER_DEFAULT)s;
        border-radius: 3px;
        padding: 3px 3px;
        font-weight: normal;
    }
    QPushButton:hover {
        background-color: %(BG_HOVER)s;
        border-color: %(BORDER_HOVER)s;
    }
    QPushButton:pressed {
        background-color: %(BG_PRESSED)s;
        border-color: %(BORDER_PRESSED)s;
        color: #1a120a;
    }

    /* 主要操作按钮 (class="primary") */
    QPushButton[class="primary"] {
        background-color: %(ACCENT)s;
        color: %(TEXT_LIGHT)s;
        border: none;
        font-weight: bold;
        border-radius: 25px;
    }
    QPushButton[class="primary"]:hover {
        background-color: %(ACCENT_HOVER)s;
    }
    QPushButton[class="primary"]:pressed {
        background-color: %(ACCENT_PRESSED)s;
    }

    /* 危险/删除按钮 (class="danger") */
    QPushButton[class="danger"] {
        background-color: #c46b5b;
        color: %(TEXT_LIGHT)s;
        border: none;
        font-weight: bold;
        border-radius: 15px;
        padding: 4px 12px;
        font-size: 10pt;
    }
    QPushButton[class="danger"]:hover {
        background-color: #d48476;
    }
    QPushButton[class="danger"]:pressed {
        background-color: #a05247;
    }

    /* 成功按钮 (class="success") */
    QPushButton[class="success"] {
        background-color: #7a8b5e;
        color: %(TEXT_LIGHT)s;
        border: none;
        font-weight: bold;
        border-radius: 15px;
        font-size: 10pt;
    }
    QPushButton[class="success"]:hover {
        background-color: #95a675;
    }
    QPushButton[class="success"]:pressed {
        background-color: #627149;
    }

    /* 紧急停止按钮 (class="emergency") */
    QPushButton[class="emergency"] {
        background-color: #c46b5b;
        color: %(TEXT_LIGHT)s;
        font-weight: bold;
        font-size: 10pt;
        border-radius: 15px;
        border: none;
    }
    QPushButton[class="emergency"]:hover {
        background-color: #d48476;
    }
    QPushButton[class="emergency"]:pressed {
        background-color: #a05247;
    }

    /* 页面导航按钮 (class="page-btn") */
    QPushButton[class="page-btn"] {
        background-color: %(BG_PRESSED)s;
        color: %(TEXT_PRIMARY)s;
        font-weight: bold;
        border: 1px solid %(BORDER_HOVER)s;
        border-radius: 6px;
        padding: 5px 10px;
    }
    QPushButton[class="page-btn"]:hover {
        background-color: %(BG_HOVER)s;
        border-color: %(ACCENT_HOVER)s;
    }
    QPushButton[class="page-btn"]:pressed {
        background-color: %(BORDER_DEFAULT)s;
    }

    /* ========== 分组框 ========== */
    QGroupBox {
        background-color: %(BG_CARD)s;
        border: 1px solid %(BORDER_GROUP)s;
        border-radius: 8px;
        margin-top: 15px;
        padding: 5px;
        font-weight: bold;
        color: %(TEXT_SECONDARY)s;
    }
    QGroupBox::title {
        subcontrol-origin: margin;
        left: 10px;
        padding: 0 5px 0 5px;
        color: %(ACCENT)s;
    }

    /* ========== 下拉框 ========== */
    QComboBox {
        background-color: %(BG_CARD)s;
        color: %(TEXT_PRIMARY)s;
        border: 1px solid %(BORDER_DEFAULT)s;
        border-radius: 3px;
        padding: 3px 3px;
    }
    QComboBox:hover {
        border-color: %(BORDER_HOVER)s;
    }
    QComboBox::drop-down {
        subcontrol-origin: padding;
        subcontrol-position: top right;
        width: 20px;
        border-left: 1px solid %(BORDER_DEFAULT)s;
        border-top-right-radius: 6px;
        border-bottom-right-radius: 6px;
    }
    QComboBox QAbstractItemView {
        background-color: %(BG_PRIMARY)s;
        color: %(TEXT_PRIMARY)s;
        selection-background-color: %(ACCENT)s;
        selection-color: %(TEXT_LIGHT)s;
        border-radius: 6px;
        outline: none;
    }

    /* ========== 编辑框 & 文本区域 ========== */
    QLineEdit, QTextEdit {
        background-color: %(BG_CARD)s;
        color: %(TEXT_PRIMARY)s;
        border: 1px solid %(BORDER_DEFAULT)s;
        border-radius: 6px;
        padding: 4px;
        selection-background-color: %(ACCENT)s;
        selection-color: %(TEXT_LIGHT)s;
    }
    QLineEdit:focus, QTextEdit:focus {
        border-color: %(BORDER_HOVER)s;
    }

    /* 日志专用样式 */
    QTextEdit#logMain {
        background-color: %(BG_CARD)s;
        border: 1px solid %(BORDER_GROUP)s;
    }
    QTextEdit#logRaw {
        background-color: %(TEXT_PRIMARY)s;
        color: %(TEXT_ON_DARK)s;
        font-family: 'Consolas', 'Courier New';
        border: 1px solid #8b6f4c;
    }

    /* ========== 状态栏 ========== */
    QStatusBar {
        background-color: %(BG_TOOLBAR)s;
        color: %(TEXT_SECONDARY)s;
        font-weight: bold;
        border-top: 1px solid %(BORDER_GROUP)s;
    }
    QStatusBar::item {
        border: none;
    }

    /* ========== 标签页 ========== */
    QTabWidget::pane {
        border: 1px solid %(BORDER_GROUP)s;
        background-color: %(BG_PRIMARY)s;
        border-radius: 6px;
    }
    QTabBar::tab {
        background-color: %(BG_BTN)s;
        color: %(TEXT_SECONDARY)s;
        border: 1px solid %(BORDER_GROUP)s;
        border-bottom: none;
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
        padding: 6px 12px;
        margin-right: 2px;
    }
    QTabBar::tab:selected {
        background-color: %(BG_CARD)s;
        color: %(ACCENT)s;
        font-weight: bold;
    }
    QTabBar::tab:hover:!selected {
        background-color: %(BG_HOVER)s;
    }

    /* ========== 工具栏 ========== */
    QToolBar {
        background-color: %(BG_PRIMARY)s;
        border-bottom: 1px solid %(BORDER_GROUP)s;
        spacing: 6px;
        padding: 4px;
    }
    QToolBar QLabel {
        color: %(TEXT_SECONDARY)s;
        font-weight: normal;
    }

    /* ========== 滚动条 ========== */
    QScrollBar:vertical {
        background: %(BG_PRIMARY)s;
        width: 10px;
        margin: 0;
        border-radius: 5px;
    }
    QScrollBar::handle:vertical {
        background: %(BORDER_DEFAULT)s;
        min-height: 20px;
        border-radius: 5px;
    }
    QScrollBar::handle:vertical:hover {
        background: %(BORDER_HOVER)s;
    }
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
        height: 0px;
    }

    /* ========== 提示框 ========== */
    QMessageBox {
        background-color: %(BG_PRIMARY)s;
        color: %(TEXT_PRIMARY)s;
        border: 1px solid %(BORDER_GROUP)s;
        border-radius: 12px;
    }
    QMessageBox QLabel {
        color: %(TEXT_PRIMARY)s;
    }
    QMessageBox QPushButton {
        min-width: 80px;
        min-height: 30px;
    }
""" % {
    'BG_PRIMARY': BG_PRIMARY,
    'BG_CARD': BG_CARD,
    'BG_BTN': BG_BTN,
    'BG_HOVER': BG_HOVER,
    'BG_PRESSED': BG_PRESSED,
    'BG_TOOLBAR': BG_TOOLBAR,
    'BORDER_DEFAULT': BORDER_DEFAULT,
    'BORDER_HOVER': BORDER_HOVER,
    'BORDER_PRESSED': BORDER_PRESSED,
    'BORDER_GROUP': BORDER_GROUP,
    'TEXT_PRIMARY': TEXT_PRIMARY,
    'TEXT_SECONDARY': TEXT_SECONDARY,
    'TEXT_LIGHT': TEXT_LIGHT,
    'TEXT_ON_DARK': TEXT_ON_DARK,
    'ACCENT': ACCENT,
    'ACCENT_HOVER': ACCENT_HOVER,
    'ACCENT_PRESSED': ACCENT_PRESSED,
}


# ===================== 样式工具函数 =====================

def style_spinbox():
    """统一的 QDoubleSpinBox 样式"""
    return f"""
        QDoubleSpinBox {{
            min-height: 34px; font-size: 10pt; font-weight: bold;
            border: 2px solid #b0b0b0; border-radius: 10px;
            background: {BG_CARD}; padding-right: 5px;
        }}
        QDoubleSpinBox:focus {{ border-color: #0078D7; }}
    """


def style_card_frame():
    """卡片 QFrame 样式"""
    return (
        f"QFrame {{ background: {BG_CARD}; border: 1px solid {BORDER_DEFAULT}; "
        f"border-radius: 6px; }}"
    )


def style_status_ball(on):
    """状态球样式：on=True 绿色，on=False 红色"""
    color = COLOR_SUCCESS if on else COLOR_DANGER
    return f"color: {color}; font-size: 8pt;"


def style_status_ball_off():
    return f"color: {COLOR_DANGER}; font-size: 8pt;"


def style_status_ball_on():
    return f"color: {COLOR_SUCCESS}; font-size: 10pt;"


def style_scroll_area():
    """滚动区域的滚动条样式"""
    return f"""
        QScrollBar:vertical {{
            background: {BG_PRIMARY}; width: 10px; margin: 0; border-radius: 5px;
        }}
        QScrollBar::handle:vertical {{
            background: {BORDER_DEFAULT}; min-height: 20px; border-radius: 5px;
        }}
        QScrollBar::handle:vertical:hover {{ background: {BORDER_HOVER}; }}
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0px; }}
        QScrollBar:horizontal {{
            background: {BG_PRIMARY}; height: 10px; margin: 0; border-radius: 5px;
        }}
        QScrollBar::handle:horizontal {{
            background: {BORDER_DEFAULT}; min-width: 20px; border-radius: 5px;
        }}
        QScrollBar::handle:horizontal:hover {{ background: {BORDER_HOVER}; }}
        QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{ width: 0px; }}
    """


def style_line():
    """分隔线样式"""
    return f"background: {BORDER_GROUP}; max-height: 1px;"


def style_value_label(color):
    """数值标签样式"""
    return f"color: {color}; font-size: 8pt; border: none;"


def style_title_label(font_size="10pt"):
    """标题标签样式"""
    return f"color: {TEXT_SECONDARY}; font-weight:bold; border:none; font-size:{font_size};"


def style_checkbox_color(color):
    """带颜色的 QCheckBox 样式"""
    return f"color: {color}; font-weight: bold;"


def style_graph_coord_label():
    """图表坐标显示标签样式"""
    return (
        f"background-color: {BG_BTN}; border: 1px solid {BORDER_DEFAULT}; "
        f"padding: 2px 8px; font-family: Consolas; color: {TEXT_SECONDARY};"
    )


def style_login_btn(bg_color, hover_color):
    """登录界面按钮样式"""
    return f"""
        QPushButton {{
            background-color: {bg_color}; color: {LOGIN_BG};
            border: none; padding: 10px; border-radius: 6px;
            font-size: 12pt; font-weight: bold;
        }}
        QPushButton:hover {{ background-color: {hover_color}; }}
    """


def style_login_input():
    """登录界面输入框样式"""
    return f"padding: 10px; border: 3px solid {COLOR_DARK};"


def style_login_center():
    """登录界面中央面板样式"""
    return (
        f"background-color: {LOGIN_CENTER}; border-radius: 12px; "
        f"border: 3px solid {COLOR_DARK};"
    )


def style_debug_btn():
    """Debug 工具栏按钮样式"""
    return f"""
        QPushButton {{
            background-color: #c46b5b; color: {TEXT_LIGHT};
            font-weight: bold; border-radius: 15px;
            padding: 4px 12px; font-size: 10pt;
        }}
        QPushButton:checked {{
            background-color: {COLOR_DANGER}; border: 2px solid #fff;
        }}
        QPushButton:hover {{ background-color: #d48476; }}
    """
