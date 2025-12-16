"""Main FastAPI application with workflow CRUD and execution endpoints."""
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from .models import (
    Workflow, WorkflowCreate, WorkflowResponse, WorkflowUpdate,
    ExecutionRequest, ExecutionStatus, NodeTypeInfo
)
from .database_models import WorkflowDB, NodeDB, EdgeDB, ExecutionDB, ExecutionStatusEnum
from .db import get_db, init_db
from .executors import NODE_REGISTRY
from .session import SessionManager, WorkspaceSession
from . import tools
import os

app = FastAPI(title="restFlow backend", version="0.1.0")

# CORS middleware for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# SESSION MANAGEMENT (Global state)
# ============================================================================

# Initialize session manager with default DB path
default_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dev.db'))
session_manager = SessionManager(default_db_path)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    await init_db()


@app.get("/")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ============================================================================
# SESSION API (New backend-agnostic endpoints)
# ============================================================================

class OperationRequest(BaseModel):
    """Request body for executing an operation."""
    operation: dict  # Operation object (type, input, filters, etc.)


class SessionResponse(BaseModel):
    """Response when creating a session."""
    session_id: str


class OperationResultResponse(BaseModel):
    """Response after executing an operation."""
    success: bool
    outputTable: dict  # TableRef object
    rowCount: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/sessions", response_model=SessionResponse)
async def create_session():
    """
    Create a new workflow execution session.
    
    Returns a session_id that should be used for all subsequent operations.
    
    Example response:
    {
      "session_id": "abc-123-def-456"
    }
    """
    session = session_manager.create_session()
    return SessionResponse(session_id=session.session_id)


@app.delete("/api/sessions/{session_id}")
async def destroy_session(session_id: str):
    """
    Destroy a session and clean up all temporary tables.
    
    IMPORTANT: This rolls back any uncommitted temp tables!
    """
    try:
        session_manager.destroy_session(session_id)
        return {"status": "ok", "message": f"Session {session_id} destroyed"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")


@app.get("/api/sessions")
async def list_sessions():
    """
    List all active sessions (useful for debugging).
    """
    return {"sessions": session_manager.list_sessions()}


@app.post("/api/sessions/{session_id}/execute", response_model=OperationResultResponse)
async def execute_operation(session_id: str, request: OperationRequest):
    """
    Execute a data operation (filter, ingest, buffer, etc.).
    
    Request body should contain an 'operation' object with:
    - type: 'ingest' | 'filter' | 'buffer' | 'join' | 'aggregate' | 'export'
    - Additional fields depending on operation type
    
    Example request (filter operation):
    {
      "operation": {
        "type": "filter",
        "input": {"kind": "persistent", "name": "water_points"},
        "filters": [
          {"column": "status", "operator": "equals", "value": "active"}
        ]
      }
    }
    
    Example response:
    {
      "success": true,
      "outputTable": {"kind": "temporary", "name": "temp_abc123", "sessionId": "..."},
      "rowCount": 42
    }
    """
    try:
        session = session_manager.get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    operation = request.operation
    op_type = operation.get("type")
    
    try:
        # Dispatch to appropriate executor based on operation type
        if op_type == "ingest":
            result = await execute_ingest_operation(session, operation)
        elif op_type == "filter":
            result = await execute_filter_operation(session, operation)
        elif op_type == "buffer":
            result = await execute_buffer_operation(session, operation)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown operation type: {op_type}"
            )
        
        return OperationResultResponse(**result)
    
    except Exception as e:
        import traceback
        return OperationResultResponse(
            success=False,
            outputTable={"kind": "temporary", "name": "error", "sessionId": session_id},
            error=str(e),
            message=traceback.format_exc()
        )


