import traceback
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import geopandas as gpd
import pandas as pd

router = APIRouter(prefix="/tools", tags=["tools"])

# Simple dataset registry backed by sampledata folder (dev only)
SAMPLEDATA_PATH = r"C:\Repos\restFlow\backend\sampledata"
DATASETS = {
    "water_points": f"{SAMPLEDATA_PATH}\\water_points_fixed.gpkg",
    "water_lines": f"{SAMPLEDATA_PATH}\\water_lines_fixed.gpkg",
}

@router.get("/")
async def list_tools():
    return {"tools": ["ingest"]}

@router.post("/ingest")
async def run_ingest(request: Request):
    try:
        # Accept optional JSON payload: { dataset?: string, destination?: string, column?: string, values?: list, dry_run?: bool }
        payload = await request.json() if request.headers.get('content-type', '').startswith('application/json') else {}
        dataset_name = payload.get('dataset') if isinstance(payload, dict) else None
        destination = payload.get('destination') if isinstance(payload, dict) else None
        filter_column = payload.get('column') if isinstance(payload, dict) else None
        filter_values = payload.get('values') if isinstance(payload, dict) else None
        dry_run = payload.get('dry_run') if isinstance(payload, dict) else False

        from spatialite_gis import Workspace, IngestionApp, GeoDataFrameSource
        # NOTE: db_path is a dev-time hardcoded path; adjust for your environment
        db_path = r'C:\Users\jkyawkyaw\\.spatialite_databases\3waters_wk_web.sqlite'

        # helper to ingest a GeoDataFrame (already read) into destination layer name
        def ingest_gdf(gdf, dest_name=None):
            layer_name = dest_name or (gdf._get_axis_name(0) if hasattr(gdf, '_get_axis_name') else None)
            # fallback: use a generic name if dest_name not provided
            if not layer_name:
                import uuid
                layer_name = f"ingest_{uuid.uuid4().hex[:8]}"
            src = GeoDataFrameSource(gdf, layer_name)
            ia = IngestionApp(ws, src)
            ia.run()

        # helper to read, filter (if requested), and ingest from a file path
        def ingest_path(path, dest_name=None, col=None, values=None, dry_run_flag=False):
            gdf = gpd.read_file(path)
            original_shape = gdf.shape

            # apply filtering if column and values provided
            if col and values:
                # normalize to list
                if not isinstance(values, (list, tuple)):
                    values_list = [values]
                else:
                    values_list = list(values)
                values_list = [v for v in values_list if v is not None]

                # Attempt dtype-aware coercion, but prepare also lowercased string fallback
                coerced_values = []
                for v in values_list:
                    try:
                        if pd.api.types.is_integer_dtype(gdf[col].dtype):
                            coerced_values.append(int(v))
                        elif pd.api.types.is_float_dtype(gdf[col].dtype):
                            coerced_values.append(float(v))
                        elif pd.api.types.is_bool_dtype(gdf[col].dtype):
                            if isinstance(v, str):
                                lv = v.strip().lower()
                                coerced_values.append(lv in ("1", "true", "t", "yes", "y"))
                            else:
                                coerced_values.append(bool(v))
                        else:
                            coerced_values.append(str(v))
                    except Exception:
                        coerced_values.append(str(v))

                # Primary filter: exact match using dtype-coerced values
                try:
                    filtered = gdf[gdf[col].isin(coerced_values)]
                except Exception:
                    filtered = gdf.iloc[0:0]

                # If primary filter yields nothing, try case-insensitive string matching as a fallback
                if filtered.shape[0] == 0 and any(isinstance(x, str) for x in coerced_values):
                    lowered = [str(x).lower() for x in coerced_values]
                    mask = gdf[col].astype(str).str.lower().isin(lowered)
                    filtered = gdf[mask]

                gdf = filtered

            # If dry_run, return diagnostic info instead of writing
            if dry_run_flag:
                sample = gdf.head(5).to_json(orient="records")
                return {"dataset": Path(path).name, "original_shape": original_shape, "final_shape": gdf.shape, "sample": sample}

            # perform actual ingestion
            ingest_gdf(gdf, dest_name=dest_name)
            return {"dataset": Path(path).name, "original_shape": original_shape, "final_shape": gdf.shape}

        with Workspace(db_path) as ws:
            # If a specific dataset was requested, ingest only that dataset
            if dataset_name:
                path = DATASETS.get(dataset_name)
                if not path:
                    return JSONResponse(content={"error": "dataset not found"}, status_code=404)
                # use provided destination string as layer name if present and apply filtering if provided
                res = ingest_path(path, dest_name=destination, col=filter_column, values=filter_values, dry_run_flag=dry_run)
                return JSONResponse(content={"status": "ok", "result": res})
            else:
                # ingest all sample datasets (no filtering applied for bulk ingest)
                results = []
                wp = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_points_fixed.gpkg")
                wl = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_lines_fixed.gpkg")
                if dry_run:
                    results.append({"source": "water_points_fixed.gpkg", "rows": wp.shape[0]})
                    results.append({"source": "water_lines_fixed.gpkg", "rows": wl.shape[0]})
                    return JSONResponse(content={"status": "ok", "results": results})
                wp_src = GeoDataFrameSource(wp, 'water_points_fixed')
                wl_src = GeoDataFrameSource(wl, 'water_lines_fixed')
                ia = IngestionApp(ws, wp_src)
                ia.run()
                ia2 = IngestionApp(ws, wl_src)
                ia2.run()
        return JSONResponse(content={"status": "ok"})
    except Exception:
        tb = traceback.format_exc()
        return JSONResponse(content={"status": "error", "detail": tb}, status_code=500)


