from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.accounts import router as accounts_router
from backend.app.api.events import router as events_router
from backend.app.api.mail import router as mail_router
from backend.app.api.proxy import router as proxy_router
from backend.app.api.register import router as register_router
from backend.app.api.settings import router as settings_router
from backend.app.core.config import Settings, get_settings
from backend.app.db.database import configure_database, init_db
from backend.app.services.auth import OutlookOAuthService
from backend.app.services.browser_installer import install_browsers_on_startup
from backend.app.services.event_bus import EventBus
from backend.app.services.imap_sync import OutlookImapService
from backend.app.services.register_service import RegisterService
from backend.app.services.sync_service import AccountSyncService, SyncDependencies


def create_app(settings: Settings | None = None, enable_sync: bool = True) -> FastAPI:
    resolved_settings = settings or get_settings()
    event_bus = EventBus()
    auth_service = OutlookOAuthService(resolved_settings)
    imap_service = OutlookImapService(resolved_settings)
    sync_service = AccountSyncService(
        SyncDependencies(
            settings=resolved_settings,
            auth_service=auth_service,
            imap_service=imap_service,
            event_bus=event_bus
        ),
        enabled=enable_sync
    )
    register_service = RegisterService(event_bus=event_bus)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        resolved_settings.data_dir.mkdir(parents=True, exist_ok=True)
        configure_database(resolved_settings)
        init_db()

        if enable_sync:
            await sync_service.start()
        yield
        if enable_sync:
            await sync_service.stop()

    app = FastAPI(title="Core Gateway Backend", version="0.1.0", lifespan=lifespan)
    app.state.settings = resolved_settings
    app.state.event_bus = event_bus
    app.state.sync_service = sync_service
    app.state.auth_service = auth_service
    app.state.imap_service = imap_service
    app.state.register_service = register_service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"]
    )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    app.include_router(accounts_router)
    app.include_router(mail_router)
    app.include_router(events_router)
    app.include_router(settings_router)
    app.include_router(proxy_router)
    app.include_router(register_router)
    return app


app = create_app()
