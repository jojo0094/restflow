# Filter Bug Fix - December 16, 2025

## Problem

When filtering by column values, the operation returns **0 rows (empty result)** even though the legacy version worked correctly.

### Symptoms:
- User selects column values from checkboxes
- Runs ingest or filter operation
- Result: 0 rows (empty)
- Legacy `/tools/ingest` endpoint worked fine with same data

## Root Cause

The new `execute_ingest_operation` and `execute_filter_operation` functions used **naive filtering**:

```python
# ❌ NAIVE FILTERING - Fails on type mismatches
if operator == "in":
    gdf = gdf[gdf[column].isin(value)]
```

This fails when:
- **Type mismatch**: Frontend sends string `"123"`, but column is integer `123`
- **Case sensitivity**: Frontend sends `"Active"`, but data has `"active"`
- **Null values**: Not handled properly

### Why Legacy Worked

The legacy `/tools/ingest` endpoint in `tools.py` had **robust filtering logic**:

```python
# ✅ ROBUST FILTERING (from tools.py)
# 1. Type coercion
if pd.api.types.is_integer_dtype(gdf[col].dtype):
    coerced_values.append(int(v))
elif pd.api.types.is_float_dtype(gdf[col].dtype):
    coerced_values.append(float(v))
# ... etc

# 2. Primary filter with coerced values
filtered = gdf[gdf[col].isin(coerced_values)]

# 3. Fallback to case-insensitive string matching
if filtered.shape[0] == 0 and any(isinstance(x, str) for x in coerced_values):
    lowered = [str(x).lower() for x in coerced_values]
    mask = gdf[col].astype(str).str.lower().isin(lowered)
    filtered = gdf[mask]
```

## Solution

### 1. Created Shared `apply_robust_filter()` Function

Added to `backend/app/main.py`:

```python
def apply_robust_filter(gdf: 'gpd.GeoDataFrame', column: str, values: list) -> 'gpd.GeoDataFrame':
    """
    Apply robust filtering with type coercion and case-insensitive fallback.
    
    This matches the legacy logic from tools.py to handle:
    - Type mismatches (e.g., string values vs int column)
    - Case-insensitive string matching
    - Null value handling
    
    Args:
        gdf: GeoDataFrame to filter
        column: Column name to filter on
        values: List of values to match
    
    Returns:
        Filtered GeoDataFrame
    """
    import pandas as pd
    
    # Normalize to list and remove None values
    if not isinstance(values, (list, tuple)):
        values_list = [values]
    else:
        values_list = list(values)
    values_list = [v for v in values_list if v is not None]
    
    if not values_list:
        # No values to filter on - return empty
        return gdf.iloc[0:0]
    
    # Attempt dtype-aware coercion
    coerced_values = []
    for v in values_list:
        try:
            if pd.api.types.is_integer_dtype(gdf[column].dtype):
                coerced_values.append(int(v))
            elif pd.api.types.is_float_dtype(gdf[column].dtype):
                coerced_values.append(float(v))
            elif pd.api.types.is_bool_dtype(gdf[column].dtype):
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
        filtered = gdf[gdf[column].isin(coerced_values)]
    except Exception:
        filtered = gdf.iloc[0:0]
    
    # If primary filter yields nothing, try case-insensitive string matching as fallback
    if filtered.shape[0] == 0 and any(isinstance(x, str) for x in coerced_values):
        lowered = [str(x).lower() for x in coerced_values]
        mask = gdf[column].astype(str).str.lower().isin(lowered)
        filtered = gdf[mask]
    
    return filtered
```

### 2. Updated `execute_ingest_operation`

```python
# Apply filters if provided (using robust filtering logic)
for filter_obj in filters:
    column = filter_obj.get("column")
    operator = filter_obj.get("operator")
    value = filter_obj.get("value")
    
    if operator == "equals":
        # ✅ Use robust filter for single value
        gdf = apply_robust_filter(gdf, column, [value])
    elif operator == "in":
        # ✅ Use robust filter for multiple values
        values_list = value if isinstance(value, list) else [value]
        gdf = apply_robust_filter(gdf, column, values_list)
    elif operator == "not_in":
        values_list = value if isinstance(value, list) else [value]
        filtered = apply_robust_filter(gdf, column, values_list)
        # Invert the filter (keep rows NOT in the filtered set)
        gdf = gdf[~gdf.index.isin(filtered.index)]
```

### 3. Updated `execute_filter_operation`

```python
# Apply filters (using robust filtering for 'in' and 'equals' operators)
for filter_obj in filters:
    column = filter_obj.get("column")
    operator = filter_obj.get("operator")
    value = filter_obj.get("value")
    
    if operator == "equals":
        # ✅ Use robust filter
        gdf = apply_robust_filter(gdf, column, [value])
    elif operator == "not_equals":
        filtered = apply_robust_filter(gdf, column, [value])
        gdf = gdf[~gdf.index.isin(filtered.index)]
    elif operator == "in":
        # ✅ Use robust filter
        values_list = value if isinstance(value, list) else [value]
        gdf = apply_robust_filter(gdf, column, values_list)
    elif operator == "not_in":
        values_list = value if isinstance(value, list) else [value]
        filtered = apply_robust_filter(gdf, column, values_list)
        gdf = gdf[~gdf.index.isin(filtered.index)]
    elif operator == "greater_than":
        gdf = gdf[gdf[column] > value]
    elif operator == "less_than":
        gdf = gdf[gdf[column] < value]
    elif operator == "contains":
        gdf = gdf[gdf[column].astype(str).str.contains(str(value), case=False, na=False)]
```

## How Robust Filtering Works

### Step 1: Type Coercion
```python
# If column is integer, convert string "123" → int 123
if pd.api.types.is_integer_dtype(gdf[column].dtype):
    coerced_values.append(int(v))
```

### Step 2: Primary Filter
```python
# Try exact match with coerced values
filtered = gdf[gdf[column].isin(coerced_values)]
```

### Step 3: Fallback (Case-Insensitive)
```python
# If no matches, try lowercase string comparison
if filtered.shape[0] == 0:
    lowered = [str(x).lower() for x in coerced_values]
    mask = gdf[column].astype(str).str.lower().isin(lowered)
    filtered = gdf[mask]
```

## Testing

### Before Fix:
```
Column: status (integer dtype)
Selected values: ["1", "2", "3"] (strings from UI)
Result: 0 rows ❌ (type mismatch)
```

### After Fix:
```
Column: status (integer dtype)
Selected values: ["1", "2", "3"] (strings from UI)
→ Coerced to: [1, 2, 3] (integers)
Result: Correct rows ✅
```

### Edge Cases Handled:

1. **String → Integer**
   - UI sends `"123"` (string)
   - Column is `int64`
   - Coerced to `123` ✅

2. **Case Insensitive**
   - UI sends `"Active"` (capital A)
   - Data has `"active"` (lowercase a)
   - Fallback matches ✅

3. **Boolean Strings**
   - UI sends `"true"`, `"1"`, `"yes"`
   - Column is `bool`
   - All coerced to `True` ✅

4. **Null Values**
   - Filters out `None` values before processing ✅

## Next Steps

- [x] Add robust filtering to ingest operation
- [x] Add robust filtering to filter operation
- [ ] Consider extracting to shared utility module (`backend/app/utils/filtering.py`)
- [ ] Add unit tests for edge cases
- [ ] Document supported operators in API schema

## Performance Note

The fallback case-insensitive matching adds minimal overhead:
- Only triggered when primary filter returns 0 rows
- Only for string values
- Most queries will use the fast primary filter path
