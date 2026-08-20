from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier
from products.models import Product, ProductIn, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.post("/bulk", response_model=list[ProductOut], status_code=201)
async def bulk_create_products(
    items: list[ProductIn],
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    products = []
    for data in items:
        sku = data.sku or data.name.upper().replace(" ", "-")[:50]
        product = Product(
            supplier_id=supplier.id, sku=sku, **data.model_dump(exclude={"sku"})
        )
        db.add(product)
        products.append(product)
    await db.commit()
    for p in products:
        await db.refresh(p)
    return products


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    data: ProductIn,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    sku = data.sku or data.name.upper().replace(" ", "-")[:50]
    product = Product(
        supplier_id=supplier.id, sku=sku, **data.model_dump(exclude={"sku"})
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("", response_model=list[ProductOut])
async def list_products(
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.supplier_id == supplier.id))
    return result.scalars().all()


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.supplier_id == supplier.id
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}/deactivate", status_code=204)
async def deactivate_product(
    product_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.supplier_id == supplier.id
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.active = False
    await db.commit()


@router.patch("/{product_id}/activate", status_code=204)
async def activate_product(
    product_id: int,
    supplier: Supplier = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.supplier_id == supplier.id
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.active = True
    await db.commit()
