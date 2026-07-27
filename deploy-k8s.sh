#!/bin/bash
set -e

echo "🚀 Deploying Payroll Timesheet System to Rancher Desktop Kubernetes..."
echo ""

# 1. Verify kubectl context is set to Rancher Desktop
CURRENT_CONTEXT=$(kubectl config current-context)
echo "✓ Current Kubernetes context: $CURRENT_CONTEXT"
if [ "$CURRENT_CONTEXT" != "rancher-desktop" ]; then
    echo "⚠️  WARNING: Current context is not 'rancher-desktop'. Swapping context..."
    kubectl config use-context rancher-desktop
fi

# 2. Verify docker context is set to Rancher Desktop (for local image availability)
echo "✓ Setting Docker CLI context to rancher-desktop..."
docker context use rancher-desktop || true
echo ""

# 3. Build docker images locally
echo "🔨 Building backend image..."
docker build -t payroll-backend:latest ./backend

echo "🔨 Building frontend image..."
docker build -t payroll-frontend:latest ./frontend

echo ""
echo "⛵ Applying Kubernetes manifests..."
kubectl apply -f k8s/

echo ""
echo "⏳ Waiting for pods to roll out..."
kubectl rollout status deployment/payroll-backend --timeout=60s || true
kubectl rollout status deployment/payroll-frontend --timeout=60s || true

echo ""
echo "✅ Payroll Timesheet System has been deployed on Rancher Kubernetes!"
echo ""
echo "📍 Access endpoints:"
echo "   Frontend: http://localhost:5174"
echo "   Backend: http://localhost:9001"
echo ""
echo "📋 Useful kubectl commands:"
echo "   View pods: kubectl get pods"
echo "   View services: kubectl get svc"
echo "   View backend logs: kubectl logs deployment/payroll-backend -f"
echo "   View frontend logs: kubectl logs deployment/payroll-frontend -f"
echo "   Delete deployment: kubectl delete -f k8s/"
echo ""
