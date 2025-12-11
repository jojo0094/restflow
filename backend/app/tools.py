import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import geopandas as gpd

router = APIRouter(prefix="/tools", tags=["tools"])

@router.get("/")
async def list_tools():
    return {"tools": ["ingest"]}

@router.post("/ingest")
async def run_ingest():
    try:
        # Hardcoded paths as in Draft/ingest.py
        from spatialite_gis import Workspace, IngestionApp, GeoDataFrameSource
        db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'
        wp = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_points_fixed.gpkg")
        wl = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_lines_fixed.gpkg")
        wp_src = GeoDataFrameSource(wp, 'water_points_fixed')
        wl_src = GeoDataFrameSource(wl, 'water_lines_fixed')
        with Workspace(db_path) as ws:
            ia = IngestionApp(ws, wp_src)
            ia.run()
            ia2 = IngestionApp(ws, wl_src)
            ia2.run()
        return JSONResponse(content={"status": "ok"})
    except Exception:
        tb = traceback.format_exc()
        return JSONResponse(content={"status": "error", "detail": tb}, status_code=500)
