import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.api.deps import assert_desktop_auth, get_db_session
from backend.app.db.models import ProxyPool
from backend.app.schemas.proxy import ProxyCreate, ProxyItem, ProxyUpdate

router = APIRouter(prefix="/proxy", tags=["proxy"], dependencies=[Depends(assert_desktop_auth)])


@router.get("", response_model=list[ProxyItem])
def list_proxies(session: Session = Depends(get_db_session)) -> list[ProxyItem]:
    """
    获取代理列表
    """
    proxies = session.scalars(select(ProxyPool).order_by(ProxyPool.created_at.desc()))
    return [ProxyItem.model_validate(p) for p in proxies]


@router.post("", response_model=ProxyItem)
def add_proxy(payload: ProxyCreate, session: Session = Depends(get_db_session)) -> ProxyItem:
    """
    添加代理
    """
    proxy = ProxyPool(proxy_url=payload.proxy_url)
    session.add(proxy)
    session.commit()
    session.refresh(proxy)
    return ProxyItem.model_validate(proxy)


@router.put("/{proxy_id}", response_model=ProxyItem)
def update_proxy(
    proxy_id: int,
    payload: ProxyUpdate,
    session: Session = Depends(get_db_session)
) -> ProxyItem:
    """
    更新代理
    """
    proxy = session.scalar(select(ProxyPool).where(ProxyPool.id == proxy_id))
    if not proxy:
        raise HTTPException(status_code=404, detail="代理不存在")

    if payload.is_enabled is not None:
        proxy.is_enabled = payload.is_enabled

    session.commit()
    session.refresh(proxy)
    return ProxyItem.model_validate(proxy)


@router.delete("/{proxy_id}")
def delete_proxy(proxy_id: int, session: Session = Depends(get_db_session)) -> dict:
    """
    删除代理
    """
    proxy = session.scalar(select(ProxyPool).where(ProxyPool.id == proxy_id))
    if not proxy:
        raise HTTPException(status_code=404, detail="代理不存在")

    session.delete(proxy)
    session.commit()
    return {"status": "ok"}


def get_random_proxy(session: Session) -> str | None:
    """
    获取随机代理
    """
    proxies = session.scalars(
        select(ProxyPool).where(ProxyPool.is_enabled == True)
    ).all()

    if not proxies:
        return None

    proxy = random.choice(proxies)
    proxy.last_used_at = datetime.utcnow()
    session.commit()

    return proxy.proxy_url


def update_proxy_stats(session: Session, proxy_url: str, success: bool):
    """
    更新代理统计
    """
    proxy = session.scalar(select(ProxyPool).where(ProxyPool.proxy_url == proxy_url))
    if proxy:
        if success:
            proxy.success_count += 1
        else:
            proxy.fail_count += 1
        session.commit()
