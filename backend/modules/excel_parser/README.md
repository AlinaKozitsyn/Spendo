# ExcelParserAgent — Module README

## Purpose
Reads an Israeli credit-card Excel report (`.xlsx`) and returns a list of
canonical `Transaction` objects.

## Public API

```python
from backend.modules.excel_parser import ExcelParserAgent

agent = ExcelParserAgent(file_path="my_report.xlsx")
result = agent.parse()   # → ParseResult

print(result.transactions)   # list[Transaction]
print(result.skipped_rows)   # int
print(result.errors)         # list[str]
```

## Configuration

The default column map targets Hebrew column headers common in Israeli bank exports:

| Field            | Default Excel Header |
|------------------|----------------------|
| transaction_date | תאריך עסקה           |
| merchant_name    | שם בית עסק           |
| amount           | סכום עסקה            |
| description      | פירוט                |
| currency         | מטבע                 |

Override via `column_map` argument if your bank uses different headers.

## Dependencies
- `pandas`
- `openpyxl`

## Tests
```bash
pytest backend/modules/excel_parser/tests/unit/
```
