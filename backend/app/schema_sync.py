"""Brings an existing database up to the current models at startup.

Only additive changes happen here: new tables, new columns and new indexes.
Nothing is renamed or dropped, and every failure is logged rather than ignored.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import Base
from app import models  # noqa: F401  (registers every table on Base)

logger = logging.getLogger("flyera.schema")

_EXTRA_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_deliveries_assignment ON deliveries(assignment_id)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_client ON deliveries(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_upi ON deliveries(upi_reference)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_assignments_driver ON assignments(driver_id)",
    "CREATE INDEX IF NOT EXISTS idx_assignments_helper ON assignments(helper_id)",
    "CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status)",
    "CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date)",
    "CREATE INDEX IF NOT EXISTS idx_clients_route ON clients(route_id)",
    "CREATE INDEX IF NOT EXISTS idx_allocations_assignment ON allocations(assignment_id)",
    "CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id)",
]


def _default_clause(column) -> str:
    default = getattr(column.default, "arg", None)
    if column.default is None or callable(default):
        return ""
    if isinstance(default, bool):
        return " DEFAULT TRUE" if default else " DEFAULT FALSE"
    if isinstance(default, (int, float)):
        return f" DEFAULT {default}"
    escaped = str(default).replace("'", "''")
    return f" DEFAULT '{escaped}'"


def sync_schema(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    for table in Base.metadata.sorted_tables:
        existing = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            column_type = column.type.compile(dialect=engine.dialect)
            statement = f'ALTER TABLE {table.name} ADD COLUMN {column.name} {column_type}{_default_clause(column)}'
            try:
                with engine.begin() as conn:
                    conn.execute(text(statement))
                logger.info("Added column %s.%s", table.name, column.name)
            except Exception:
                logger.exception("Could not add column %s.%s", table.name, column.name)

    for statement in _EXTRA_INDEXES:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception:
            logger.exception("Could not create index: %s", statement)
