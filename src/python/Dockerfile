FROM python:3.12-slim

WORKDIR /usr/src/app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    NLTK_DATA=/usr/local/share/nltk_data

# All dependencies ship binary wheels — no compiler toolchain needed
COPY requirements.txt .
RUN pip install --no-cache-dir --retries=5 -r requirements.txt

# Bake NLTK data into the image so workers never download at runtime
RUN python - <<'PY'
import os, zipfile, nltk
root = os.environ["NLTK_DATA"]
for pkg in ["punkt_tab", "stopwords", "wordnet"]:
    assert nltk.download(pkg, download_dir=root), pkg
# The downloader leaves wordnet zipped, but the corpus reader needs it extracted
zipfile.ZipFile(f"{root}/corpora/wordnet.zip").extractall(f"{root}/corpora")
from nltk.stem import WordNetLemmatizer
assert WordNetLemmatizer().lemmatize("flowers") == "flower"
PY

# Run as an unprivileged user
RUN useradd --system --uid 10001 --no-create-home app
COPY --chown=app:app . .
USER app

EXPOSE 5600

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5600/health/ai', timeout=5)" || exit 1

# Production WSGI server. gthread workers keep SSE streams and slow LLM calls
# from blocking other requests; timeout exceeds the provider timeout + retry.
# keep-alive outlasts Node's pooled connections so reused sockets aren't
# closed mid-request ("socket hang up").
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:5600", "--workers", "2", \
     "--worker-class", "gthread", "--threads", "8", "--timeout", "120", \
     "--graceful-timeout", "30", "--keep-alive", "65", "--access-logfile", "-"]
