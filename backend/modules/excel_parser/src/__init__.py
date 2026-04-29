"""
excel_parser/src/__init__.py
============================
Public surface of the excel_parser module.

Usage from other modules:
    from backend.modules.excel_parser import ExcelParserAgent
"""

from .parser import COLUMN_ALIASES, ExcelParserAgent

__all__ = ["ExcelParserAgent", "COLUMN_ALIASES"]
