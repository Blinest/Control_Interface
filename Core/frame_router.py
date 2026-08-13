from typing import List, Tuple


class MultiHeaderFrameAssembler:
    """串口原始字节流 → 带界面类型的完整协议帧。"""

    FRAME_HEADS = {
        0xAA: "lqts",
        0xBB: "lyz",
        0xCC: "sw",
    }
    MAX_BUFFER = 1024

    def __init__(self):
        self.buffer = bytearray()

    def feed(self, data: bytes):
        self.buffer.extend(data)
        if len(self.buffer) > self.MAX_BUFFER:
            self.buffer.clear()

    def get_frames(self) -> List[Tuple[str, bytes]]:
        frames = []
        while len(self.buffer) >= 5:
            frame_head = self.buffer[0]
            if frame_head not in self.FRAME_HEADS:
                self.buffer.pop(0)
                continue

            d_len = self.buffer[2]
            frame_len = 3 + d_len + 1
            if len(self.buffer) < frame_len:
                break

            frame = bytes(self.buffer[:frame_len])
            self.buffer = self.buffer[frame_len:]

            if (sum(frame[:-1]) & 0xFF) != frame[-1]:
                continue

            frames.append((self.FRAME_HEADS[frame_head], frame))
        return frames

    def clear(self):
        self.buffer.clear()
