#!/bin/bash

# GitHub CI Error Checker - shows errors from the latest failed run
# Usage: ./scripts/gh_cli_log_viewer.sh [run_id] [repo]

set -e

REPO="${2:-todoforai/edge}"
WORKFLOW_NAME="Build and Deploy Tauri Applications"

# If no run_id provided, get the latest run status
if [ -z "$1" ]; then
    echo "🔍 Checking latest CI status in $REPO..."
    
    # Get the latest run (regardless of status)
    LATEST_RUN=$(gh run list --repo "$REPO" --workflow "$WORKFLOW_NAME" --limit 1 --json databaseId,status,conclusion,headBranch --jq '.[0]')
    
    if [ "$LATEST_RUN" = "null" ] || [ -z "$LATEST_RUN" ]; then
        echo "❌ No workflow runs found"
        exit 1
    fi
    
    STATUS=$(echo "$LATEST_RUN" | jq -r '.status')
    CONCLUSION=$(echo "$LATEST_RUN" | jq -r '.conclusion')
    RUN_ID=$(echo "$LATEST_RUN" | jq -r '.databaseId')
    BRANCH=$(echo "$LATEST_RUN" | jq -r '.headBranch')
    
    if [ "$STATUS" = "completed" ] && [ "$CONCLUSION" = "success" ]; then
        echo "✅ Latest CI run ($RUN_ID) on branch '$BRANCH' is successful - nothing to do!"
        exit 0
    elif [ "$STATUS" = "in_progress" ]; then
        echo "🔄 Latest CI run ($RUN_ID) on branch '$BRANCH' is still in progress"
        exit 0
    elif [ "$CONCLUSION" = "failure" ]; then
        echo "🚨 Found failed run $RUN_ID on branch: $BRANCH"
    else
        echo "⚠️  Latest run $RUN_ID on branch '$BRANCH' has status: $STATUS, conclusion: $CONCLUSION"
        exit 0
    fi
else
    RUN_ID="$1"
    echo "🔍 Fetching logs for run $RUN_ID in $REPO"
fi

# Download and extract logs
TEMP_DIR=$(mktemp -d)
LOG_ZIP="$TEMP_DIR/logs.zip"

gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$REPO/actions/runs/$RUN_ID/logs" \
  > "$LOG_ZIP" 2>/dev/null || {
    echo "❌ Failed to download logs via API"
    rm -rf "$TEMP_DIR"
    exit 1
}

# Extract and find errors
if [ -f "$LOG_ZIP" ] && [ -s "$LOG_ZIP" ]; then
    cd "$TEMP_DIR"
    unzip -q logs.zip 2>/dev/null || {
        echo "❌ Failed to extract logs"
        rm -rf "$TEMP_DIR"
        exit 1
    }
    
    echo ""
    echo "📋 CI Error Summary:"
    echo "===================="
    
    # Process each log file and extract key errors
    for log_file in *.txt; do
        if [ -f "$log_file" ]; then
            # Extract job name from filename
            JOB_NAME=$(echo "$log_file" | sed 's/^[0-9]*_//' | sed 's/\.txt$//')
            
            # Skip jobs that were just canceled
            if grep -q "The operation was canceled" "$log_file" 2>/dev/null; then
                continue
            fi
            
            # Look for actual errors (not just compilation steps)
            REAL_ERRORS=$(grep -i -A 5 -B 50 -E "(UnicodeEncodeError|Error:|##\[error\]|make: \*\*\*|Process completed with exit code [^0])" "$log_file" 2>/dev/null | grep -v "Compiling\|INFO:" || true)
            
            if [ -n "$REAL_ERRORS" ]; then
                echo ""
                echo "❌ $JOB_NAME:"
                echo "$REAL_ERRORS"
            fi
        fi
    done
    
    echo ""
    echo "🔗 View full logs: https://github.com/$REPO/actions/runs/$RUN_ID"
else
    echo "❌ No log content received"
fi

rm -rf "$TEMP_DIR"