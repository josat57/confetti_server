FROM python:3.9-slim

WORKDIR /usr/src/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (add higher timeout and retries to avoid network flakiness)
ENV PIP_DEFAULT_TIMEOUT=120
COPY requirements.txt .
RUN pip install --no-cache-dir --retries=5 -r requirements.txt

# Pre-download required NLTK data to avoid runtime failures
RUN python -c "import nltk; nltk.download('punkt')" || true

# Copy source code
COPY . .

# Expose port
EXPOSE 5600

# Start the application
CMD ["python", "run.py"] 