@router.post("/ingest-table")
async def run_ingest_table(request: Request):
    """Ingest a single dataset into a named destination table/layer.

    Expected JSON payload: { dataset?: string, table: string }
    For safety, require `table`. If no dataset is provided, return 400.
    """
    try:
        payload = await request.json() if request.headers.get('content-type', '').startswith('application/json') else {}
        dataset_name = payload.get('dataset') if isinstance(payload, dict) else None
        table = payload.get('table') or payload.get('destination') if isinstance(payload, dict) else None
        filter_column = payload.get('column') if isinstance(payload, dict) else None
        filter_values = payload.get('values') if isinstance(payload, dict) else None

        if not table:
            return JSONResponse(content={"error": "missing table name (field 'table')"}, status_code=400)

        from spatialite_gis import Workspace, IngestionApp, GeoDataFrameSource
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'

        def ingest_path(path, dest_name=None, col=None, values=None):
            gdf = gpd.read_file(path)
            original_shape = gdf.shape
            # apply filtering if column and values provided
            if col and values:
                try:
                    if not isinstance(values, (list, tuple)):
                        values_list = [values]
                    else:
                        values_list = list(values)
                    # try simple coercion fallback
                    try:
                        if pd.api.types.is_integer_dtype(gdf[col].dtype):
                            values_list = [int(v) for v in values_list]
                        elif pd.api.types.is_float_dtype(gdf[col].dtype):
                            values_list = [float(v) for v in values_list]
                        else:
                            values_list = [str(v) for v in values_list]
                    except Exception:
                        values_list = [str(v) for v in values_list]
                    filtered = gdf[gdf[col].isin(values_list)]
                    if filtered.shape[0] == 0 and any(isinstance(x, str) for x in values_list):
                        lowered = [str(x).lower() for x in values_list]
                        mask = gdf[col].astype(str).str.lower().isin(lowered)
                        filtered = gdf[mask]
                    gdf = filtered
                except Exception:
                    raise
            # always use provided dest_name when calling ingest-table
            layer_name = dest_name
            src = GeoDataFrameSource(gdf, layer_name)
            ia = IngestionApp(ws, src)
            ia.run()

        with Workspace(db_path) as ws:
            if not dataset_name:
                return JSONResponse(content={"error": "dataset is required for ingest-table"}, status_code=400)
            path = DATASETS.get(dataset_name)
            if not path:
                return JSONResponse(content={"error": "dataset not found"}, status_code=404)
            ingest_path(path, dest_name=table, col=filter_column, values=filter_values)

        return JSONResponse(content={"status": "ok"})
    except Exception:
        tb = traceback.format_exc()
        return JSONResponse(content={"status": "error", "detail": tb}, status_code=500)


