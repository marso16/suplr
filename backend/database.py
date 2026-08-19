from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()

# asyncpg does not translate the sslmode URL query-param; pass ssl via connect_args instead.
_db_url = settings.database_url
_connect_args = {}
if "neon.tech" in _db_url or "ssl=true" in _db_url or "sslmode=require" in _db_url:
    # Strip any SSL query params the asyncpg driver does not accept directly
    import re

    _db_url = re.sub(r"[?&](sslmode|channel_binding|ssl)=[^&]*", "", _db_url).rstrip(
        "?&"
    )
    _connect_args = {"ssl": True}

engine = create_async_engine(_db_url, echo=False, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