@app.post("/api/sessions/{session_id}/commit")
async def commit_table(session_id: str, tempTable: str, finalTable: str):
    """
    Commit a temporary table to make it permanent.
    
    Request body:
    {
      "tempTable": "temp_abc123",
      "finalTable": "my_results"
    }
    """
    try:
        session = session_manager.get_session(session_id)
        session.commit_table(tempTable, finalTable)
        return {"status": "ok", "message": f"Committed {tempTable} -> {finalTable}"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sessions/{session_id}/rollback")
async def rollback_session(session_id: str):
    """
    Rollback session - delete all temporary tables.
    """
    try:
        session = session_manager.get_session(session_id)
        session.rollback()
        return {"status": "ok", "message": "Session rolled back"}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")


# ============================================================================
# OPERATION EXECUTORS (implement the actual logic)
# ============================================================================

async def execute_ingest_operation(session: WorkspaceSession, op: dict) -> dict:
    """
    Execute an ingest operation.
    
    Operation format:
    {
      "type": "ingest",
      "source": {"kind": "dataset", "name": "water_points"},
      "filters": [{"column": "status", "operator": "equals", "value": "active"}],
      "destination": "optional_table_name"
    }
    """
    import geopandas as gpd
    import pandas as pd
    from pathlib import Path
    
    source = op.get("source", {})
    filters = op.get("filters", [])
    destination = op.get("destination")
    
    # Resolve source to file path
    if source.get("kind") == "dataset":
        dataset_name = source.get("name")
        # Use existing DATASETS registry from tools.py
        from .tools import DATASETS
        if dataset_name not in DATASETS:
            raise ValueError(f"Dataset '{dataset_name}' not found")
        file_path = DATASETS[dataset_name]
    else:
        raise ValueError(f"Unsupported source kind: {source.get('kind')}")
    
    # Read dataset
    gdf = gpd.read_file(file_path)
    original_count = len(gdf)
    
    # Apply filters if provided
    for filter_obj in filters:
        column = filter_obj.get("column")
        operator = filter_obj.get("operator")
        value = filter_obj.get("value")
        
        if operator == "equals":
            gdf = gdf[gdf[column] == value]
        elif operator == "in":
            gdf = gdf[gdf[column].isin(value if isinstance(value, list) else [value])]
        # Add more operators as needed
    
    # Ingest into database as temp table
    table_name = session.ingest_gdf(gdf, table_name=destination, temporary=True)
    
    return {
        "success": True,
        "outputTable": {
            "kind": "temporary",
            "name": table_name,
            "sessionId": session.session_id
        },
        "rowCount": len(gdf),
        "message": f"Ingested {len(gdf)} rows (filtered from {original_count})"
    }


async def execute_filter_operation(session: WorkspaceSession, op: dict) -> dict:
    """
    Execute a filter operation on an existing table.
    
    Operation format:
    {
      "type": "filter",
      "input": {"kind": "temporary", "name": "temp_abc123", "sessionId": "..."},
      "filters": [
        {"column": "status", "operator": "equals", "value": "active"},
        {"column": "type", "operator": "in", "value": ["well", "borehole"]}
      ],
      "destination": "optional_name"
    }
    """
    import geopandas as gpd
    import pandas as pd
    
    input_ref = op.get("input", {})
    filters = op.get("filters", [])
    destination = op.get("destination")
    
    # Read input table
    if input_ref.get("kind") == "temporary":
        table_name = input_ref.get("name")
        gdf = session.read_table(table_name)
    elif input_ref.get("kind") == "persistent":
        table_name = input_ref.get("name")
        # Read from persistent storage
        gdf = gpd.read_file(session.db_path, layer=table_name)
    else:
        raise ValueError(f"Unsupported input kind: {input_ref.get('kind')}")
    
    original_count = len(gdf)
    
    # Apply filters
    for filter_obj in filters:
        column = filter_obj.get("column")
        operator = filter_obj.get("operator")
        value = filter_obj.get("value")
        
        if operator == "equals":
            gdf = gdf[gdf[column] == value]
        elif operator == "not_equals":
            gdf = gdf[gdf[column] != value]
        elif operator == "in":
            values_list = value if isinstance(value, list) else [value]
            gdf = gdf[gdf[column].isin(values_list)]
        elif operator == "not_in":
            values_list = value if isinstance(value, list) else [value]
            gdf = gdf[~gdf[column].isin(values_list)]
        elif operator == "greater_than":
            gdf = gdf[gdf[column] > value]
        elif operator == "less_than":
            gdf = gdf[gdf[column] < value]
        elif operator == "contains":
            gdf = gdf[gdf[column].astype(str).str.contains(str(value), case=False, na=False)]
    
    # Ingest filtered result as new temp table
    output_table = session.ingest_gdf(gdf, table_name=destination, temporary=True)
    
    return {
        "success": True,
        "outputTable": {
            "kind": "temporary",
            "name": output_table,
            "sessionId": session.session_id
        },
        "rowCount": len(gdf),
        "message": f"Filtered to {len(gdf)} rows (from {original_count})"
    }


async def execute_buffer_operation(session: WorkspaceSession, op: dict) -> dict:
    """
    Execute a buffer operation (create buffer zones around geometries).
    
    Operation format:
    {
      "type": "buffer",
      "input": {"kind": "temporary", "name": "temp_abc123", "sessionId": "..."},
      "distance": 100,
      "destination": "optional_name"
    }
    """
    import geopandas as gpd
    
    input_ref = op.get("input", {})
    distance = op.get("distance")
    destination = op.get("destination")
    
    if distance is None:
        raise ValueError("Buffer operation requires 'distance' parameter")
    
    # Read input table
    if input_ref.get("kind") == "temporary":
        table_name = input_ref.get("name")
        gdf = session.read_table(table_name)
    elif input_ref.get("kind") == "persistent":
        table_name = input_ref.get("name")
        gdf = gpd.read_file(session.db_path, layer=table_name)
    else:
        raise ValueError(f"Unsupported input kind: {input_ref.get('kind')}")
    
    original_count = len(gdf)
    
    # Apply buffer
    buffered_gdf = gdf.copy()
    buffered_gdf['geometry'] = gdf.geometry.buffer(distance)
    
    # Ingest buffered result as new temp table
    output_table = session.ingest_gdf(buffered_gdf, table_name=destination, temporary=True)
    
    return {
        "success": True,
        "outputTable": {
            "kind": "temporary",
            "name": output_table,
            "sessionId": session.session_id
        },
        "rowCount": len(buffered_gdf),
        "message": f"Buffered {original_count} features by {distance} units"
    }


# ============================================================================
# LEGACY ENDPOINTS (kept for backward compatibility)
# ============================================================================


# ==================== Node Types ====================

@app.get("/api/nodes/types", response_model=List[NodeTypeInfo])
async def list_node_types():
    """List available node types with their config schemas and tools."""
    result = []
    for node_type, executor in NODE_REGISTRY.items():
        result.append(NodeTypeInfo(
            type=node_type,
            label=node_type.replace("_", " ").title(),
            description=f"{node_type} node executor",
            config_schema=executor.get_config_schema(),
            tools=executor.get_available_tools()
        ))
    return result


# ==================== Workflow CRUD ====================

@app.post("/api/workflows", response_model=WorkflowResponse, status_code=201)
async def create_workflow(workflow: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    """Create a new workflow definition."""
    # Create workflow
    db_workflow = WorkflowDB(
        name=workflow.name,
        description=workflow.description,
        meta=workflow.metadata
    )
    db.add(db_workflow)
    await db.flush()

    # Create nodes
    for node in workflow.nodes:
        db_node = NodeDB(
            id=node.id,
            workflow_id=db_workflow.id,
            type=node.type,
            label=node.label,
            position_x=node.position.get("x") if node.position else None,
            position_y=node.position.get("y") if node.position else None,
            config=node.config
        )
        db.add(db_node)

    # Create edges
    for edge in workflow.edges:
        db_edge = EdgeDB(
            id=edge.id,
            workflow_id=db_workflow.id,
            source=edge.source,
            target=edge.target,
            source_handle=edge.sourceHandle,
            target_handle=edge.targetHandle
        )
        db.add(db_edge)

    await db.commit()
    await db.refresh(db_workflow)

    return WorkflowResponse(
        id=db_workflow.id,
        name=db_workflow.name,
        description=db_workflow.description,
        nodes=[],
        edges=[],
    metadata=db_workflow.meta,
        created_at=db_workflow.created_at,
        updated_at=db_workflow.updated_at
    )


@app.get("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get workflow by ID."""
    result = await db.execute(select(WorkflowDB).where(WorkflowDB.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Fetch nodes
    nodes_result = await db.execute(select(NodeDB).where(NodeDB.workflow_id == workflow_id))
    nodes = nodes_result.scalars().all()

    # Fetch edges
    edges_result = await db.execute(select(EdgeDB).where(EdgeDB.workflow_id == workflow_id))
    edges = edges_result.scalars().all()

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        nodes=[
            {
                "id": n.id,
                "type": n.type,
                "label": n.label,
                "position": {"x": n.position_x, "y": n.position_y} if n.position_x is not None else None,
                "config": n.config
            }
            for n in nodes
        ],
        edges=[
            {
                "id": e.id,
                "source": e.source,
                "target": e.target,
                "sourceHandle": e.source_handle,
                "targetHandle": e.target_handle
            }
            for e in edges
        ],
    metadata=workflow.meta,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at
    )


@app.put("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(workflow_id: int, workflow: WorkflowUpdate, db: AsyncSession = Depends(get_db)):
    """Update workflow definition."""
    result = await db.execute(select(WorkflowDB).where(WorkflowDB.id == workflow_id))
    db_workflow = result.scalar_one_or_none()
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.name is not None:
        db_workflow.name = workflow.name
    if workflow.description is not None:
        db_workflow.description = workflow.description
    if workflow.metadata is not None:
        db_workflow.meta = workflow.metadata

    # If nodes are updated, delete old and create new (simple approach)
    if workflow.nodes is not None:
        await db.execute(NodeDB.__table__.delete().where(NodeDB.workflow_id == workflow_id))
        for node in workflow.nodes:
            db_node = NodeDB(
                id=node.id,
                workflow_id=workflow_id,
                type=node.type,
                label=node.label,
                position_x=node.position.get("x") if node.position else None,
                position_y=node.position.get("y") if node.position else None,
                config=node.config
            )
            db.add(db_node)

    # If edges are updated, delete old and create new
    if workflow.edges is not None:
        await db.execute(EdgeDB.__table__.delete().where(EdgeDB.workflow_id == workflow_id))
        for edge in workflow.edges:
            db_edge = EdgeDB(
                id=edge.id,
                workflow_id=workflow_id,
                source=edge.source,
                target=edge.target,
                source_handle=edge.sourceHandle,
                target_handle=edge.targetHandle
            )
            db.add(db_edge)

    await db.commit()
    await db.refresh(db_workflow)

    # Re-fetch to return complete response
    return await get_workflow(workflow_id, db)


@app.delete("/api/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Delete workflow."""
    result = await db.execute(select(WorkflowDB).where(WorkflowDB.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    await db.delete(workflow)
    await db.commit()


# ==================== Workflow Execution ====================

@app.post("/api/workflows/{workflow_id}/execute", response_model=ExecutionStatus)
async def execute_workflow(workflow_id: int, request: ExecutionRequest, db: AsyncSession = Depends(get_db)):
    """
    Execute a workflow.
    Creates an execution record and returns immediately (async execution).
    """
    # Verify workflow exists
    result = await db.execute(select(WorkflowDB).where(WorkflowDB.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Create execution record
    execution = ExecutionDB(
        workflow_id=workflow_id,
        status=ExecutionStatusEnum.PENDING
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # TODO: Enqueue background task (Celery/RQ/Prefect) for actual execution
    # For now, return pending status
    return ExecutionStatus(
        id=execution.id,
        workflow_id=execution.workflow_id,
        status=execution.status.value,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        error=execution.error,
        result=execution.result
    )


@app.get("/api/executions/{execution_id}", response_model=ExecutionStatus)
async def get_execution_status(execution_id: int, db: AsyncSession = Depends(get_db)):
    """Get execution status."""
    result = await db.execute(select(ExecutionDB).where(ExecutionDB.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    return ExecutionStatus(
        id=execution.id,
        workflow_id=execution.workflow_id,
        status=execution.status.value,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        error=execution.error,
        result=execution.result
    )


# ==================== Legacy endpoints (backward compat) ====================

@app.post("/workflow/run")
async def run_workflow(workflow: Workflow):
    """Legacy endpoint for workflow run (kept for backward compat)."""
    result = {"nodes": len(workflow.nodes), "edges": len(workflow.edges), "message": "received"}
    return JSONResponse(content=result)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file endpoint."""
    contents = await file.read()
    size = len(contents)
    return {"filename": file.filename, "size": size}


# Include tools router
app.include_router(tools.router)
