from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["day_of_year"] = df["timestamp"].dt.dayofyear

    return df


def add_lag_and_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)

    group = df.groupby("bridge_id", group_keys=False)

    # Lag features
    for lag in [1, 3, 6, 12, 24]:
        df[f"water_level_lag_{lag}h"] = group["water_level"].shift(lag)

    # Rolling features only from past values
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

    return df


def add_weather_aggregates(weather: pd.DataFrame) -> pd.DataFrame:
    weather = weather.copy()
    weather = weather.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)

    group = weather.groupby("bridge_id", group_keys=False)

    weather["precipitation_1h"] = weather["precipitation"]
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
    weather["temperature_24h_mean"] = (
        group["temperature_2m"]
        .rolling(window=24, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    keep_columns = [
        "bridge_id",
        "timestamp",
        "temperature_2m",
        "temperature_24h_mean",
        "precipitation",
        "precipitation_1h",
        "precipitation_24h",
        "precipitation_72h",
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

    base["bridge_id"] = base["bridge_id"].astype(str)
    weather["bridge_id"] = weather["bridge_id"].astype(str)

    base["timestamp"] = pd.to_datetime(base["timestamp"], utc=True)
    weather["timestamp"] = pd.to_datetime(weather["timestamp"], utc=True)

    # Приводим уровень воды к часовым отметкам для объединения с погодой
    base["timestamp_hour"] = base["timestamp"].dt.floor("h")

    weather = add_weather_aggregates(weather)
    weather = weather.rename(columns={"timestamp": "timestamp_hour"})

    merged = base.merge(
        weather,
        on=["bridge_id", "timestamp_hour"],
        how="left",
    )

    merged = (
        merged.rename(columns={"timestamp_x": "timestamp"})
        if "timestamp_x" in merged.columns
        else merged
    )
    if "timestamp_y" in merged.columns:
        merged = merged.drop(columns=["timestamp_y"])

    merged = add_time_features(merged)
    merged = add_lag_and_rolling_features(merged)

    merged = merged.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)
    merged.to_csv(output_path, index=False)

    print(f"[OK] Final dataset saved to: {output_path}")
    print(f"[INFO] Rows: {len(merged)}")
    print(f"[INFO] Columns: {len(merged.columns)}")


if __name__ == "__main__":
    main()
