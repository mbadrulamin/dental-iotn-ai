"""
Authentication service with JWT support.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, Token, TokenPayload

settings = get_settings()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for authentication operations."""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(
        user_id: UUID,
        email: str,
        role: UserRole,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a JWT access token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.jwt_access_token_expire_minutes
            )
        
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role.value,
            "exp": expire,
            "type": "access",
        }
        
        return jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
    
    @staticmethod
    def create_refresh_token(
        user_id: UUID,
        email: str,
        role: UserRole,
    ) -> str:
        """Create a JWT refresh token."""
        expire = datetime.utcnow() + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )
        
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role.value,
            "exp": expire,
            "type": "refresh",
        }
        
        return jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
    
    @staticmethod
    def decode_token(token: str) -> Optional[TokenPayload]:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
            return TokenPayload(
                sub=payload["sub"],
                email=payload["email"],
                role=UserRole(payload["role"]),
                exp=datetime.fromtimestamp(payload["exp"]),
            )
        except JWTError:
            return None
    
    @staticmethod
    async def create_user(
        db: AsyncSession,
        user_data: UserCreate,
    ) -> User:
        """Create a new user."""
        user = User(
            email=user_data.email,
            password_hash=AuthService.hash_password(user_data.password),
            full_name=user_data.full_name,
            role=UserRole(user_data.role.value),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user
    
    @staticmethod
    async def get_user_by_email(
        db: AsyncSession,
        email: str,
    ) -> Optional[User]:
        """Get a user by email."""
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_id(
        db: AsyncSession,
        user_id: UUID,
    ) -> Optional[User]:
        """Get a user by ID."""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str,
    ) -> Optional[User]:
        """Authenticate a user by email and password."""
        user = await AuthService.get_user_by_email(db, email)
        if not user:
            return None
        if not AuthService.verify_password(password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return user
    
    @staticmethod
    def generate_tokens(user: User) -> Token:
        """Generate access and refresh tokens for a user."""
        access_token = AuthService.create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
        )
        refresh_token = AuthService.create_refresh_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
        )
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )
