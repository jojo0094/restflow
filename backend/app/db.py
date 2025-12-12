"""Database configuration and session management."""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Support both SQLite (dev) and Postgres (prod) via DATABASE_URL env var
# Default to SQLite with aiosqlite driver
# Default DB file: place it next to the backend package so relative cwd won't break
default_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dev.db'))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{default_db_path}")

# Create async engine
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    # aiosqlite (sqlite) needs check_same_thread=False when used in sync contexts
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Declarative base for ORM models
Base = declarative_base()


async def get_db():
    """Dependency for FastAPI endpoints to get DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (for dev/testing; use Alembic for prod)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
