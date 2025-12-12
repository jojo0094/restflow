"""Main FastAPI application with workflow CRUD and execution endpoints."""
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from .models import (
    Workflow, WorkflowCreate, WorkflowResponse, WorkflowUpdate,
    ExecutionRequest, ExecutionStatus, NodeTypeInfo
)
from .database_models import WorkflowDB, NodeDB, EdgeDB, ExecutionDB, ExecutionStatusEnum
from .db import get_db, init_db
from .executors import NODE_REGISTRY
from . import tools

app = FastAPI(title="restFlow backend", version="0.1.0")

# CORS middleware for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    await init_db()


@app.get("/")
async def health():
    return {"status": "ok", "version": "0.1.0"}


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
