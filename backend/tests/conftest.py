import socket

import pytest
from httpx import ASGITransport, AsyncClient

from app.db import init_db
from app.main import app

FORBIDDEN_HOSTS = [
    "api-inference.huggingface.co",
    "router.huggingface.co",
]


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def ensure_db_initialized():
    await init_db()


@pytest.fixture(autouse=True)
def guard_no_hosted_inference(monkeypatch):
    """Enforces that tests cannot connect to forbidden external hosted inference endpoints."""
    orig_connect = socket.socket.connect
    orig_getaddrinfo = socket.getaddrinfo

    def guarded_getaddrinfo(host, port, *args, **kwargs):
        if any(f in str(host) for f in FORBIDDEN_HOSTS):
            raise RuntimeError(f"Network Guard: Forbidden hosted inference call to {host}")
        return orig_getaddrinfo(host, port, *args, **kwargs)

    def guarded_connect(self, address):
        host = address[0] if isinstance(address, tuple) else str(address)
        if any(f in str(host) for f in FORBIDDEN_HOSTS):
            raise RuntimeError(f"Network Guard: Forbidden hosted inference connection to {host}")
        return orig_connect(self, address)

    monkeypatch.setattr(socket, "getaddrinfo", guarded_getaddrinfo)
    monkeypatch.setattr(socket.socket, "connect", guarded_connect)


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
