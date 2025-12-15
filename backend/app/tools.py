import traceback
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
        # Accept optional JSON payload: { dataset?: string, destination?: string, column?: string, values?: list }
        payload = await request.json() if request.headers.get('content-type', '').startswith('application/json') else {}
        dataset_name = payload.get('dataset') if isinstance(payload, dict) else None
        destination = payload.get('destination') if isinstance(payload, dict) else None
        filter_column = payload.get('column') if isinstance(payload, dict) else None
        filter_values = payload.get('values') if isinstance(payload, dict) else None

        from spatialite_gis import Workspace, IngestionApp, GeoDataFrameSource
        # NOTE: db_path is a dev-time hardcoded path; adjust for your environment
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'

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
        def ingest_path(path, dest_name=None, col=None, values=None):
            gdf = gpd.read_file(path)
            # apply filtering if column and values provided
            if col and values:
                try:
                    # ensure values is a list
                    if not isinstance(values, (list, tuple)):
                        values_list = [values]
                    else:
                        values_list = list(values)
                    # normalize whitespace and strip
                    values_list = [v.strip() if isinstance(v, str) else v for v in values_list]
                    # attempt to coerce values to column dtype to avoid mismatches (e.g. numeric columns)
                    col_series = gdf[col]
                    try:
                        if pd.api.types.is_integer_dtype(col_series.dtype):
                            coerced = []
                            for v in values_list:
                                try:
                                    coerced.append(int(v))
                                except Exception:
                                    # skip values that can't be converted
                                    pass
                            values_list = coerced
                        elif pd.api.types.is_float_dtype(col_series.dtype):
                            coerced = []
                            for v in values_list:
                                try:
                                    coerced.append(float(v))
                                except Exception:
                                    pass
                            values_list = coerced
                        elif pd.api.types.is_bool_dtype(col_series.dtype):
                            def to_bool(x):
                                if isinstance(x, bool):
                                    return x
                                if isinstance(x, str):
                                    return x.lower() in ("1", "true", "t", "yes", "y")
                                return bool(x)
                            values_list = [to_bool(v) for v in values_list]
                        else:
                            values_list = [str(v) for v in values_list]
                    except Exception:
                        # if coercion fails, fall back to string comparison
                        values_list = [str(v) for v in values_list]
                    gdf = gdf[gdf[col].isin(values_list)]
                except Exception:
                    # if filtering fails, raise to return error to client
                    raise
            # if resulting gdf is empty, still proceed (ingest may create empty table), but we inform
            ingest_gdf(gdf, dest_name=dest_name)

        with Workspace(db_path) as ws:
            # If a specific dataset was requested, ingest only that dataset
            if dataset_name:
                path = DATASETS.get(dataset_name)
                if not path:
                    return JSONResponse(content={"error": "dataset not found"}, status_code=404)
                # use provided destination string as layer name if present and apply filtering if provided
                ingest_path(path, dest_name=destination, col=filter_column, values=filter_values)
            else:
                # ingest all sample datasets (no filtering applied for bulk ingest)
                wp = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_points_fixed.gpkg")
                wl = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_lines_fixed.gpkg")
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
            # apply filtering if column and values provided
            if col and values:
                try:
                    if not isinstance(values, (list, tuple)):
                        values_list = [values]
                    else:
                        values_list = list(values)
                    gdf = gdf[gdf[col].isin(values_list)]
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
    """Return example destination table names for ingest/destination selection."""
    # For dev, return a small static list
    return {"tables": ["water_points_ingested", "water_lines_ingested", "combined_features"]}
