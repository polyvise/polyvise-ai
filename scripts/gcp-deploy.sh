#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${GCP_POLYVISE_SERVICE:-polyvise-web}"
SITE_URL="${POLYVISE_SITE_URL:-https://polyvise.ai}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Set GCP_PROJECT_ID or configure a gcloud project." >&2
  exit 1
fi

IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/${GCP_ARTIFACT_REPO:-polyvise}/$SERVICE:$(git rev-parse --short HEAD)"

gcloud builds submit \
  --config cloudbuild.deploy.yaml \
  --substitutions "_IMAGE=$IMAGE" \
  --project "$PROJECT_ID"

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --memory "${GCP_CLOUD_RUN_MEMORY:-1Gi}" \
  --cpu "${GCP_CLOUD_RUN_CPU:-1}" \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances "${GCP_CLOUD_RUN_MAX_INSTANCES:-3}" \
  --timeout 300 \
  --set-env-vars "^|^NEXT_PUBLIC_SITE_URL=$SITE_URL|POLYVISE_REPOSITORY=${POLYVISE_REPOSITORY:-firestore}|FIRESTORE_PROJECT_ID=${FIRESTORE_PROJECT_ID:-$PROJECT_ID}|POLYVISE_FIRESTORE_DEBATE_COLLECTION=${POLYVISE_FIRESTORE_DEBATE_COLLECTION:-polyvise_ai_debate_records}|POLYVISE_FIRESTORE_FEEDBACK_COLLECTION=${POLYVISE_FIRESTORE_FEEDBACK_COLLECTION:-polyvise_ai_user_feedback}|POLYVISE_ENABLE_MOCK_LLM=${POLYVISE_ENABLE_MOCK_LLM:-false}|POLYVISE_EVIDENCE_PROVIDER=${POLYVISE_EVIDENCE_PROVIDER:-tavily}" \
  --update-secrets "OPENROUTER_API_KEY=polyvise-openrouter-api-key:latest,TAVILY_API_KEY=polyvise-tavily-api-key:latest"
