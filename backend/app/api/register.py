import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from backend.app.api.deps import assert_desktop_auth, get_db_session
from backend.app.db.models import RegisterTask
from backend.app.schemas.register import RegisterConfig, RegisterTaskCreate, RegisterTaskStatus
from backend.app.services.register_service import RegisterService

router = APIRouter(prefix="/register", tags=["register"], dependencies=[Depends(assert_desktop_auth)])


def get_register_service() -> RegisterService:
    """
    获取注册服务实例
    """
    from backend.app.main import app
    return app.state.register_service


@router.post("/start", response_model=RegisterTaskStatus)
async def start_register_task(
    payload: RegisterTaskCreate,
    service: RegisterService = Depends(get_register_service)
) -> RegisterTaskStatus:
    """
    启动批量注册任务
    """
    task_id = await service.start_task(payload.config)
    status = await service.get_task_status(task_id)

    if not status:
        raise HTTPException(status_code=500, detail="创建任务失败")

    return RegisterTaskStatus(**status)


@router.get("/status/{task_id}", response_model=RegisterTaskStatus)
async def get_register_status(
    task_id: int,
    session=Depends(get_db_session)
) -> RegisterTaskStatus:
    """
    获取注册任务状态
    """
    task = session.scalar(select(RegisterTask).where(RegisterTask.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return RegisterTaskStatus(
        id=task.id,
        status=task.status,
        total_count=task.total_count,
        succeeded_count=task.succeeded_count,
        failed_count=task.failed_count,
        created_at=task.created_at,
        completed_at=task.completed_at
    )


@router.post("/cancel/{task_id}")
async def cancel_register_task(
    task_id: int,
    service: RegisterService = Depends(get_register_service)
) -> dict:
    """
    取消注册任务
    """
    success = await service.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="无法取消任务")

    return {"status": "ok"}


@router.get("/progress/{task_id}")
async def get_register_progress(
    task_id: int,
    service: RegisterService = Depends(get_register_service)
) -> StreamingResponse:
    """
    获取注册进度（SSE）
    """
    from backend.app.main import app
    from backend.app.services.event_bus import EventBus

    event_bus: EventBus = app.state.event_bus

    async def event_generator():
        queue = event_bus.subscribe("register_progress")

        try:
            while True:
                status = await service.get_task_status(task_id)
                if status and status["status"] in ["completed", "cancelled"]:
                    break

                try:
                    data = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if data.get("task_id") == task_id:
                        yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f": heartbeat\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe("register_progress", queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
