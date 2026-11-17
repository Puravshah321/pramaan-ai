"""Audit existing runs and invalidate runs contaminated by heuristic fallback, verbatim document copy, or API errors."""
from __future__ import annotations

import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "backend" / "pramaan.db"

KNOWN_HEURISTIC_FRAGMENTS = [
    "primary trade-off in rag chunk size",
    "exact match measures exact string equality",
    "top-k represents the number of most similar",
    "quantization reduces llm weights",
    "faiss provides fast vector similarity",
]


def audit_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Ensure columns exist in runs table
    cursor.execute("PRAGMA table_info(runs)")
    columns = [row[1] for row in cursor.fetchall()]

    if "is_valid" not in columns:
        print("Adding is_valid column to runs table...")
        cursor.execute("ALTER TABLE runs ADD COLUMN is_valid BOOLEAN DEFAULT 1")
    if "invalid_reason" not in columns:
        print("Adding invalid_reason column to runs table...")
        cursor.execute("ALTER TABLE runs ADD COLUMN invalid_reason VARCHAR(512)")
    conn.commit()

    # 2. Query all runs
    cursor.execute("SELECT id, name, status, runner_type, created_at FROM runs")
    all_runs = cursor.fetchall()

    invalidated_count = 0
    total_runs = len(all_runs)

    print(f"Auditing {total_runs} runs in database...")

    for run_id, run_name, status, runner_type, created_at in all_runs:
        # Check answer errors
        cursor.execute("""
            SELECT COUNT(*),
                   SUM(CASE WHEN error IS NOT NULL AND length(error) > 0 THEN 1 ELSE 0 END)
            FROM answers
            WHERE run_config_id IN (SELECT id FROM run_configs WHERE run_id = ?)
        """, (run_id,))
        ans_count, err_count = cursor.fetchone()
        ans_count = ans_count or 0
        err_count = err_count or 0

        # Check for heuristic / verbatim extraction answers
        cursor.execute("""
            SELECT answer FROM answers
            WHERE run_config_id IN (SELECT id FROM run_configs WHERE run_id = ?)
        """, (run_id,))
        answers = [row[0] for row in cursor.fetchall() if row[0]]

        is_heuristic = False
        heuristic_matches = 0
        for a in answers:
            a_low = a.lower()
            if any(frag in a_low for frag in KNOWN_HEURISTIC_FRAGMENTS):
                heuristic_matches += 1

        if answers and heuristic_matches >= len(answers) * 0.5:
            is_heuristic = True

        # Check conditions
        if err_count > 0:
            reason = f"Contaminated: {err_count}/{ans_count} answers encountered API failure and used heuristic extraction fallback"
            cursor.execute("UPDATE runs SET is_valid = 0, invalid_reason = ? WHERE id = ?", (reason, run_id))
            invalidated_count += 1
            print(f"  [INVALID] Run {run_id} ('{run_name}'): {reason}")
        elif is_heuristic:
            reason = f"Contaminated: {heuristic_matches}/{len(answers)} answers are verbatim document sentences from extractive heuristic"
            cursor.execute("UPDATE runs SET is_valid = 0, invalid_reason = ? WHERE id = ?", (reason, run_id))
            invalidated_count += 1
            print(f"  [INVALID] Run {run_id} ('{run_name}'): {reason} (includes 0.473 F1 baseline run)")
        elif status != "completed" or ans_count == 0:
            reason = "Incomplete or cancelled run"
            cursor.execute("UPDATE runs SET is_valid = 0, invalid_reason = ? WHERE id = ?", (reason, run_id))
            invalidated_count += 1
            print(f"  [INVALID] Run {run_id} ('{run_name}'): {reason}")
        else:
            cursor.execute("UPDATE runs SET is_valid = 1, invalid_reason = NULL WHERE id = ?", (run_id,))
            print(f"  [VALID] Run {run_id} ('{run_name}'): {ans_count} clean model answers (runner: {runner_type})")

    # Invalidate old ShowcaseItem entries that used extractive heuristic
    cursor.execute("DELETE FROM showcase_items WHERE answer LIKE '%trade-off in RAG chunk size%' OR answer LIKE '%Beyoncé Giselle Knowles-Carter%'")
    conn.commit()
    conn.close()

    print("\n--- Audit Summary ---")
    print(f"Total Runs Evaluated: {total_runs}")
    print(f"Invalidated Runs:     {invalidated_count}")
    print(f"Valid Clean Runs:     {total_runs - invalidated_count}")


if __name__ == "__main__":
    audit_database()
