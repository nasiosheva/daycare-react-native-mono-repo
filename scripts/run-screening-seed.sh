#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${SCREENING_SEED_BATCH_ID:?Set SCREENING_SEED_BATCH_ID=screening-initial-v1-2026-10-09}"
: "${SCREENING_SEED_APPLIED_BY:?Set SCREENING_SEED_APPLIED_BY to the operator identity}"
export SCREENING_SEED_APPLY="${SCREENING_SEED_APPLY:-false}"

if [[ "${SCREENING_SEED_BATCH_ID}" != "screening-initial-v1-2026-10-09" ]]; then
  echo "Unknown screening seed batch: ${SCREENING_SEED_BATCH_ID}" >&2
  exit 1
fi

echo "Screening seed batch: ${SCREENING_SEED_BATCH_ID}"
echo "Mode: $([[ "${SCREENING_SEED_APPLY}" == "true" ]] && echo APPLY || echo PREVIEW)"
if [[ "${SCREENING_SEED_APPLY}" == "true" ]]; then
  read -r -p "Type APPLY to write this DRAFT batch: " confirmation
  [[ "${confirmation}" == "APPLY" ]] || { echo "Cancelled"; exit 1; }
fi

cd "${repo_root}"
./apps/api/gradlew -p apps/api bootRun --args='--daycare.screening-seed-run=true'
