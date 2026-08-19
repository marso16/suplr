"""Alembic migration environment."""

import asyncio
import re
import sys
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool
from alembic import context

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from database import Base
from config import get_settings

from suppliers.models import Supplier, WhatsAppConnection  # noqa: F401
from clients.models import Client  # noqa: F401
from products.models import Product  # noqa: F401
from orders.models import Order, OrderItem  # noqa: F401
from whatsapp.models import Message  # noqa: F401
from invoices.models import Invoice  # noqa: F401

target_metadata = Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()

# Strip SSL query params that asyncpg does not accept as URL params
_db_url = re.sub(
    r"[?&](sslmode|channel_binding|ssl)=[^&]*", "", settings.database_url
).rstrip("?&")
_connect_args = {"ssl": True} if "neon.tech" in settings.database_url else {}


def run_migrations_offline() -> None:
    context.configure(
        url=_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(
        _db_url,
        poolclass=pool.NullPool,
        connect_args=_connect_args,
    )
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
