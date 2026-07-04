#!/bin/bash
# Verifies all critical files exist before starting the dev server.
# If any are missing, restores them from git.
cd /home/z/my-project

CRITICAL_FILES=(
  "src/lib/local-store.ts"
  "src/lib/access-scope.ts"
  "src/lib/types.ts"
  "src/lib/seed-data.ts"
  "src/lib/admin-data.ts"
  "src/lib/firebase.ts"
  "src/lib/formatters.ts"
  "src/hooks/use-auth.ts"
  "src/hooks/use-portal-store.ts"
  "src/components/portal/portal-app.tsx"
  "src/components/portal/portal-shell.tsx"
  "src/components/portal/login-screen.tsx"
  "src/components/portal/view-helpers.tsx"
  "src/components/portal/views/dashboard-view.tsx"
  "src/components/portal/views/users-view.tsx"
  "src/components/portal/views/user-detail-view.tsx"
  "src/components/portal/views/merchants-view.tsx"
  "src/components/portal/views/merchant-detail-view.tsx"
  "src/components/portal/views/stock-view.tsx"
  "src/components/portal/views/staff-view.tsx"
  "src/components/portal/views/compliance-view.tsx"
  "src/components/portal/views/risk-view.tsx"
  "src/components/portal/views/devices-view.tsx"
  "src/components/portal/views/finance-view.tsx"
  "src/components/portal/views/support-view.tsx"
  "src/components/portal/views/disputes-view.tsx"
  "src/components/portal/views/audit-view.tsx"
  "src/components/portal/views/approvals-view.tsx"
  "src/components/portal/views/departments-view.tsx"
  "src/components/portal/views/countries-view.tsx"
  "src/components/portal/views/country-detail-view.tsx"
  "src/components/portal/views/terms-view.tsx"
  "src/app/api/validate-country/route.ts"
  "src/app/api/legal-content/route.ts"
)

MISSING=0
for f in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "⚠️  MISSING: $f — restoring from git..."
    git checkout HEAD -- "$f" 2>/dev/null || echo "❌ Could not restore $f from git"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo "⚠️  Restored $MISSING missing files from git."
else
  echo "✅ All critical files present."
fi
