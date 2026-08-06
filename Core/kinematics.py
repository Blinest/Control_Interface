# ==========================================
# 运动学模型（LYZ 喷管）
# ==========================================
# 参考: D:\7_code\python\plot\LYZS喷管相关\运动学建模lyzs.py
# 几何参数来源: 几何模型.csv
#
# 模型为正解模型: 驱动滑块位移 Sc1 (mm) -> 出口截面面积 S (mm²)。
# 本模块在其基础上提供逆解: 界面输入的截面面积变化百分比 × 最大截面面积
# = 目标面积 -> 解算得到的驱动位移 Sc1, 作为指令的输出值发送。
#
# 仅依赖标准库 math, 不引入 scipy（原参考脚本用 scipy.optimize.brentq,
# 此处用等价的二分法替代, 因目标函数在运行区间内单调）。

import math

# ========== 几何模型参数（来自 几何模型.csv，单位: mm 和 度） ==========
GEOMETRY = {
    'z1': 113.45, 'x1': 133.67,
    'z2': 86.00, 'x2': 32.53,
    'S2': 59.70,
    'theta1_deg': 74.74, 'theta2_deg': 99.62,
    'theta3_deg': 76.37, 'theta5_deg': 45.82,
    'l1': 78.63, 'l2': 230.14, 'l3': 44.15,
    'l4': 84.66, 'l5': 156.38, 'd': 132.21,
}

z1 = GEOMETRY['z1']
x1 = GEOMETRY['x1']
z2 = GEOMETRY['z2']
x2 = GEOMETRY['x2']
S2 = GEOMETRY['S2']
theta1 = math.radians(GEOMETRY['theta1_deg'])
theta2 = math.radians(GEOMETRY['theta2_deg'])
theta3 = math.radians(GEOMETRY['theta3_deg'])
theta5 = math.radians(GEOMETRY['theta5_deg'])
l1 = GEOMETRY['l1']
l2 = GEOMETRY['l2']
l3 = GEOMETRY['l3']
l4 = GEOMETRY['l4']
l5 = GEOMETRY['l5']
d = GEOMETRY['d']

# ========== 驱动位移范围（mm） ==========
SC1_MIN = 130.0
SC1_MAX = 200.0

# 约束方程求根区间（与原参考脚本 brentq 的括号一致）
_SC2_BRACKET = (0.1, 200.0)
# 逆解查表精度: 将 Sc1 离散为 _SC1_TABLE_POINTS 个点
_SC1_TABLE_POINTS = 2001


def _clip(x, lo=-1.0, hi=1.0):
    """clamp 到 [lo, hi]，用于 arccos 定义域保护"""
    return lo if x < lo else (hi if x > hi else x)


# ========== 正解运动学（与参考脚本公式一致） ==========
def lc_from_sc2(sc2):
    """lc = √(l3² + (S2-Sc2)² - 2·l3·(S2-Sc2)·cosθ2)"""
    diff = S2 - sc2
    return math.sqrt(l3 ** 2 + diff ** 2 - 2 * l3 * diff * math.cos(theta2))


def constraint(sc2, sc1):
    """约束方程 f(Sc2) = 左式 - 右式，应等于 0"""
    lc = lc_from_sc2(sc2)
    if lc <= 0:
        return float('inf')

    # term1: arccos((z1²+x1²+l1²-Sc1²) / (2·√(z1²+x1²)·l1))
    r1_sq = z1 ** 2 + x1 ** 2
    r1 = math.sqrt(r1_sq)
    arg1 = _clip((r1_sq + l1 ** 2 - sc1 ** 2) / (2 * r1 * l1))
    term1 = math.acos(arg1)

    # term2: arccos((l3²+S2²-2cθ2·l3·S2+lc²-Sc2²) / (2·√(l3²+S2²-2cθ2·l3·S2)·lc))
    base = math.sqrt(l3 ** 2 + S2 ** 2 - 2 * math.cos(theta2) * l3 * S2)
    arg2 = _clip((l3 ** 2 + S2 ** 2 - 2 * math.cos(theta2) * l3 * S2 + lc ** 2 - sc2 ** 2) / (2 * base * lc))
    term2 = math.acos(arg2)

    # term3: arccos((z2²+x2²+lc²-l4²) / (2·√(z2²+x2²)·lc))
    r2_sq = z2 ** 2 + x2 ** 2
    r2 = math.sqrt(r2_sq)
    arg3 = _clip((r2_sq + lc ** 2 - l4 ** 2) / (2 * r2 * lc))
    term3 = math.acos(arg3)

    left = term1 + term2 + term3
    right = 1.5 * math.pi - math.atan2(z1, x1) - math.atan2(x2, z2) - theta5
    return left - right


