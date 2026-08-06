import os
import sys
from PyQt5.QtCore import QThread, pyqtSignal
import serial
import serial.tools.list_ports


class SerialWorker(QThread):
    signal_data = pyqtSignal(bytes)
    signal_error = pyqtSignal(str)

    def __init__(self, port):
        super().__init__()
        self.port, self.baud, self.serial, self.is_running = port, 9600, serial.Serial(), False

    def _check_alive(self):
        """检测串口是否仍然存活（跨平台兼容）"""
        if not self.serial.is_open:
            raise serial.SerialException(f"串口 {self.port} 已关闭")
        try:
            # 通过查询 in_waiting 属性触发底层 I/O 检测
            _ = self.serial.in_waiting
        except (serial.SerialException, OSError):
            raise serial.SerialException(f"设备 {self.port} 已物理断开")
        # Linux 补充检测：设备文件是否存在
        if sys.platform != 'win32' and not os.path.exists(self.port):
            raise serial.SerialException(f"设备 {self.port} 已物理断开")

    def run(self):
        try:
            self.serial.port = self.port
            self.serial.baudrate = self.baud
            self.serial.timeout = 0.05
            # Windows 下设置 DTR/RTS 以确保 USB 转串口正常初始化
            if sys.platform == 'win32':
                self.serial.dtr = True
                self.serial.rts = True
            self.serial.open()
            self.is_running = True
            print(f"串口 {self.port} 已打开，波特率 {self.baud}")
        except Exception as e:
            print(f"串口 {self.port} 打开失败: {e}")
            self.signal_error.emit(f"串口 {self.port} 打开失败: {e}")
            return
        while self.is_running:
            try:
                if self.serial.in_waiting > 0:
                    raw = self.serial.read(self.serial.in_waiting)
                    if raw:
                        self.signal_data.emit(raw)
                else:
                    self._check_alive()
                    self.msleep(5)
            except Exception as e:
                print(f"串口读取错误: {e}")
                self.signal_error.emit(str(e))
                break
        if self.serial.is_open:
            self.serial.close()
        print(f"串口 {self.port} 已关闭")

    def send_data(self, data: bytes):
        try:
            if self.is_running and self.serial.is_open:
                self.serial.write(data)
                hex_str = ' '.join(f'{b:02X}' for b in data)
                print(f"发送成功: {hex_str}")
        except Exception as e:
            print(f"串口写入错误: {e}")
            self.signal_error.emit(str(e))

    def stop(self):
        self.is_running = False
        self.wait()
