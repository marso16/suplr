from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from clients.models import Client


async def get_or_create_client_by_number(
    supplier_id: int, whatsapp_number: str, db: AsyncSession
) -> Client:
    result = await db.execute(
        select(Client).where(
            Client.supplier_id == supplier_id, Client.whatsapp_number == whatsapp_number
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        try:
            client = Client(
                supplier_id=supplier_id,
                name=whatsapp_number,
                whatsapp_number=whatsapp_number,
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(
                select(Client).where(
                    Client.supplier_id == supplier_id,
                    Client.whatsapp_number == whatsapp_number,
                )
            )
            client = result.scalar_one()
    return client
