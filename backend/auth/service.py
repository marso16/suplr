from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import get_settings

# Passlib 1.7.4 + bcrypt 4+/5+ compatibility fix:
# passlib's backend-detection routine (detect_wrap_bug) hashes a 255-byte test
# password. bcrypt 4+ raises ValueError for passwords > 72 bytes, breaking that
# detection. Wrapping hashpw to truncate at 72 bytes restores bcrypt 3.x behaviour
# during detection only — actual user passwords are short and unaffected.
try:
    import bcrypt as _bcrypt_lib

    _orig_hashpw = _bcrypt_lib.hashpw

    def _safe_hashpw(password: bytes, salt: bytes) -> bytes:
        if len(password) > 72:
            password = password[:72]
        return _orig_hashpw(password, salt)

    _bcrypt_lib.hashpw = _safe_hashpw
except Exception:
    pass

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(supplier_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(supplier_id), "exp": expire}, settings.secret_key, algorithm="HS256"
    )


def decode_token(token: str) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise ValueError("Invalid token")
