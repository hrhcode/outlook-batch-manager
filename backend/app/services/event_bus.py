from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class EventMessage:
    event: str
    data: dict[str, Any]


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = {}

    def subscribe(self, event: str | None = None) -> asyncio.Queue:
        """
        订阅事件

        Args:
            event: 事件名称，如果为None则订阅所有事件

        Returns:
            asyncio.Queue: 事件队列
        """
        queue: asyncio.Queue = asyncio.Queue()
        key = event or "__all__"
        if key not in self._subscribers:
            self._subscribers[key] = set()
        self._subscribers[key].add(queue)
        return queue

    def unsubscribe(self, event: str | None, queue: asyncio.Queue) -> None:
        """
        取消订阅事件

        Args:
            event: 事件名称
            queue: 事件队列
        """
        key = event or "__all__"
        if key in self._subscribers:
            self._subscribers[key].discard(queue)

    async def publish(self, event: str, data: dict[str, Any]) -> None:
        """
        发布事件

        Args:
            event: 事件名称
            data: 事件数据
        """
        payload = EventMessage(
            event=event,
            data={
                **data,
                "emitted_at": datetime.utcnow().isoformat()
            }
        )

        if event in self._subscribers:
            for queue in list(self._subscribers[event]):
                await queue.put(payload)

        if "__all__" in self._subscribers:
            for queue in list(self._subscribers["__all__"]):
                await queue.put(payload)

    def emit(self, event: str, data: dict[str, Any]) -> None:
        """
        同步发布事件（用于非异步上下文）

        Args:
            event: 事件名称
            data: 事件数据
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.publish(event, data))
            else:
                loop.run_until_complete(self.publish(event, data))
        except RuntimeError:
            pass

