from __future__ import annotations

import argparse
import math
from pathlib import Path

import pandas as pd


def normalize_bridge_id(series: pd.Series) -> pd.Series:
    """
    Приводит bridge_id к единому строковому виду:
    1 -> "1"
    1.0 -> "1"
    "1" -> "1"
    """
    numeric = pd.to_numeric(series, errors="coerce")
    result = series.astype(str).str.strip()

    mask = numeric.notna()
    result.loc[mask] = numeric.loc[mask].astype("Int64").astype(str)

    return result


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["day_of_year"] = df["timestamp"].dt.dayofyear
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    df["hour_sin"] = df["hour"].apply(lambda x: math.sin(2 * math.pi * x / 24))
    df["hour_cos"] = df["hour"].apply(lambda x: math.cos(2 * math.pi * x / 24))

    df["day_of_year_sin"] = df["day_of_year"].apply(
        lambda x: math.sin(2 * math.pi * x / 365)
    )
    df["day_of_year_cos"] = df["day_of_year"].apply(
        lambda x: math.cos(2 * math.pi * x / 365)
    )

    return df


def resample_water_level_to_hourly(base: pd.DataFrame) -> pd.DataFrame:
    """
    Агрегирует исходные измерения уровня воды до почасового ряда.
    Для каждого моста и часа берётся среднее значение water_level.
    """
    base = base.copy()
    base["timestamp_hour"] = base["timestamp"].dt.floor("h")

    hourly = (
        base.groupby(["bridge_id", "timestamp_hour"], as_index=False)
        .agg(
            water_level=("water_level", "mean"),
            measurements_in_hour=("water_level", "size"),
        )
        .rename(columns={"timestamp_hour": "timestamp"})
    )

    hourly = hourly.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)
    return hourly


def add_lag_and_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)

    group = df.groupby("bridge_id", group_keys=False)

    for lag in [1, 3, 6, 12, 24]:
        df[f"water_level_lag_{lag}h"] = group["water_level"].shift(lag)

    df["water_level_diff_1h"] = df["water_level"] - df["water_level_lag_1h"]
    df["water_level_diff_6h"] = df["water_level"] - df["water_level_lag_6h"]
    df["water_level_diff_24h"] = df["water_level"] - df["water_level_lag_24h"]

    shifted = group["water_level"].shift(1)

    df["water_level_roll_mean_6h"] = (
        shifted.groupby(df["bridge_id"])
        .rolling(window=6, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    df["water_level_roll_mean_24h"] = (
        shifted.groupby(df["bridge_id"])
        .rolling(window=24, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    df["water_level_roll_std_24h"] = (
        shifted.groupby(df["bridge_id"])
        .rolling(window=24, min_periods=2)
        .std()
        .reset_index(level=0, drop=True)
    )

    df["water_level_roll_max_24h"] = (
        shifted.groupby(df["bridge_id"])
        .rolling(window=24, min_periods=1)
        .max()
        .reset_index(level=0, drop=True)
    )

    return df


def add_weather_aggregates(weather: pd.DataFrame) -> pd.DataFrame:
    weather = weather.copy()
    weather = weather.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)

    group = weather.groupby("bridge_id", group_keys=False)

    weather["precipitation_1h"] = weather["precipitation"]

    weather["precipitation_6h"] = (
        group["precipitation"]
        .rolling(window=6, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    weather["precipitation_12h"] = (
        group["precipitation"]
        .rolling(window=12, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    weather["precipitation_24h"] = (
        group["precipitation"]
        .rolling(window=24, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    weather["precipitation_72h"] = (
        group["precipitation"]
        .rolling(window=72, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    weather["precipitation_intensity_6h"] = weather["precipitation_6h"] / 6.0

    weather["temperature_6h_mean"] = (
        group["temperature_2m"]
        .rolling(window=6, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    weather["temperature_24h_mean"] = (
        group["temperature_2m"]
        .rolling(window=24, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    weather["temperature_diff_24h"] = (
        weather["temperature_2m"] - weather["temperature_24h_mean"]
    )

    keep_columns = [
        "bridge_id",
        "timestamp",
        "temperature_2m",
        "temperature_6h_mean",
        "temperature_24h_mean",
        "temperature_diff_24h",
        "relative_humidity_2m",
        "surface_pressure",
        "precipitation",
        "precipitation_1h",
        "precipitation_6h",
        "precipitation_12h",
        "precipitation_24h",
        "precipitation_72h",
        "precipitation_intensity_6h",
        "rain",
    ]
    existing = [col for col in keep_columns if col in weather.columns]
    return weather[existing]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Объединение уровня воды и погодных данных."
    )
    parser.add_argument(
        "--base", required=True, help="Путь к очищенному базовому датасету"
    )
    parser.add_argument(
        "--weather", required=True, help="Путь к CSV с погодными данными"
    )
    parser.add_argument("--output", required=True, help="Путь к итоговому CSV")
    args = parser.parse_args()

    base_path = Path(args.base)
    weather_path = Path(args.weather)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    base = pd.read_csv(base_path)
    weather = pd.read_csv(weather_path)

    base["bridge_id"] = normalize_bridge_id(base["bridge_id"])
    weather["bridge_id"] = normalize_bridge_id(weather["bridge_id"])

    base["timestamp"] = pd.to_datetime(base["timestamp"], utc=True)
    weather["timestamp"] = pd.to_datetime(weather["timestamp"], utc=True)

    base_hourly = resample_water_level_to_hourly(base)
    weather = add_weather_aggregates(weather)

    merged = base_hourly.merge(
        weather,
        on=["bridge_id", "timestamp"],
        how="left",
    )

    merged = add_time_features(merged)
    merged = add_lag_and_rolling_features(merged)

    merged = merged.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)
    merged.to_csv(output_path, index=False)

    print(f"[OK] Final dataset saved to: {output_path}")
    print(f"[INFO] Rows: {len(merged)}")
    print(f"[INFO] Columns: {len(merged.columns)}")
    print(f"[INFO] Bridges: {merged['bridge_id'].nunique()}")
    print(
        f"[INFO] Time range: {merged['timestamp'].min()} -> {merged['timestamp'].max()}"
    )


if __name__ == "__main__":
    main()