def solve_sc2(sc1):
    """对给定 Sc1，通过二分法求解约束方程得到 Sc2（替代原参考脚本的 brentq）"""
    lo, hi = _SC2_BRACKET
    flo = constraint(lo, sc1)
    for _ in range(120):
        mid = (lo + hi) / 2.0
        fm = constraint(mid, sc1)
        if flo * fm <= 0:
            hi = mid
        else:
            lo = mid
            flo = fm
    return (lo + hi) / 2.0


def alpha1(sc1):
    """α1 = arccos((z1²+x1²+l1²-Sc1²)/(2√(z1²+x1²)·l1)) + arctan2(z1,x1) + θ1 - π"""
    r_sq = z1 ** 2 + x1 ** 2
    r = math.sqrt(r_sq)
    arg = _clip((r_sq + l1 ** 2 - sc1 ** 2) / (2 * r * l1))
    return math.acos(arg) + math.atan2(z1, x1) + theta1 - math.pi


def alpha2(lc):
    """α2 = arccos((z2²+x2²+l4²-lc²)/(2√(z2²+x2²)·l4)) + arctan2(z2,x2) + θ3 - π"""
    r_sq = z2 ** 2 + x2 ** 2
    r = math.sqrt(r_sq)
    arg = _clip((r_sq + l4 ** 2 - lc ** 2) / (2 * r * l4))
    return math.acos(arg) + math.atan2(z2, x2) + theta3 - math.pi


def exit_area(sc1):
    """出口截面面积 S (mm²)，对给定驱动位移 Sc1 (mm)

    公式与原参考脚本 calc_S_position 一致:
    S = L·d·sin[arccos((l2²+L²-(x2+l5·cosα2)²-(z2+l5·sinα2)²)/(2·l2·L)) + (α2-α1)/2]
    L = √[(z2-l2·sinα1+l5·sinα2)² + (x2-l2·cosα1+l5·cosα2)²]
    """
    sc2 = solve_sc2(sc1)
    lc = lc_from_sc2(sc2)
    a1 = alpha1(sc1)
    a2 = alpha2(lc)

    A = z2 - l2 * math.sin(a1) + l5 * math.sin(a2)
    B = x2 - l2 * math.cos(a1) + l5 * math.cos(a2)
    L = math.sqrt(A ** 2 + B ** 2)

    num = l2 ** 2 + L ** 2 - (x2 + l5 * math.cos(a2)) ** 2 - (z2 + l5 * math.sin(a2)) ** 2
    den = 2 * l2 * L
    cos_arg = _clip(num / den)

    return L * d * math.sin(math.acos(cos_arg) + (a2 - a1) / 2)


# ========== 逆解: 面积 -> 驱动位移 Sc1 ==========
def _build_tables():
    """构建 Sc1 -> 出口面积 的离散查表（Sc1 递增，面积单调递减）"""
    sc1_table = []
    area_table = []
    n = _SC1_TABLE_POINTS - 1
    for i in range(_SC1_TABLE_POINTS):
        sc1 = SC1_MIN + (SC1_MAX - SC1_MIN) * i / n
        sc1_table.append(sc1)
        area_table.append(exit_area(sc1))
    return sc1_table, area_table


_SC1_TABLE, _AREA_TABLE = _build_tables()

# 最大/最小出口截面面积（mm²），对应 Sc1 = 130 / 200
MAX_EXIT_AREA = _AREA_TABLE[0]
MIN_EXIT_AREA = _AREA_TABLE[-1]


