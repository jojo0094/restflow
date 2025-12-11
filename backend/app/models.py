from pydantic import BaseModel
from typing import List, Dict, Any

class Node(BaseModel):
    id: str
    data: Dict[str, Any]
    position: Dict[str, float]

class Edge(BaseModel):
    id: str
    source: str
    target: str

class Workflow(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
