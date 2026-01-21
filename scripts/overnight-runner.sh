#!/bin/bash
# Overnight runner - keeps the three ingestion processes running with auto-resume
# Usage: ./scripts/overnight-runner.sh

set -e

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Overnight Runner Started at $(date) ==="
echo "Logs will be written to $LOG_DIR/"
echo ""

# Function to run a process with auto-restart
run_with_retry() {
    local name="$1"
    local command="$2"
    local log_file="$LOG_DIR/${name}_${TIMESTAMP}.log"
    local max_failures=10
    local failures=0

    echo "[$name] Starting... (log: $log_file)"

    while [ $failures -lt $max_failures ]; do
        echo "[$name] $(date): Attempt $((failures + 1))/$max_failures" | tee -a "$log_file"

        if eval "$command" >> "$log_file" 2>&1; then
            echo "[$name] $(date): Completed successfully!" | tee -a "$log_file"
            return 0
        else
            failures=$((failures + 1))
            echo "[$name] $(date): Failed (attempt $failures/$max_failures), waiting 30s before retry..." | tee -a "$log_file"
            sleep 30
        fi
    done

    echo "[$name] $(date): Max failures reached, giving up." | tee -a "$log_file"
    return 1
}

# Run all three processes in parallel
echo "Starting all three processes in parallel..."
echo ""

# Geocoding - slowest due to rate limiting
run_with_retry "geocode" "npm run geocode -- --resume" &
GEOCODE_PID=$!

# Georgia backfill
run_with_retry "georgia" "npm run ingest:backfill -- --source georgia-statewide-tyler-source --resume" &
GEORGIA_PID=$!

# Hillsborough backfill
run_with_retry "hillsborough" "npm run ingest:backfill -- --source hillsborough-county-fl-ebridge-source --resume" &
HILLSBOROUGH_PID=$!

echo "Process PIDs:"
echo "  Geocode: $GEOCODE_PID"
echo "  Georgia: $GEORGIA_PID"
echo "  Hillsborough: $HILLSBOROUGH_PID"
echo ""
echo "To monitor: tail -f $LOG_DIR/*_${TIMESTAMP}.log"
echo "To stop all: kill $GEOCODE_PID $GEORGIA_PID $HILLSBOROUGH_PID"
echo ""

# Wait for all to complete
wait $GEOCODE_PID
GEOCODE_STATUS=$?

wait $GEORGIA_PID
GEORGIA_STATUS=$?

wait $HILLSBOROUGH_PID
HILLSBOROUGH_STATUS=$?

echo ""
echo "=== All processes completed at $(date) ==="
echo "Results:"
echo "  Geocode: $([ $GEOCODE_STATUS -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
echo "  Georgia: $([ $GEORGIA_STATUS -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
echo "  Hillsborough: $([ $HILLSBOROUGH_STATUS -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')"
