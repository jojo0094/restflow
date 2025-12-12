"""SQLAlchemy ORM models for workflow persistence."""
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .db import Base
import enum


class ExecutionStatusEnum(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowDB(Base):
    """Workflow definition table."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    meta = Column(JSON, name='meta', default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    nodes = relationship("NodeDB", back_populates="workflow", cascade="all, delete-orphan")
    edges = relationship("EdgeDB", back_populates="workflow", cascade="all, delete-orphan")
    executions = relationship("ExecutionDB", back_populates="workflow", cascade="all, delete-orphan")


class NodeDB(Base):
    """Node in a workflow (stored as rows for query/indexing)."""
    __tablename__ = "nodes"

    id = Column(String, primary_key=True)  # UI-generated ID like 'task-123'
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)  # 'data_loader', 'transformer', 'filter', etc.
    label = Column(String, nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    config = Column(JSON, default={})  # Node-specific configuration
    order = Column(Integer, nullable=True)  # Execution order (topological sort result)

    # Relationships
    workflow = relationship("WorkflowDB", back_populates="nodes")


class EdgeDB(Base):
    """Edge connecting two nodes."""
    __tablename__ = "edges"

    id = Column(String, primary_key=True)  # UI-generated ID like 'e1-2'
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    target = Column(String, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    source_handle = Column(String, nullable=True)
    target_handle = Column(String, nullable=True)

    # Relationships
    workflow = relationship("WorkflowDB", back_populates="edges")


class ExecutionDB(Base):
    """Execution instance of a workflow."""
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(ExecutionStatusEnum), default=ExecutionStatusEnum.PENDING, nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)  # Final outputs

    # Relationships
    workflow = relationship("WorkflowDB", back_populates="executions")
    node_runs = relationship("NodeRunDB", back_populates="execution", cascade="all, delete-orphan")


class NodeRunDB(Base):
    """Execution log for a single node within an execution."""
    __tablename__ = "node_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(String, nullable=False, index=True)
    status = Column(Enum(ExecutionStatusEnum), default=ExecutionStatusEnum.PENDING, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    log = Column(Text, nullable=True)
    output = Column(JSON, nullable=True)  # Node output data

    # Relationships
    execution = relationship("ExecutionDB", back_populates="node_runs")


class ArtifactDB(Base):
    """Artifacts produced by node execution (file paths, metadata)."""
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    execution_id = Column(Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(String, nullable=False, index=True)
    path = Column(String, nullable=False)  # Filesystem or object storage path
    meta = Column(JSON, default={})  # Type, size, format, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
