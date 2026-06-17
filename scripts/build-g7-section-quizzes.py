"""Build section-specific quiz bank from Kimyo 7 textbook knowledge JSON.

Run: python scripts/build-g7-section-quizzes.py
      (delegates to build-section-quizzes.py g7)
"""
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).resolve().parent / "build-section-quizzes.py"
    sys.exit(subprocess.call([sys.executable, str(script), "g7"]))
