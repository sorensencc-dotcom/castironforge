#!/bin/bash
# file: stop-cic.sh
# version: 1.0.0
# Stops all CIC services.

if [ ! -f .cic_pids ]; then
    echo "No running services found (.cic_pids missing)."
    exit 1
fi

echo "Stopping CIC services..."
while read pid; do
    if ps -p $pid > /dev/null; then
        kill $pid
        echo "Killed process $pid"
    fi
done < .cic_pids

rm .cic_pids
echo "All services stopped."
