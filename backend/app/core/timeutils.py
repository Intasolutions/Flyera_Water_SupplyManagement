"""Timestamps are stored as naive UTC. Business days and API output are converted here."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple

from app.core.config import UTC_OFFSET_MINUTES

_OFFSET = timedelta(minutes=UTC_OFFSET_MINUTES)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def utc_iso(value: Optional[datetime]) -> Optional[str]:
    """ISO text with a Z suffix, so browsers show the correct local time."""
    if value is None:
        return None
    return f"{to_naive_utc(value).isoformat()}Z"


def to_local(value: datetime) -> datetime:
    return to_naive_utc(value) + _OFFSET


def local_today() -> date:
    return to_local(utcnow()).date()


def local_day_bounds(day: date) -> Tuple[datetime, datetime]:
    """UTC start and end of one business day."""
    return datetime.combine(day, time.min) - _OFFSET, datetime.combine(day, time.max) - _OFFSET


def parse_day(text: Optional[str]) -> Optional[date]:
    if not text:
        return None
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def local_range(start: Optional[str], end: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """UTC bounds for a YYYY-MM-DD business-day range. Unparseable or missing sides stay open."""
    start_day, end_day = parse_day(start), parse_day(end)
    return (
        local_day_bounds(start_day)[0] if start_day else None,
        local_day_bounds(end_day)[1] if end_day else None,
    )
