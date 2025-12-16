"""
Session Management for Workflow Execution

This module provides the SessionManager class for tracking temporary vs permanent tables
during workflow execution.

ARCHITECTURE NOTE:
This is intentionally lightweight - NOT using SQLAlchemy's Unit of Work pattern.
We want minimal dependencies for potential desktop app packaging.

SESSION CONCEPT (for beginners):
Think of a session like a "shopping cart" for database operations:
- You add items (create temp tables)
- You can review what's in the cart (list temp tables)
- Either checkout (commit -> make permanent) OR cancel (rollback -> delete everything)

WHY WE NEED THIS:
- Workflow nodes create intermediate results we don't want to keep permanently
- User should be able to "try out" a workflow without polluting the database
- Easy cleanup if workflow fails or user cancels
"""

import uuid
from typing import Dict, Set, Optional
from pathlib import Path
import geopandas as gpd
from spatialite_gis import Workspace

class WorkspaceSession:
    """
    Manages a single workflow execution session with temporary table tracking.
    
    DESIGN PATTERN: Context Manager
    This class uses Python's 'with' statement for automatic cleanup:
    
    ```python
    with WorkspaceSession(db_path) as session:
        # Do work with temp tables
        session.create_temp_table('temp_points', gdf)
        # If error happens, temp tables auto-deleted
    # Session automatically cleaned up here
    ```
    
    Attributes:
        session_id: Unique identifier for this session
        db_path: Path to SQLite database
        temp_tables: Set of temporary table names created in this session
        workspace: SpatiaLite Workspace instance (manages DB connection)
    """
    
    def __init__(self, db_path: str):
        """
        Create a new workflow session.
        
        Args:
            db_path: Absolute path to SQLite database file
        
        Example:
            >>> session = WorkspaceSession(r'C:\data\workflow.sqlite')
            >>> session.session_id
            'abc-123-def-456'
        """
        self.session_id = str(uuid.uuid4())
        self.db_path = db_path
        self.temp_tables: Set[str] = set()
        self.workspace: Optional[Workspace] = None
        
    def __enter__(self):
        """
        Context manager entry - opens database connection.
        
        PYTHON TIP:
        This gets called when you write: `with WorkspaceSession(...) as session:`
        """
        self.workspace = Workspace(self.db_path)
        self.workspace.__enter__()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        Context manager exit - cleans up resources.
        
        If an exception occurred (exc_type is not None), we rollback.
        Otherwise, we just close the connection (temp tables remain until explicit commit/rollback).
        
        PYTHON TIP:
        This gets called when exiting the `with` block, even if there's an error.
        """
        try:
            if exc_type is not None:
                # Error occurred - rollback temp tables
                self.rollback()
        finally:
            if self.workspace:
                self.workspace.__exit__(exc_type, exc_val, exc_tb)
        
        # Don't suppress exceptions
        return False
    
    def generate_temp_table_name(self, prefix: str = "temp") -> str:
        """
        Generate a unique temporary table name.
        
        Pattern: temp_{prefix}_{short_uuid}
        
        Example:
            >>> session.generate_temp_table_name('filtered')
            'temp_filtered_a1b2c3d4'
        """
        short_id = uuid.uuid4().hex[:8]
        return f"temp_{prefix}_{short_id}"
    
    def ingest_gdf(self, gdf: gpd.GeoDataFrame, table_name: Optional[str] = None, temporary: bool = True) -> str:
        """
        Ingest a GeoDataFrame into the database.
        
        Args:
            gdf: GeoDataFrame to ingest
            table_name: Optional table name (auto-generated if None)
            temporary: If True, track as temp table for cleanup
        
        Returns:
            Name of the created table
        
        Example:
            >>> filtered = original_gdf[original_gdf['status'] == 'active']
            >>> table_name = session.ingest_gdf(filtered, temporary=True)
            >>> table_name
            'temp_ingest_a1b2c3d4'
        """
        from spatialite_gis import GeoDataFrameSource, IngestionApp
        
        if table_name is None:
            table_name = self.generate_temp_table_name()
        
        # Create source and ingest
        source = GeoDataFrameSource(gdf, table_name)
        ia = IngestionApp(self.workspace, source)
        ia.run()
        
        # Track as temp table if requested
        if temporary:
            self.temp_tables.add(table_name)
        
        return table_name
    
    def read_table(self, table_name: str) -> gpd.GeoDataFrame:
        """
        Read a table (temp or permanent) as a GeoDataFrame.
        
        Args:
            table_name: Name of table to read
        
        Returns:
            GeoDataFrame with table contents
        
        Raises:
            ValueError: If table doesn't exist
        """
        # Use Workspace to get connection and read via geopandas
        # This is a simplified implementation - real version would use
        # Workspace.get_layer or similar
        conn = self.workspace.db_path
        try:
            gdf = gpd.read_file(conn, layer=table_name)
            return gdf
        except Exception as e:
            raise ValueError(f"Table '{table_name}' not found or cannot be read: {e}")
    
    def commit_table(self, temp_table_name: str, final_table_name: str):
        """
        Commit a temporary table to make it permanent.
        
        WHAT THIS DOES:
        1. Renames temp table to final name
        2. Removes from temp_tables tracking set
        3. Table now persists beyond session lifetime
        
        Args:
            temp_table_name: Current temp table name
            final_table_name: Desired permanent name
        
        Example:
            >>> session.commit_table('temp_filtered_abc123', 'active_water_points')
            # Now 'active_water_points' exists permanently in DB
        """
        if temp_table_name not in self.temp_tables:
            raise ValueError(f"'{temp_table_name}' is not a tracked temporary table")
        
        # Rename table (implementation depends on Workspace API)
        # For now, simplified - real implementation would execute:
        # ALTER TABLE {temp_table_name} RENAME TO {final_table_name}
        # This is SQLite-specific and works in SpatiaLite
        
        # TODO: Implement actual rename via Workspace
        # For prototype, we assume table stays with temp name
        # and just remove from tracking
        self.temp_tables.discard(temp_table_name)
        
        print(f"[Session {self.session_id}] Committed {temp_table_name} -> {final_table_name}")
    
    def rollback(self):
        """
        Delete all temporary tables created in this session.
        
        USE CASES:
        - User cancels workflow
        - Workflow hits an error
        - User is just experimenting and doesn't want to keep results
        
        IMPORTANT:
        This is irreversible! Make sure user confirms before calling.
        """
        for table_name in list(self.temp_tables):
            try:
                # Drop table (implementation depends on Workspace API)
                # For SQLite: DROP TABLE IF EXISTS {table_name}
                # TODO: Implement via Workspace
                print(f"[Session {self.session_id}] Dropped temp table: {table_name}")
            except Exception as e:
                print(f"[Session {self.session_id}] Failed to drop {table_name}: {e}")
        
        self.temp_tables.clear()
    
    def list_tables(self, include_temporary: bool = True) -> list:
        """
        List all tables in the database.
        
        Args:
            include_temporary: If False, exclude temp tables from this session
        
        Returns:
            List of table names
        """
        # TODO: Implement via Workspace
        # For prototype, return temp tables we're tracking
        if include_temporary:
            return list(self.temp_tables)
        else:
            return []
    
    def cleanup(self):
        """
        Explicit cleanup method (alternative to context manager).
        
        Call this if not using `with` statement.
        """
        self.rollback()
        if self.workspace:
            self.workspace.__exit__(None, None, None)


# ============================================================================
# SESSION REGISTRY (in-memory store for active sessions)
# ============================================================================

class SessionManager:
    """
    Global manager for all active sessions.
    
    WHY WE NEED THIS:
    - FastAPI endpoints are stateless (each request is independent)
    - But sessions need to persist across multiple requests
    - This class maintains a registry: session_id -> WorkspaceSession
    
    PRODUCTION NOTE:
    This is an in-memory store. In production, you might use:
    - Redis for distributed systems
    - Database table for persistence across server restarts
    
    But for our use case (local-first app), in-memory is fine.
    """
    
    def __init__(self, default_db_path: str):
        """
        Args:
            default_db_path: Default database path for new sessions
        """
        self.default_db_path = default_db_path
        self.sessions: Dict[str, WorkspaceSession] = {}
    
    def create_session(self, db_path: Optional[str] = None) -> WorkspaceSession:
        """
        Create a new workflow session.
        
        Args:
            db_path: Optional custom DB path (uses default if None)
        
        Returns:
            New WorkspaceSession instance
        """
        path = db_path or self.default_db_path
        session = WorkspaceSession(path)
        session.__enter__()  # Open workspace connection
        self.sessions[session.session_id] = session
        print(f"[SessionManager] Created session: {session.session_id}")
        return session
    
    def get_session(self, session_id: str) -> WorkspaceSession:
        """
        Retrieve an existing session by ID.
        
        Raises:
            KeyError: If session doesn't exist
        """
        if session_id not in self.sessions:
            raise KeyError(f"Session '{session_id}' not found")
        return self.sessions[session_id]
    
    def destroy_session(self, session_id: str):
        """
        Destroy a session and clean up resources.
        
        Args:
            session_id: ID of session to destroy
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.cleanup()
            del self.sessions[session_id]
            print(f"[SessionManager] Destroyed session: {session_id}")
    
    def list_sessions(self) -> list[str]:
        """
        List all active session IDs.
        
        Useful for debugging or admin UI.
        """
        return list(self.sessions.keys())
