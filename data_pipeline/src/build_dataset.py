from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import pandas as pd


def run_step(args: list[str]) -> None:
    print(f"[RUN] {' '.join(args)}")
    subprocess.run(args, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Запуск полного data pipeline.")
    parser.add_argument("--raw", required=True, help="Путь к исходному файлу")
    parser.add_argument(
        "--bridges", required=True, help="Путь к CSV с координатами мостов"
    )
    parser.add_argument("--out-dir", required=True, help="Папка для результатов")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    root_src = Path(__file__).resolve().parent

    clean_script = root_src / "clean_base_dataset.py"
    fetch_script = root_src / "fetch_openmeteo.py"
    merge_script = root_src / "merge_features.py"

    clean_output = out_dir / "base_clean.csv"
    weather_output = out_dir / "weather_openmeteo.csv"
    final_output = out_dir / "dataset_with_external_features.csv"

    # 1. Очистка исходного датасета
    run_step(
        [
            sys.executable,
            str(clean_script),
            "--input",
            args.raw,
            "--output",
            str(clean_output),
        ]
    )

    # 2. Определяем временной диапазон по очищенному датасету
    clean_df = pd.read_csv(clean_output)
    clean_df["timestamp"] = pd.to_datetime(clean_df["timestamp"], utc=True)

    start_date = clean_df["timestamp"].min().date().isoformat()
    end_date = clean_df["timestamp"].max().date().isoformat()

    print(f"[INFO] Weather date range: {start_date} -> {end_date}")

    # 3. Загрузка погоды
    run_step(
        [
            sys.executable,
            str(fetch_script),
            "--bridges",
            args.bridges,
            "--start-date",
            start_date,
            "--end-date",
            end_date,
            "--output",
            str(weather_output),
        ]
    )

    # 4. Merge + feature engineering
    run_step(
        [
            sys.executable,
            str(merge_script),
            "--base",
            str(clean_output),
            "--weather",
            str(weather_output),
            "--output",
            str(final_output),
        ]
    )

    print("[DONE] Data pipeline completed successfully.")
    print(f"[RESULT] Clean data: {clean_output}")
    print(f"[RESULT] Weather data: {weather_output}")
    print(f"[RESULT] Final dataset: {final_output}")


if __name__ == "__main__":
    main()