@router.get("/datasets")
async def list_datasets():
    """Return available dataset names (dev helper)."""
    return {"datasets": list(DATASETS.keys())}


@router.get("/datasets/{name}/columns")
async def dataset_columns(name: str):
    """Return column names for a dataset."""
    path = DATASETS.get(name)
    if not path:
        return JSONResponse(content={"error": "dataset not found"}, status_code=404)
    try:
        gdf = gpd.read_file(path)
        return {"columns": list(gdf.columns)}
    except Exception:
        tb = traceback.format_exc()
        return JSONResponse(content={"error": tb}, status_code=500)


@router.get("/datasets/{name}/columns/{col}/values")
async def dataset_column_values(name: str, col: str):
    """Return unique values for a column (limited to 200)."""
    path = DATASETS.get(name)
    if not path:
        return JSONResponse(content={"error": "dataset not found"}, status_code=404)
    try:
        gdf = gpd.read_file(path)
        if col not in gdf.columns:
            return JSONResponse(content={"error": "column not found"}, status_code=404)
        uniques = gdf[col].dropna().unique().tolist()
        # limit result size
        if len(uniques) > 200:
            uniques = uniques[:200]
        return {"values": uniques}
    except Exception:
        tb = traceback.format_exc()
        return JSONResponse(content={"error": tb}, status_code=500)


@router.get("/destination-tables")
async def list_destination_tables():
    """
    Return all available tables from the workspace database.
    
    This includes:
    - Persistent tables (saved in SQLite)
    - Temporary tables (created during workflow execution)
    
    NOTE: In production, this would query the actual workspace.
    For dev, we read tables from the hardcoded database.
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'
        
        with Workspace(db_path) as ws:
            tables = ws.list_tables()
            return {"tables": tables}
    except Exception as e:
        print(f"[ERROR] Failed to list tables: {e}")
        # Fallback to example tables if workspace fails
        return {"tables": ["water_points_fixed", "water_lines_fixed"]}


@router.get("/tables/{table_name}/columns")
async def get_table_columns(table_name: str):
    """
    Get columns for a specific table in the workspace database.
    
    This is different from /datasets/{name}/columns which only works for
    predefined datasets. This endpoint works for ANY table in the workspace,
    including temporary tables created by workflow operations.
    
    Args:
        table_name: Name of the table (can be persistent or temporary)
    
    Returns:
        {"columns": ["column1", "column2", ...]}
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'
        
        with Workspace(db_path) as ws:
            # Read table as GeoDataFrame to get columns
            gdf = gpd.read_file(db_path, layer=table_name)
            columns = list(gdf.columns)
            return {"columns": columns}
    except Exception as e:
        print(f"[ERROR] Failed to get columns for table '{table_name}': {e}")
        return JSONResponse(
            content={"error": f"Table '{table_name}' not found or cannot be read"}, 
            status_code=404
        )


@router.get("/tables/{table_name}/columns/{col}/values")
async def get_table_column_values(table_name: str, col: str):
    """
    Get unique values for a column in a workspace table.
    
    Similar to /datasets/{name}/columns/{col}/values but works for
    actual workspace tables instead of predefined datasets.
    
    Args:
        table_name: Name of the table
        col: Name of the column
    
    Returns:
        {"values": [val1, val2, ...]} (limited to 200 unique values)
    """
    try:
        from spatialite_gis import Workspace
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'
        
        with Workspace(db_path) as ws:
            gdf = gpd.read_file(db_path, layer=table_name)
            
            if col not in gdf.columns:
                return JSONResponse(
                    content={"error": f"Column '{col}' not found in table '{table_name}'"}, 
                    status_code=404
                )
            
            uniques = gdf[col].dropna().unique().tolist()
            # Limit result size to prevent large payloads
            if len(uniques) > 200:
                uniques = uniques[:200]
            
            return {"values": uniques}
    except Exception as e:
        print(f"[ERROR] Failed to get column values: {e}")
        return JSONResponse(
            content={"error": f"Failed to read table or column"}, 
            status_code=500
        )
