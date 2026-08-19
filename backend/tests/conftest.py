import os
from pathlib import Path

# Set test defaults FIRST so they win over any matching keys in .env.
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long!!")

# Load project .env (override=False keeps any already-set vars from above).
# This makes TEST_DATABASE_URL (and other non-Settings extras) available to
# module-level code below without exposing credentials in source.
from dotenv import load_dotenv  # python-dotenv (installed with pydantic-settings)

load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)

import pytest
import pytest_asyncio

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from database import Base, get_db
from main import app

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://user:password@localhost:5432/whatsapp_orders_test",
)
# Neon (and other cloud Postgres hosts) require SSL; asyncpg expects ssl=True in connect_args,
# not an sslmode query-param (which SQLAlchemy's asyncpg dialect does not translate).
# NullPool prevents asyncpg connections from being cached across event-loop boundaries in tests.
_engine_kwargs: dict = {"poolclass": NullPool}
if "neon.tech" in TEST_DB_URL or os.environ.get("DB_REQUIRE_SSL"):
    _engine_kwargs["connect_args"] = {"ssl": True}

test_engine = create_async_engine(TEST_DB_URL, **_engine_kwargs)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True, scope="session")
def reset_settings():
    import config as cfg

    cfg._settings = None
    yield
    cfg._settings = None


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    await client.post(
        "/auth/register",
        json={"name": "Test Supplier", "email": "test@test.com", "password": "pass123"},
    )
    resp = await client.post(
        "/auth/login", json={"email": "test@test.com", "password": "pass123"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
