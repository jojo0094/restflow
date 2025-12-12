"""Node executor implementations for different node types."""
from typing import Any, Dict, List
from .models import NodeExecutor
import geopandas as gpd
from spatialite_gis import Workspace, IngestionApp, GeoDataFrameSource


class DataLoaderNode(NodeExecutor):
    """Node for loading data from various sources."""

    async def execute(self, input_data: Any, config: Dict[str, Any]) -> Any:
        source_type = config.get("source_type", "file")
        path = config.get("path", "")

        if source_type == "gpkg":
            gdf = gpd.read_file(path)
            return {"data": gdf, "type": "geodataframe", "count": len(gdf)}
        elif source_type == "geojson":
            gdf = gpd.read_file(path)
            return {"data": gdf, "type": "geodataframe", "count": len(gdf)}
        elif source_type == "csv":
            # TODO: implement CSV loader
            return {"data": None, "type": "dataframe"}
        else:
            raise ValueError(f"Unsupported source type: {source_type}")

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return "source_type" in config and "path" in config

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "source_type": {
                    "type": "string",
                    "enum": ["gpkg", "geojson", "csv", "shp"],
                    "default": "gpkg"
                },
                "path": {"type": "string", "description": "File path"}
            },
            "required": ["source_type", "path"]
        }

    def get_available_tools(self) -> List[str]:
        return ["gpkg", "geojson", "csv", "shp"]


class IngestNode(NodeExecutor):
    """Node for ingesting geodata into Spatialite DB."""

    async def execute(self, input_data: Any, config: Dict[str, Any]) -> Any:
        db_path = config.get("db_path")
        layer_name = config.get("layer_name", "layer")

        # input_data should contain a geodataframe from upstream
        if input_data and "data" in input_data:
            gdf = input_data["data"]
            src = GeoDataFrameSource(gdf, layer_name)
            with Workspace(db_path) as ws:
                ia = IngestionApp(ws, src)
                ia.run()
            return {"status": "ok", "layer": layer_name, "count": len(gdf)}
        else:
            raise ValueError("No input data to ingest")

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return "db_path" in config

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "db_path": {"type": "string", "description": "Spatialite DB path"},
                "layer_name": {"type": "string", "default": "layer"}
            },
            "required": ["db_path"]
        }

    def get_available_tools(self) -> List[str]:
        return ["ingest"]


class TransformerNode(NodeExecutor):
    """Node for transforming data."""

    async def execute(self, input_data: Any, config: Dict[str, Any]) -> Any:
        operation = config.get("operation", "identity")

        if operation == "buffer":
            distance = config.get("distance", 10)
            if input_data and "data" in input_data:
                gdf = input_data["data"]
                buffered = gdf.copy()
                buffered["geometry"] = gdf.geometry.buffer(distance)
                return {"data": buffered, "type": "geodataframe", "count": len(buffered)}
        elif operation == "reproject":
            target_crs = config.get("target_crs", "EPSG:4326")
            if input_data and "data" in input_data:
                gdf = input_data["data"]
                reprojected = gdf.to_crs(target_crs)
                return {"data": reprojected, "type": "geodataframe", "count": len(reprojected)}
        elif operation == "filter":
            # Simple attribute filter
            field = config.get("field", "")
            value = config.get("value", "")
            if input_data and "data" in input_data:
                gdf = input_data["data"]
                filtered = gdf[gdf[field] == value]
                return {"data": filtered, "type": "geodataframe", "count": len(filtered)}

        return input_data  # identity

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return "operation" in config

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["buffer", "reproject", "filter", "identity"],
                    "default": "identity"
                },
                "distance": {"type": "number", "default": 10},
                "target_crs": {"type": "string", "default": "EPSG:4326"},
                "field": {"type": "string"},
                "value": {"type": "string"}
            },
            "required": ["operation"]
        }

    def get_available_tools(self) -> List[str]:
        return ["buffer", "reproject", "filter", "identity"]


class FilterNode(NodeExecutor):
    """Node for filtering data."""

    async def execute(self, input_data: Any, config: Dict[str, Any]) -> Any:
        condition = config.get("condition", "all")
        if input_data and "data" in input_data:
            gdf = input_data["data"]
            # Simple example: filter by bounding box or attribute
            if condition == "bbox":
                minx = config.get("minx", -180)
                miny = config.get("miny", -90)
                maxx = config.get("maxx", 180)
                maxy = config.get("maxy", 90)
                filtered = gdf.cx[minx:maxx, miny:maxy]
                return {"data": filtered, "type": "geodataframe", "count": len(filtered)}
        return input_data

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return "condition" in config

    def get_config_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "condition": {"type": "string", "enum": ["all", "bbox"], "default": "all"},
                "minx": {"type": "number"},
                "miny": {"type": "number"},
                "maxx": {"type": "number"},
                "maxy": {"type": "number"}
            },
            "required": ["condition"]
        }

    def get_available_tools(self) -> List[str]:
        return ["bbox", "all"]


# Node type registry
NODE_REGISTRY: Dict[str, NodeExecutor] = {
    "data_loader": DataLoaderNode(),
    "ingest": IngestNode(),
    "transformer": TransformerNode(),
    "filter": FilterNode(),
}
