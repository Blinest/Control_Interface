# protocol.py
import struct
from collections import deque
from typing import List, Optional, Tuple

# ===================== 数据类 =====================
class MotorData:
    __slots__ = ('pos', 'vel', 'status')
    def __init__(self, pos: float, vel: float, status: int):
        self.pos = pos        # ° (角度)
        self.vel = vel        # °/s
        self.status = status  # 0:停止, 1:运行

class DeviceStatus:
    __slots__ = ('num_motors', 'motors', 'theta1', 'theta2', 'sys_state')
    def __init__(self, num_motors: int, motors: List[MotorData],
                 theta1: float, theta2: float, sys_state: int):
        self.num_motors = num_motors
        self.motors = motors
        self.theta1 = theta1  # 向下偏转角（度）
        self.theta2 = theta2  # 向上偏转角（度）
        self.sys_state = sys_state

# ===================== 滤波器 =====================
class DataFilter:
    """中值滤波 + 限幅滤波"""
    def __init__(self, window_size: int = 3, max_change_rate: dict = None):
        self.window_size = window_size
        self.max_change = max_change_rate or {
            'pos': 20.0, 'vel': 50.0, 'angle': 30.0
        }
        self._motor_buffers = []   # 每个电机 [pos_queue, vel_queue]
        self._prev_motor = []      # 上一次滤波后的值，用于限幅

    def _median(self, queue: deque, new_val: float) -> float:
        queue.append(new_val)
        if len(queue) > self.window_size:
            queue.popleft()
        if len(queue) < self.window_size:
            return new_val
        sorted_vals = sorted(queue)
        return sorted_vals[len(sorted_vals)//2]

    def _limit(self, old: float, new: float, max_change: float) -> float:
        diff = new - old
        if abs(diff) > max_change:
            return old + (max_change if diff > 0 else -max_change)
        return new

    def apply_motor(self, idx: int, pos: float, vel: float) -> Tuple[float, float]:
        while len(self._motor_buffers) <= idx:
            self._motor_buffers.append([deque(maxlen=self.window_size) for _ in range(2)])
            self._prev_motor.append([0.0, 0.0])
        buffers = self._motor_buffers[idx]
        prev = self._prev_motor[idx]

        fpos = self._median(buffers[0], pos)
        fvel = self._median(buffers[1], vel)

        fpos = self._limit(prev[0], fpos, self.max_change['pos'])
        fvel = self._limit(prev[1], fvel, self.max_change['vel'])

        self._prev_motor[idx] = [fpos, fvel]
        return fpos, fvel

    def reset(self):
        self._motor_buffers.clear()
        self._prev_motor.clear()

# ===================== 协议解析器 =====================
class ProtocolParser:
    @staticmethod
    def parse_frame(frame: bytes, apply_filter: bool = False, filter_obj: DataFilter = None) -> Optional[DeviceStatus]:
        if len(frame) < 5 or frame[0] != 0xBB:
            return None
        func = frame[1]
        if func != 0x02:   # 只处理状态反馈帧
            return None
        payload = frame[3:-1]
        if len(payload) < 2:
            return None

        offset = 0
        motor_num = payload[offset]
        offset += 1

        motors = []
        for _ in range(motor_num):
            if offset + 5 > len(payload):
                break
            pos = struct.unpack_from('>h', payload, offset)[0] / 100.0
            offset += 2
            vel = struct.unpack_from('>h', payload, offset)[0] / 100.0
            offset += 2
            status = payload[offset]
            offset += 1
            motors.append(MotorData(pos, vel, status))

        theta1 = 0.0
        theta2 = 0.0
        sys_state = 0
        if offset + 5 <= len(payload):
            theta1 = struct.unpack_from('>h', payload, offset)[0] / 100.0
            offset += 2
            theta2 = struct.unpack_from('>h', payload, offset)[0] / 100.0
            offset += 2
            sys_state = payload[offset]

        if apply_filter and filter_obj is not None:
            filtered_motors = []
            for i, m in enumerate(motors):
                fp, fv = filter_obj.apply_motor(i, m.pos, m.vel)
                filtered_motors.append(MotorData(fp, fv, m.status))
            motors = filtered_motors

        return DeviceStatus(
            num_motors=motor_num,
            motors=motors,
            theta1=theta1,
            theta2=theta2,
            sys_state=sys_state
        )