
from spatialite_gis import ReaderApp, Workspace, IngestionApp, GeoDataFrameSource
# import restapi
from stormcatchments import network
from restgdf.geofix import ExplodeFix
import os
import geopandas as gpd
import pandas

#read a spatialite database
db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'
ws = Workspace(db_path)
water_points = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_points_fixed.gpkg")
water_lines = gpd.read_file(r"C:\Repos\restFlow\backend\sampledata\water_lines_fixed.gpkg")
water_points = GeoDataFrameSource(water_points, 'water_points_fixed')
water_lines = GeoDataFrameSource(water_lines, 'water_lines_fixed')

with ws:
    ingest_app = IngestionApp(ws, water_points)
    ingest_app.run()
    ingest_app_poho = IngestionApp(ws, water_lines)
    ingest_app_poho.run()
    print("Ingestion complete.")