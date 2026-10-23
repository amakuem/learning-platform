import asyncio
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt 

from app.config import settings

async def hash_password(password: str) -> str:
    return await asyncio.to_thread(
        lambda: bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    )

async def verify_password(password: str, password_hash: str) -> bool:
    return await asyncio.to_thread(
        bcrypt.checkpw, password.encode(), password_hash.encode()
    ) 

def create_access_token(user_id: int) -> int:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_access_token(token: str) -> int:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    return int(payload["sub"])

