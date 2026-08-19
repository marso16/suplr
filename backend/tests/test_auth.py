import pytest


@pytest.mark.asyncio
async def test_register_supplier(client):
    resp = await client.post(
        "/auth/register",
        json={"name": "Acme Foods", "email": "acme@test.com", "password": "secret123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "acme@test.com"
    assert "password" not in data


@pytest.mark.asyncio
async def test_login_returns_token(client):
    await client.post(
        "/auth/register",
        json={"name": "Acme Foods", "email": "acme@test.com", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/login", json={"email": "acme@test.com", "password": "secret123"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post(
        "/auth/register",
        json={"name": "Acme Foods", "email": "acme@test.com", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/login", json={"email": "acme@test.com", "password": "wrong"}
    )
    assert resp.status_code == 401
