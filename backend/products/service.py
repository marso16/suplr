from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from products.models import Product


async def get_active_products(supplier_id: int, db: AsyncSession) -> list[Product]:
    result = await db.execute(
        select(Product).where(
            Product.supplier_id == supplier_id, Product.active == True
        )  # noqa: E712
    )
    return result.scalars().all()
