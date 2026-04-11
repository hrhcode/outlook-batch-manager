from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from backend.app.api.deps import assert_desktop_auth, get_event_bus
from backend.app.services.event_bus import EventBus

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(assert_desktop_auth)])


@router.get("/stream")
async def stream_events(event_bus: EventBus = Depends(get_event_bus)) -> StreamingResponse:
    queue = event_bus.subscribe()

    async def event_generator():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: {message.event}\n"
                    yield f"data: {json.dumps(message.data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            event_bus.unsubscribe(None, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

