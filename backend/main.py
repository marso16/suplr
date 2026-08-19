# suplr backend
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from config import get_settings
from orders.pending import PendingOrder  # noqa: F401 — registers table with Base
from auth.router import router as auth_router
from clients.router import router as clients_router
from products.router import router as products_router
from whatsapp.router import router as webhook_router
from orders.router import router as orders_router
from invoices.router import router as invoices_router
from sse.events import router as sse_router, check_redis
from reports.router import router as reports_router
from broadcast.router import router as broadcast_router
from admin.router import router as admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column additions for existing deployments
        await conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "
                "must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
    logger.info("🗄️  Database tables ready")
    await check_redis()
    yield


app = FastAPI(title="WhatsApp B2B Orders", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health_check():
    return {"message": "Server is up and running!"}


app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(products_router)
app.include_router(webhook_router)
app.include_router(orders_router)
app.include_router(invoices_router)
app.include_router(sse_router)
app.include_router(reports_router)
app.include_router(broadcast_router)
app.include_router(admin_router)
