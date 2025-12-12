"""Pydantic schemas for API validation and NodeExecutor base class."""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
from abc import ABC, abstractmethod


# ==================== Pydantic Schemas ====================

class NodeBase(BaseModel):
    """Base schema for a workflow node."""
    id: str
    type: str = Field(..., description="Node type: data_loader, transformer, filter, etc.")
    label: Optional[str] = None
    position: Optional[Dict[str, float]] = None  # {x, y}
    config: Dict[str, Any] = Field(default_factory=dict, description="Node-specific configuration")


class NodeCreate(NodeBase):
    """Schema for creating a node."""
    pass


class NodeResponse(NodeBase):
    """Schema for node response."""
    pass


class EdgeBase(BaseModel):
    """Base schema for a workflow edge."""
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class EdgeCreate(EdgeBase):
    """Schema for creating an edge."""
    pass


class EdgeResponse(EdgeBase):
    """Schema for edge response."""
    pass


class WorkflowBase(BaseModel):
    """Base schema for a workflow."""
    name: str
    description: Optional[str] = None
    nodes: List[NodeBase] = []
    edges: List[EdgeBase] = []
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowCreate(WorkflowBase):
    """Schema for creating a workflow."""
    pass


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow."""
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[NodeBase]] = None
    edges: Optional[List[EdgeBase]] = None
    metadata: Optional[Dict[str, Any]] = None


class WorkflowResponse(WorkflowBase):
    """Schema for workflow response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionRequest(BaseModel):
    """Schema for workflow execution request."""
    workflow_id: int
    input_data: Optional[Dict[str, Any]] = None


class ExecutionStatus(BaseModel):
    """Schema for execution status response."""
    id: int
    workflow_id: int
    status: Literal["pending", "running", "completed", "failed"]
    started_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class NodeTypeInfo(BaseModel):
    """Schema for node type metadata."""
    type: str
    label: str
    description: str
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    tools: List[str] = Field(default_factory=list, description="Available tools for this node type")


# ==================== NodeExecutor Base Class ====================

class NodeExecutor(ABC):
    """
    Base class for all node type executors.
    Each node type (data_loader, transformer, filter, etc.) implements this interface.
    """

    @abstractmethod
    async def execute(self, input_data: Any, config: Dict[str, Any]) -> Any:
        """
        Execute node logic.
        
        Args:
            input_data: Data from upstream nodes
            config: Node-specific configuration
            
        Returns:
            Output data to pass to downstream nodes
        """
        pass

    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """
        Validate node configuration.
        
        Args:
            config: Node configuration dict
            
        Returns:
            True if valid, False otherwise
        """
        pass

    def get_config_schema(self) -> Dict[str, Any]:
        """
        Return JSON schema for node configuration UI.
        
        Returns:
            JSON schema dict
        """
        return {}

    def get_available_tools(self) -> List[str]:
        """
        Return list of available tools/operations for this node type.
        
        Returns:
            List of tool names
        """
        return []


# ==================== Legacy schemas for backward compatibility ====================

class Node(BaseModel):
    """Legacy Node schema (kept for backward compat with /workflow/run)."""
    id: str
    data: Dict[str, Any]
    position: Dict[str, float]


class Edge(BaseModel):
    """Legacy Edge schema (kept for backward compat with /workflow/run)."""
    id: str
    source: str
    target: str


class Workflow(BaseModel):
    """Legacy Workflow schema (kept for backward compat with /workflow/run)."""
    nodes: List[Node]
    edges: List[Edge]
