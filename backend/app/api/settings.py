import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.deps import assert_desktop_auth, get_db_session
from backend.app.db.models import AppSettings
from backend.app.schemas.settings import AppSettingsResponse, OAuth2Settings

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(assert_desktop_auth)])


def _get_or_create_app_settings(session: Session) -> AppSettings:
    """
    获取或创建应用设置
    """
    settings = session.scalar(select(AppSettings))
    if not settings:
        settings = AppSettings(
            oauth2_client_id="",
            oauth2_redirect_url="",
            oauth2_scopes="[]"
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.get("/oauth2", response_model=OAuth2Settings)
def get_oauth2_settings(session: Session = Depends(get_db_session)) -> OAuth2Settings:
    """
    获取OAuth2设置
    """
    settings = _get_or_create_app_settings(session)
    scopes = json.loads(settings.oauth2_scopes) if settings.oauth2_scopes else []
    return OAuth2Settings(
        client_id=settings.oauth2_client_id,
        redirect_url=settings.oauth2_redirect_url,
        scopes=scopes
    )


@router.put("/oauth2", response_model=OAuth2Settings)
def update_oauth2_settings(
    payload: OAuth2Settings,
    session: Session = Depends(get_db_session)
) -> OAuth2Settings:
    """
    更新OAuth2设置
    """
    settings = _get_or_create_app_settings(session)
    settings.oauth2_client_id = payload.client_id
    settings.oauth2_redirect_url = payload.redirect_url
    settings.oauth2_scopes = json.dumps(payload.scopes)
    settings.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(settings)

    return OAuth2Settings(
        client_id=settings.oauth2_client_id,
        redirect_url=settings.oauth2_redirect_url,
        scopes=json.loads(settings.oauth2_scopes)
    )
