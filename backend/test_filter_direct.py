"""
Test filter operation directly without server
"""
import sys
sys.path.insert(0, r'C:\Repos\restFlow\backend')

from app.session import WorkspaceSession

# Create session
db_path = r'C:\Users\jkyawkyaw\.spatialite_databases\3waters_wk_web.sqlite'

with WorkspaceSession(db_path) as session:
    print(f"Session ID: {session.session_id}")
    
    # Read table
    table_name = "water_points_fixed"
    print(f"\nReading table: {table_name}")
    gdf = session.read_table(table_name)
    print(f"Loaded {len(gdf)} rows")
    
    # Check status column
    print(f"\nStatus column dtype: {gdf['status'].dtype}")
    print(f"Status column unique values: {gdf['status'].unique()[:10]}")
    
    # Test filter manually
    print(f"\n=== Testing filter ===")
    filter_values = ['Existing', 'Private']
    print(f"Filter values: {filter_values}")
    
    # Direct filter test
    filtered = gdf[gdf['status'].isin(filter_values)]
    print(f"Direct isin filter: {len(filtered)} rows")
    
    # Test with apply_robust_filter
    from app.main import apply_robust_filter
    filtered2 = apply_robust_filter(gdf, 'status', filter_values)
    print(f"apply_robust_filter: {len(filtered2)} rows")
    
    # Ingest as temp table
    print(f"\n=== Testing ingest ===")
    output_table = session.ingest_gdf(filtered2, table_name="test_filtered", temporary=True)
    print(f"Ingested as: {output_table}")
    
    # Read it back
    result = session.read_table(output_table)
    print(f"Read back: {len(result)} rows")
