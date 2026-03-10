from __future__ import annotations

import argparse
import csv
from io import StringIO
from pathlib import Path

import pandas as pd


POSSIBLE_SEPARATORS = [";", ",", "\t"]


def try_read_csv(text: str) -> pd.DataFrame | None:
    """
    Пытается прочитать CSV с разными разделителями.
    """
    for sep in POSSIBLE_SEPARATORS:
        try:
            df = pd.read_csv(
                StringIO(text),
                sep=sep,
                engine="python",
                quotechar='"',
                skip_blank_lines=True,
            )
            if df.shape[1] >= 2:
                return df
        except Exception:
            continue
    return None


def looks_like_csv_header(line: str) -> bool:
    """
    Проверяет, похожа ли строка на заголовок CSV.
    Учитывает кавычки и разные разделители.
    """
    stripped = line.strip().lstrip("\ufeff")
    if not stripped:
        return False

    candidates = [
        ["id", "sensor_id", "value", "ts_create", "ts_update"],
        ["sensor_id", "value", "ts_create"],
        ["bridge_id", "water_level", "timestamp"],
    ]

    for sep in [";", ",", "\t"]:
        try:
            parsed = next(csv.reader([stripped], delimiter=sep, quotechar='"'))
            parsed = [x.strip() for x in parsed]
            for candidate in candidates:
                if parsed[: len(candidate)] == candidate:
                    return True
        except Exception:
            continue

    return False


def extract_csv_from_multipart(raw_text: str) -> str | None:
    """
    Извлекает CSV из multipart/form-data файла.
    """
    normalized = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")

    header_index = None
    for i, line in enumerate(lines):
        if looks_like_csv_header(line):
            header_index = i
            break

    if header_index is None:
        return None

    csv_lines: list[str] = []
    for line in lines[header_index:]:
        stripped = line.strip()

        if stripped.startswith("--") and csv_lines:
            break

        csv_lines.append(line)

    result = "\n".join(csv_lines).strip()
    return result if result else None


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Приводит названия колонок к стандартным:
    - bridge_id
    - water_level
    - timestamp
    """
    df = df.copy()
    df.columns = [str(col).strip().strip('"').lstrip("\ufeff") for col in df.columns]

    rename_map = {}

    if "bridge_id" not in df.columns and "sensor_id" in df.columns:
        rename_map["sensor_id"] = "bridge_id"

    if "water_level" not in df.columns and "value" in df.columns:
        rename_map["value"] = "water_level"

    if "timestamp" not in df.columns:
        if "ts_create" in df.columns:
            rename_map["ts_create"] = "timestamp_raw"
        elif "datetime" in df.columns:
            rename_map["datetime"] = "timestamp_raw"
        elif "time" in df.columns:
            rename_map["time"] = "timestamp_raw"

    df = df.rename(columns=rename_map)

    if "timestamp" not in df.columns and "timestamp_raw" in df.columns:
        numeric_ts = pd.to_numeric(df["timestamp_raw"], errors="coerce")
        max_val = numeric_ts.max()

        if pd.notna(max_val) and max_val > 10**11:
            df["timestamp"] = pd.to_datetime(
                numeric_ts, unit="ms", utc=True, errors="coerce"
            )
        else:
            df["timestamp"] = pd.to_datetime(
                numeric_ts, unit="s", utc=True, errors="coerce"
            )

    required = {"bridge_id", "water_level", "timestamp"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Не удалось привести датасет к нужному формату. "
            f"Не хватает колонок: {missing}. "
            f"Найденные колонки: {list(df.columns)}"
        )

    return df


def normalize_bridge_id(series: pd.Series) -> pd.Series:
    """
    Приводит bridge_id к единому строковому формату:
    1 -> "1"
    1.0 -> "1"
    "1" -> "1"
    """
    numeric = pd.to_numeric(series, errors="coerce")
    result = series.astype(str).str.strip()

    mask = numeric.notna()
    result.loc[mask] = numeric.loc[mask].astype("Int64").astype(str)

    return result


def load_raw_dataset(input_path: Path) -> pd.DataFrame:
    raw_text = input_path.read_text(encoding="utf-8", errors="ignore")

    extracted = extract_csv_from_multipart(raw_text)
    if extracted is not None:
        df = try_read_csv(extracted)
    else:
        df = try_read_csv(raw_text)

    if df is None:
        raise ValueError(
            "Не удалось распознать CSV в файле. "
            "Проверь формат, разделитель и кодировку."
        )

    df = normalize_columns(df)

    df["bridge_id"] = normalize_bridge_id(df["bridge_id"])
    df["water_level"] = pd.to_numeric(df["water_level"], errors="coerce")

    df = df.dropna(subset=["bridge_id", "water_level", "timestamp"])
    df = df.drop_duplicates()
    df = df.sort_values(["bridge_id", "timestamp"]).reset_index(drop=True)

    priority_cols = ["bridge_id", "water_level", "timestamp"]
    other_cols = [c for c in df.columns if c not in priority_cols]
    df = df[priority_cols + other_cols]

    return df


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Очистка исходного датасета уровня воды."
    )
    parser.add_argument("--input", required=True, help="Путь к исходному файлу")
    parser.add_argument("--output", required=True, help="Путь к очищенному CSV")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Файл не найден: {input_path}")

    df = load_raw_dataset(input_path)
    df.to_csv(output_path, index=False)

    print(f"[OK] Clean dataset saved to: {output_path}")
    print(f"[INFO] Rows: {len(df)}")
    print(f"[INFO] Columns: {list(df.columns)}")
    print(f"[INFO] Bridges: {df['bridge_id'].nunique()}")
    print(f"[INFO] Time range: {df['timestamp'].min()} -> {df['timestamp'].max()}")


if __name__ == "__main__":
    main()
