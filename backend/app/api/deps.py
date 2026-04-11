from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_session


def get_db_session(session: Session = Depends(get_session)) -> Session:
    return session


def get_event_bus(request: Request):
    return request.app.state.event_bus


def get_sync_service(request: Request):
    return request.app.state.sync_service


def assert_desktop_auth(request: Request) -> None:
    token = request.headers.get("X-Desktop-Token")
    if request.url.path == "/events/stream" and not token:
        token = request.query_params.get("token")

    if token != request.app.state.settings.desktop_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized desktop session.")