def area_to_sc1(target_area):
    """目标出口面积 (mm²) -> 驱动位移 Sc1 (mm)

    出口面积随 Sc1 单调递减，在 [MIN_EXIT_AREA, MAX_EXIT_AREA] 内二分+线性插值。
    超出物理范围时自动收敛到边界 (SC1_MAX / SC1_MIN)。
    """
    if target_area >= MAX_EXIT_AREA:
        return SC1_MIN
    if target_area <= MIN_EXIT_AREA:
        return SC1_MAX

    lo, hi = 0, len(_AREA_TABLE) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if _AREA_TABLE[mid] > target_area:
            lo = mid
        else:
            hi = mid

    a_lo, a_hi = _AREA_TABLE[lo], _AREA_TABLE[hi]
    t = 0.0 if a_hi == a_lo else (target_area - a_hi) / (a_lo - a_hi)
    return _SC1_TABLE[lo] + t * (_SC1_TABLE[hi] - _SC1_TABLE[lo])


def percentage_to_sc1(pct):
    """截面面积变化百分比 (0~100) -> 驱动位移 Sc1 (mm)

    输入量 = 百分比 × 最大截面面积；输出为解算得到的位移量。
    注意: 百分比低于物理下限约 1.996% 时，出口面积无法进一步减小，
    输出收敛到 SC1_MAX = 200 mm（执行器饱和）。
    """
    target_area = pct / 100.0 * MAX_EXIT_AREA
    return area_to_sc1(target_area)


def percentage_to_displacement(pct):
    """截面面积变化百分比 (0~100) -> 相对驱动位移 (mm)

    指令使用相对行程: displacement = Sc1 - SC1_MIN。
    因此 100% 对应 0 mm，0%（饱和）对应 70 mm。
    """
    return percentage_to_sc1(pct) - SC1_MIN


def displacement_to_sc1(displacement):
    """相对电推杆位移 (mm) -> 驱动位移 Sc1 (mm)"""
    sc1 = SC1_MIN + displacement
    return _clip(sc1, SC1_MIN, SC1_MAX)


def displacement_to_exit_area(displacement):
    """相对电推杆位移 (mm) -> 出口截面面积 S (mm²)"""
    return exit_area(displacement_to_sc1(displacement))


def displacement_to_percentage(displacement):
    """相对电推杆位移 (mm) -> 当前截面面积变化百分比"""
    return displacement_to_exit_area(displacement) / MAX_EXIT_AREA * 100.0


# ========== 自检 ==========
def selftest():
    """打印模型关键结果，用于验证与参考脚本一致"""
    print("=" * 50)
    print(f"MAX_EXIT_AREA (Sc1=130): {MAX_EXIT_AREA:.4f} mm²")
    print(f"MIN_EXIT_AREA (Sc1=200): {MIN_EXIT_AREA:.4f} mm²")
    print(f"Sc1 范围: [{SC1_MIN}, {SC1_MAX}] mm")

    # 单调性验证
    prev = None
    monotonic = True
    for a in _AREA_TABLE[::100]:
        if prev is not None and a >= prev:
            monotonic = False
            break
        prev = a
    print(f"出口面积单调递减: {monotonic}")

    # 逆解往返验证
    max_err = 0.0
    for s in range(int(SC1_MIN), int(SC1_MAX) + 1, 10):
        area = exit_area(s)
        sc1_back = area_to_sc1(area)
        err = abs(sc1_back - s)
        max_err = max(max_err, err)
    print(f"area_to_sc1(exit_area(s)) 往返最大误差: {max_err:.6f} mm")

    # 百分比 -> 位移 示例
    for pct in (100.0, 75.0, 50.0, 25.0, 10.0, 0.0):
        sc1 = percentage_to_sc1(pct)
        displacement = percentage_to_displacement(pct)
        area = pct / 100.0 * MAX_EXIT_AREA
        print(f"pct={pct:5.1f}% -> 目标面积={area:10.2f} mm² -> Sc1={sc1:7.3f} mm "
              f"-> 相对位移={displacement:7.3f} mm (指令值={int(round(displacement * 100))} 厘mm)")
    print("=" * 50)


if __name__ == '__main__':
    selftest()
