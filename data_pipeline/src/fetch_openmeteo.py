from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import requests


ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "surface_pressure",
    "precipitation",
    "rain",
]


@dataclass
class BridgeLocation:
    bridge_id: str
    latitude: float
    longitude: float
    name: str | None = None


def load_bridge_locations(path: Path) -> list[BridgeLocation]:
    df = pd.read_csv(path)

    required = {"bridge_id", "latitude", "longitude"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"В bridges.csv отсутствуют обязательные колонки: {missing}")

    records: list[BridgeLocation] = []
    for _, row in df.iterrows():
        records.append(
            BridgeLocation(
                bridge_id=str(row["bridge_id"]),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                name=(
                    str(row["name"])
                    if "name" in df.columns and pd.notna(row.get("name"))
                    else None
                ),
            )
        )
    return records


def split_by_year(
    start_date: pd.Timestamp, end_date: pd.Timestamp
) -> list[tuple[str, str]]:
    """
    Делит период на чанки по годам.
    Это делает запросы к API надёжнее.
    """
    chunks: list[tuple[str, str]] = []
    current = pd.Timestamp(start_date.date())

    while current <= end_date:
        year_end = pd.Timestamp(year=current.year, month=12, day=31)
        chunk_end = min(year_end, pd.Timestamp(end_date.date()))

        chunks.append((current.strftime("%Y-%m-%d"), chunk_end.strftime("%Y-%m-%d")))
        current = chunk_end + pd.Timedelta(days=1)

    return chunks


def fetch_weather_chunk(
    bridge: BridgeLocation,
    start_date: str,
    end_date: str,
    timeout: int = 60,
) -> pd.DataFrame:
    params = {
        "latitude": bridge.latitude,
        "longitude": bridge.longitude,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(HOURLY_VARS),
        "timezone": "UTC",
    }

    response = requests.get(ARCHIVE_URL, params=params, timeout=timeout)
    response.raise_for_status()
    payload = response.json()

    if "hourly" not in payload or "time" not in payload["hourly"]:
        raise ValueError(
            f"Open-Meteo не вернул почасовые данные для bridge_id={bridge.bridge_id}, "
            f"period={start_date}..{end_date}"
        )

    hourly = payload["hourly"]
    df = pd.DataFrame({"timestamp": pd.to_datetime(hourly["time"], utc=True)})

    for var in HOURLY_VARS:
        if var in hourly:
            df[var] = hourly[var]
        else:
            df[var] = pd.NA

    df["bridge_id"] = bridge.bridge_id
    df["latitude"] = bridge.latitude
    df["longitude"] = bridge.longitude
    if bridge.name is not None:
        df["bridge_name"] = bridge.name

    return df


def fetch_weather_for_range(
    bridge: BridgeLocation,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
) -> pd.DataFrame:
    chunks = split_by_year(start_date, end_date)
    frames: list[pd.DataFrame] = []

    for chunk_start, chunk_end in chunks:
        print(
            f"[INFO] Fetch weather for bridge_id={bridge.bridge_id} "
            f"from {chunk_start} to {chunk_end}"
        )
        frame = fetch_weather_chunk(bridge, chunk_start, chunk_end)
        frames.append(frame)
        time.sleep(0.3)

    if not frames:
        return pd.DataFrame()

    result = pd.concat(frames, ignore_index=True)
    result = result.drop_duplicates(subset=["bridge_id", "timestamp"]).sort_values(
        ["bridge_id", "timestamp"]
    )
    result = result.reset_index(drop=True)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Загрузка погодных данных из Open-Meteo."
    )
    parser.add_argument(
        "--bridges", required=True, help="Путь к CSV с координатами мостов"
    )
    parser.add_argument(
        "--start-date", required=True, help="Начальная дата в формате YYYY-MM-DD"
    )
    parser.add_argument(
        "--end-date", required=True, help="Конечная дата в формате YYYY-MM-DD"
    )
    parser.add_argument("--output", required=True, help="Путь к выходному CSV")
    args = parser.parse_args()

    bridges_path = Path(args.bridges)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bridges = load_bridge_locations(bridges_path)
    start_date = pd.Timestamp(args.start_date)
    end_date = pd.Timestamp(args.end_date)

    frames: list[pd.DataFrame] = []
    for bridge in bridges:
        try:
            df_bridge = fetch_weather_for_range(bridge, start_date, end_date)
            frames.append(df_bridge)
        except Exception as exc:
            print(
                f"[WARN] Не удалось получить погоду для bridge_id={bridge.bridge_id}: {exc}"
            )

    if not frames:
        raise RuntimeError("Не удалось загрузить погодные данные ни для одного моста.")

    weather = pd.concat(frames, ignore_index=True)
    weather = weather.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)
    weather.to_csv(output_path, index=False)

    print(f"[OK] Weather dataset saved to: {output_path}")
    print(f"[INFO] Rows: {len(weather)}")
    print(f"[INFO] Bridges: {weather['bridge_id'].nunique()}")


if __name__ == "__main__":
    main()
