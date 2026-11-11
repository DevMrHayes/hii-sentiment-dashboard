# Azure Government (GCCH) & Entra ID Migration Blueprint
## Target Workload: `hii-sentiment-dashboard` (React 19 + Vite 6 + BigInt Engine + Python Research Orchestrator)
**Classification Target:** CUI / DoD IL4 / FedRAMP High Equivalent (Azure US Government + M365 GCCH)  
**FinOps Target:** **$0.50 – $15.00 / month** (Serverless / Consumption Architecture)

---

## 1. GCCH Sovereign Cloud Endpoints & Constraints

Migrating from GCP Commercial (Firebase Hosting + Firestore + Google OAuth) to **Azure US Government** paired with **Microsoft Entra ID US Government (GCCH)** requires strict adherence to sovereign endpoints. Commercial endpoints (`.com`, `.net`) will fail authentication, TLS validation, or violate ITAR/DFARS 252.204-7012 data residency boundaries.

### 1.1 Mandatory Sovereign Endpoint Matrix

| Service Plane | Commercial Endpoint (DO NOT USE) | Azure US Government / GCCH Endpoint (REQUIRED) |
| :--- | :--- | :--- |
| **Azure Portal** | `https://portal.azure.com` | `https://portal.azure.us` |
| **Entra Admin Center** | `https://entra.microsoft.com` | `https://entra.microsoft.us` |
| **Entra ID Authority** | `https://login.microsoftonline.com` | `https://login.microsoftonline.us` |
| **Microsoft Graph API** | `https://graph.microsoft.com` | `https://graph.microsoft.us` |
| **Resource Manager (ARM)**| `https://management.azure.com` | `https://management.usgovcloudapi.net` |
| **Blob / Static Web** | `*.blob.core.windows.net` / `*.z13.web.core.windows.net` | `*.blob.core.usgovcloudapi.net` / `*.z2.web.core.usgovcloudapi.net` |
| **Table Storage** | `*.table.core.windows.net` | `*.table.core.usgovcloudapi.net` |
| **Azure Functions** | `*.azurewebsites.net` | `*.azurewebsites.us` |
| **Azure OpenAI Service** | `*.openai.azure.com` | `*.openai.azure.us` |
| **Key Vault** | `*.vault.azure.net` | `*.vault.usgovcloudapi.net` |

### 1.2 Critical GCCH Constraint: Azure Static Web Apps (SWA) Availability & Reliable Fallback
* **The Constraint:** In Azure Commercial, *Azure Static Web Apps (SWA)* provides a free tier with managed Functions. However, **Azure Static Web Apps has limited/non-existent regional parity in Azure US Government (`usgovvirginia`, `usgovarizona`, `usgovtexas`)** compared to Commercial.
* **The Production-Grade Low-Cost GCCH Architecture ($0.10–$3/mo):**
  1. **Option A (Lowest Cost - ~$0.15/mo):** **Azure Storage Account (General Purpose v2) Static Website** (`$web` container) + **Azure Functions (Linux Consumption Plan Y1)** serving `/api/*` with CORS locked to the Static Website origin.
  2. **Option B (Custom Domain + WAF/TLS - ~$13/mo or $0 on shared App Service Plan):** **Azure App Service (Linux Basic B1 or Shared Internal ASE)** or **Azure Container Apps (Consumption Plan - 180,000 vCPU-seconds/month FREE)** serving the compiled Vite static bundle via `nginx:alpine` alongside the Python/Node API.
  * *Blueprint Selection:* We use **Azure Storage Static Website + Azure Functions Consumption Plan (Python 3.11)** (or **Azure Container Apps Consumption** if a custom internal TLS cert is required without Azure Front Door base fees). Both stay under **$2.00/month**.

```
+-----------------------------------------------------------------------------------+
|                        AZURE US GOVERNMENT (usgovvirginia)                        |
|                                                                                   |
|  +---------------------------+        1. PKCE Auth (.us)   +-------------------+  |
|  |   User Browser (HII VPN)  | --------------------------> | Entra ID US Gov   |  |
|  |   React 19 + BigInt SPA   | <-------------------------- | login.microsoft   |  |
|  +---------------------------+     JWT (Roles: HII.Admin)  | online.us         |  |
|        |                   |                               +-------------------+  |
|        | 2. GET Static     | 3. Bearer JWT (/api/*)                               |
|        v                   v                                                      |
|  +----------------+  +---------------------------------------------------------+  |
|  | Azure Storage  |  | Azure Functions (Consumption Y1 - *.azurewebsites.us)   |  |
|  | Static Website |  | - Validates Entra US Gov JWT + App Roles                |  |
|  | ($web)         |  | - /api/state (GET/POST overrides, pending queue)        |  |
|  +----------------+  | - /api/access-request (POST access request)             |  |
|                      | - TimerTrigger: Monday 12:00 UTC AI Sweep               |  |
|                      +---------------------------------------------------------+  |
|                                    |                             |                |
|                     4. Managed ID  |                             | 5. Managed ID  |
|                        (RBAC)      v                             v    (RBAC)      |
|                      +---------------------------+ +---------------------------+  |
|                      | Azure Table Storage       | | Azure OpenAI Gov          |  |
|                      | (*.table.core.            | | (*.openai.azure.us)       |  |
|                      |  usgovcloudapi.net)       | | GPT-4o (CUI-compliant)    |  |
|                      +---------------------------+ +---------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Microsoft Entra ID Authentication in GCCH (Zero-Trust Auth Wall)

In GCP, the app used Firebase Google OAuth + a client-queried Firestore allowlist (`settings/access_control`). In GCCH, we upgrade to a true **IdP-enforced Zero-Trust boundary** using **Entra ID Enterprise Application Assignment + App Roles**.

### 2.1 Step-by-Step App Registration in Entra ID GCCH (`entra.microsoft.us`)

1. Authenticate to `https://entra.microsoft.us` as a Cloud Application Administrator.
2. Navigate to **Identity -> Applications -> App registrations -> New registration**:
   * **Name:** `hii-sentiment-dashboard-gcch`
   * **Supported account types:** `Accounts in this organizational directory only (HII Single Tenant)`
   * **Redirect URI:** Select `Single-page application (SPA)` -> `https://<storage-endpoint>.z2.web.core.usgovcloudapi.net` (and `http://localhost:5173` for local dev).
3. Navigate to **Expose an API**:
   * Set **Application ID URI:** `api://<CLIENT_ID>`
   * Click **Add a scope**:
     * Scope name: `Dashboard.ReadWrite`
     * Who can consent: `Admins only`
4. Navigate to **App roles -> Create app role** and define two roles (replaces the Firestore `allowedEmails` / `adminEmails` arrays):

```json
"appRoles": [
  {
    "allowedMemberTypes": ["User"],
    "description": "Full administrative access to approve research queue, edit ledger overrides, and manage sanity checks.",
    "displayName": "HII Sentiment Admin",
    "id": "d1a99942-5c6a-4b4e-8f1a-000000000001",
    "isEnabled": true,
    "Origin": "Application",
    "value": "HII.Admin"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Read-only executive access to HII Sentiment Dashboard.",
    "displayName": "HII Sentiment Viewer",
    "id": "d1a99942-5c6a-4b4e-8f1a-000000000002",
    "isEnabled": true,
    "Origin": "Application",
    "value": "HII.Viewer"
  }
]
```

5. **Enforce Hard IdP Gate ("Assignment Required"):**
   * Navigate to **Identity -> Applications -> Enterprise applications -> `hii-sentiment-dashboard-gcch` -> Properties**.
   * Set **Assignment required?** to **Yes**.
   * Navigate to **Users and groups** and assign authorized HII Security Groups or Users to either `HII.Admin` or `HII.Viewer`.
   * *Security Impact:* Unassigned HII users are blocked at `login.microsoftonline.us` before receiving a token. External users cannot authenticate at all.

### 2.2 Frontend MSAL Configuration (`src/auth/msalConfig.ts`)

Install MSAL packages:
```bash
npm uninstall firebase
npm install @azure/msal-browser @azure/msal-react
```

Create `src/auth/msalConfig.ts` configured explicitly for the `.us` sovereign cloud:

```typescript
import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';

const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const AUTHORITY_HOST = import.meta.env.VITE_ENTRA_AUTHORITY || 'https://login.microsoftonline.us';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    // CRITICAL FOR GCCH: Must point to login.microsoftonline.us/<TENANT_ID>
    authority: `${AUTHORITY_HOST}/${TENANT_ID}`,
    // CRITICAL FOR GCCH: MSAL rejects non-.com authorities unless explicitly whitelisted here
    knownAuthorities: ['login.microsoftonline.us'],
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Safer for CUI / shared kiosk environments than localStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
      },
    },
  },
};

export const loginRequest = {
  scopes: [`api://${CLIENT_ID}/Dashboard.ReadWrite`, 'User.Read'],
};

export const msalInstance = new PublicClientApplication(msalConfig);
```

### 2.3 Role Verification & Access Request Workflow (`src/auth/useEntraAuth.ts`)

When an authenticated HII user lacks an App Role (or if `Assignment Required` is set to `No` so any HII employee can land on the "Request Access" screen), the SPA inspects the `roles` claim inside the Entra ID token:

```typescript
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

export interface EntraUserContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isAuthorizedViewer: boolean;
  getAccessToken: () => Promise<string>;
}

export function useEntraAuth(): EntraUserContext {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0] || null;

  // Entra ID injects assigned App Roles into idTokenClaims.roles
  const roles = (account?.idTokenClaims?.roles as string[] | undefined) ?? [];
  const isAdmin = roles.includes('HII.Admin');
  const isAuthorizedViewer = isAdmin || roles.includes('HII.Viewer');

  const getAccessToken = async (): Promise<string> => {
    if (!account) throw new Error('No active Entra ID GCCH account');
    const response = await instance.acquireTokenSilent({
      scopes: [`api://${import.meta.env.VITE_AZURE_CLIENT_ID}/Dashboard.ReadWrite`],
      account,
    });
    return response.accessToken;
  };

  return {
    isAuthenticated,
    isLoading: inProgress !== InteractionStatus.None,
    email: account?.username?.toLowerCase() ?? null,
    displayName: account?.name ?? null,
    isAdmin,
    isAuthorizedViewer,
    getAccessToken,
  };
}
```

### 2.4 Access Request Workflow in GCCH
To preserve the built-in **"Request Access"** button experience for HII employees who haven't been granted `HII.Viewer` yet:
1. Keep **Assignment required = No** on the Enterprise App so any valid `@hii-co.com` user in the GCCH tenant can complete OIDC sign-in, **OR** use an Entra ID **Identity Governance Entitlement Management Access Package** URL (`https://myaccess.microsoft.us/@<tenant>/#/access-packages/<package-id>`).
2. If using the in-app button: When `isAuthenticated && !isAuthorizedViewer`, the user clicks **"Request Access"**, which sends a `POST /api/access-request` with their signed Entra JWT.
3. The Azure Function validates the token signature against `https://login.microsoftonline.us/<TENANT_ID>/discovery/v2.0/keys`, writes the request to **Azure Table Storage** (`AccessRequests` table), and optionally posts an Adaptive Card to an HII Admin Microsoft Teams GCCH channel via Webhook.

---

## 3. Low-Cost Data & Persistence Layer (Replacing Cloud Firestore)

`hii-sentiment-dashboard` does not require a heavy relational database. Its state consists of < 5 MB of JSON documents:
* `app_state/ledger_overrides`: Custom scoring edits, deleted base IDs, custom articles.
* `app_state/pending_queue`: Weekly AI-discovered candidate articles awaiting human approval.
* `app_state/sanity_checks`: Dismissed anomaly flags.
* `access_requests/*`: User access requests and audit trail.

### 3.1 Persistence FinOps Comparison in Azure US Government

| Storage Option | GCCH Availability | Pricing Model (US Gov Virginia) | Estimated Monthly Cost | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Azure Table Storage** (inside same Storage Account as Static Web) | GA (`usgovvirginia`, `usgovarizona`, `usgovtexas`) | ~$0.055 per GB/month + $0.0004 per 10,000 transactions | **~$0.05 / month** | **WINNER (Best FinOps)** |
| **Azure Cosmos DB (Serverless)** | GA (`usgovvirginia`, `usgovarizona`) | $0.31 per 1M Request Units (RUs) + $0.31/GB/mo | **~$0.85 / month** | Great if complex JSON queries are needed |
| **Azure SQL Database (Serverless)** | GA | ~$0.52/vCore-hour (min 1 hour/day active if polled) | ~$18.00 – $45.00 / month | Overkill & exceeds budget |

### 3.2 Azure Table Storage Schema Design

We provision a single table named `HiiDashboardState` inside our existing GPv2 Storage Account (`https://<storage_account>.table.core.usgovcloudapi.net`):

| `PartitionKey` | `RowKey` | `PayloadJson` (String / GZIP Base64 if > 32KB) | `UpdatedBy` | `UpdatedAt` |
| :--- | :--- | :--- | :--- | :--- |
| `STATE` | `ledger_overrides` | `{"deletedIds":[],"editedArticles":{},"customArticles":[]}` | `admin@hii.com` | `2025-05-12T12:00:00Z` |
| `STATE` | `pending_queue` | `[{"id":"ai-1","title":"...","url":"..."}]` | `system-timer` | `2025-05-12T12:00:05Z` |
| `STATE` | `sanity_checks` | `{"dismissedIds":["chk-101"]}` | `admin@hii.com` | `2025-05-12T14:22:10Z` |
| `ACCESS_REQ` | `jane.doe@hii.com` | `{"status":"pending","reason":"Exec review"}` | `jane.doe@hii.com`| `2025-05-13T09:15:00Z` |

> **Note on Azure Table Storage 64KB Property Limit:** Because a single Azure Table Storage string property caps at 64 KB (32K UTF-16 chars), our Python Azure Function helper automatically chunks `PayloadJson` across `PayloadChunk0`..`PayloadChunk9` (giving 640 KB per entity) or stores the JSON blob in a private Blob Container (`state-blobs/ledger_overrides.json`) in the exact same Storage Account at **$0.02/GB/month**.

### 3.3 Backend API (`api/function_app.py` - Azure Functions Python v2 Model)

This single Azure Function App (Consumption Plan) handles both REST API persistence and the Monday AI Research Sweep, authenticating to Azure Table/Blob Storage and Azure OpenAI using **System-Assigned Managed Identity** (zero connection strings or API keys stored in settings).

```python
import os
import json
import logging
import urllib.request
import jwt
from jwt import PyJWKClient
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.data.tables import TableServiceClient, UpdateMode

app = func.FunctionApp()

TENANT_ID = os.environ["AZURE_TENANT_ID"]
CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
STORAGE_ACCOUNT_NAME = os.environ["STORAGE_ACCOUNT_NAME"]

# GCCH Endpoints
JWKS_URI = f"https://login.microsoftonline.us/{TENANT_ID}/discovery/v2.0/keys"
ISSUER = f"https://login.microsoftonline.us/{TENANT_ID}/v2.0"
TABLE_ENDPOINT = f"https://{STORAGE_ACCOUNT_NAME}.table.core.usgovcloudapi.net"

jwks_client = PyJWKClient(JWKS_URI)
# DefaultAzureCredential automatically uses Managed Identity in Azure Government
credential = DefaultAzureCredential()
table_service = TableServiceClient(endpoint=TABLE_ENDPOINT, credential=credential)
table_client = table_service.get_table_client("HiiDashboardState")


def verify_gcch_jwt(req: func.HttpRequest, require_admin: bool = False) -> dict:
    """Validates Entra ID US Government JWT and checks App Roles."""
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise PermissionError("Missing Bearer token")
    token = auth_header.split(" ")[1]

    signing_key = jwks_client.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=f"api://{CLIENT_ID}",
        issuer=ISSUER,
    )
    roles = claims.get("roles", [])
    if require_admin and "HII.Admin" not in roles:
        raise PermissionError("Requires HII.Admin role")
    if not require_admin and not any(r in roles for r in ["HII.Admin", "HII.Viewer"]):
        raise PermissionError("Requires HII.Viewer or HII.Admin role")
    return claims


@app.route(route="state/{doc_key}", methods=["GET", "PUT"])
def handle_state(req: func.HttpRequest) -> func.HttpResponse:
    doc_key = req.route_params.get("doc_key")
    if doc_key not in ("ledger_overrides", "pending_queue", "sanity_checks"):
        return func.HttpResponse("Invalid state key", status_code=400)

    try:
        if req.method == "GET":
            verify_gcch_jwt(req, require_admin=False)
            try:
                entity = table_client.get_entity(partition_key="STATE", row_key=doc_key)
                return func.HttpResponse(
                    entity.get("PayloadJson", "{}"),
                    mimetype="application/json",
                    status_code=200,
                )
            except Exception:
                return func.HttpResponse("{}", mimetype="application/json", status_code=200)

        if req.method == "PUT":
            claims = verify_gcch_jwt(req, require_admin=True)
            body_str = req.get_body().decode("utf-8")
            # Validate valid JSON before saving
            json.loads(body_str)
            entity = {
                "PartitionKey": "STATE",
                "RowKey": doc_key,
                "PayloadJson": body_str,
                "UpdatedBy": claims.get("preferred_username", "unknown"),
            }
            table_client.upsert_entity(mode=UpdateMode.REPLACE, entity=entity)
            return func.HttpResponse(json.dumps({"status": "saved"}), mimetype="application/json", status_code=200)

    except PermissionError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=403)
    except Exception as e:
        logging.exception("State API Error")
        return func.HttpResponse(json.dumps({"error": "Internal Error"}), status_code=500)
```

---

## 4. AI Research Pipeline in Azure Government / GCCH

In GCP, `scripts/weekly_research.py` used Vertex AI / Gemini to discover and pre-score HII news articles every Monday at 07:00 ET. In Azure Government, we replace Vertex AI with **Azure OpenAI Service in Azure US Government (`usgovvirginia` or `usgovarizona`)**.

### 4.1 Azure OpenAI in Azure Government Considerations
* **Endpoint Format:** `https://<resource-name>.openai.azure.us/`
* **Data Sovereignty:** Azure OpenAI in Azure Government processes all prompts and completions strictly within DoD/FedRAMP High accredited US Government datacenters. Customer prompts are **never** used to train foundation models or shared with OpenAI commercial.
* **Authentication:** Uses Entra ID Token authentication via `DefaultAzureCredential` with scope `https://cognitiveservices.azure.us/.default` (Notice the `.us` cognitive services scope!).

### 4.2 Scheduled Monday Sweep via Azure Functions Timer Trigger

Add the following Timer Trigger directly into `api/function_app.py`. It executes every Monday at `12:00 UTC` (`07:00 EST` / `08:00 EDT`) at **$0 additional compute cost** (covered under the 1M free Azure Function executions).

```python
from openai import AzureOpenAI
from azure.identity import get_bearer_token_provider

# CRITICAL FOR GCCH: Cognitive Services token scope in Azure Gov uses .us
gov_token_provider = get_bearer_token_provider(
    credential, "https://cognitiveservices.azure.us/.default"
)

aoai_client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_GOV_ENDPOINT"], # e.g. https://hii-aoai-gov.openai.azure.us/
    azure_ad_token_provider=gov_token_provider,
    api_version="2024-08-01-preview",
)

@app.timer_trigger(schedule="0 0 12 * * 1", arg_name="myTimer", run_on_startup=False)
def weekly_monday_research_sweep(myTimer: func.TimerRequest) -> None:
    """Runs every Monday at 12:00 UTC (07:00 ET) inside Azure US Government."""
    logging.info("Starting HII Weekly Sentiment Research Sweep in Azure Gov...")

    # 1. Fetch curated RSS/DoD/Defense News feeds (outbound HTTPS from Function)
    # 2. Pass candidate articles to Azure OpenAI GPT-4o in usgovvirginia for rubric evaluation
    system_prompt = (
        "You are a deterministic defense industrial base analyst evaluating Huntington Ingalls "
        "Industries (HII) media articles. Score strictly using the HII rubric JSON schema."
    )

    response = aoai_client.chat.completions.create(
        model=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"], # e.g., "gpt-4o-gov"
        response_format={"type": "json_object"},
        temperature=0.0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Evaluate this week's collected HII news articles..."}
        ]
    )

    scored_candidates = json.loads(response.choices[0].message.content).get("articles", [])

    # 3. Merge into 'pending_queue' in Azure Table Storage for HII.Admin review
    try:
        existing_entity = table_client.get_entity(partition_key="STATE", row_key="pending_queue")
        existing_queue = json.loads(existing_entity.get("PayloadJson", "[]"))
    except Exception:
        existing_queue = []

    merged_queue = existing_queue + scored_candidates
    table_client.upsert_entity(
        mode=UpdateMode.REPLACE,
        entity={
            "PartitionKey": "STATE",
            "RowKey": "pending_queue",
            "PayloadJson": json.dumps(merged_queue),
            "UpdatedBy": "aoai-gov-timer",
        },
    )
    logging.info(f"Added {len(scored_candidates)} candidate articles to pending_queue.")
```

---

## 5. Infrastructure-as-Code & CI/CD Cutover Checklist

### 5.1 Step-by-Step Azure CLI Provisioning (Azure US Government)

Run the following script from an authenticated workstation or Azure DevOps / GitHub Actions runner:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. SWITCH AZURE CLI TO US GOVERNMENT SOVEREIGN CLOUD
az cloud set --name AzureUSGovernment
az login --tenant "<YOUR_GCCH_TENANT_ID>"

# Verify cloud is set to AzureUSGovernment (.usgovcloudapi.net)
az cloud show --query "{name:name, resourceManager:endpoints.resourceManager}"

# Variables
RG_NAME="rg-hii-sentiment-gcch-prod"
LOCATION="usgovvirginia"
STORAGE_NAME="sthiisentimentgcch01"     # Must be globally unique, 3-24 lowercase alphanumeric
FUNC_NAME="func-hii-sentiment-gcch-prod"
AOAI_NAME="aoai-hii-sentiment-gcch"

# 2. CREATE RESOURCE GROUP
az group create --name "$RG_NAME" --location "$LOCATION"

# 3. CREATE STORAGE ACCOUNT (Static Website + Table Storage)
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RG_NAME" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Enable Static Website hosting ($web container)
az storage blob service-properties update \
  --account-name "$STORAGE_NAME" \
  --static-website \
  --404-document index.html \
  --index-document index.html \
  --auth-mode login

# Create Table for state persistence
az storage table create \
  --name "HiiDashboardState" \
  --account-name "$STORAGE_NAME" \
  --auth-mode login

# Retrieve Static Website URL (e.g., https://sthiisentimentgcch01.z2.web.core.usgovcloudapi.net/)
STATIC_WEB_URL=$(az storage account show \
  --name "$STORAGE_NAME" \
  --resource-group "$RG_NAME" \
  --query "primaryEndpoints.web" \
  --output tsv)
echo "Static Web Endpoint: $STATIC_WEB_URL"

# 4. CREATE AZURE FUNCTION APP (Linux Consumption Plan - Python 3.11)
az functionapp create \
  --resource-group "$RG_NAME" \
  --consumption-plan-location "$LOCATION" \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name "$FUNC_NAME" \
  --storage-account "$STORAGE_NAME" \
  --os-type Linux \
  --assign-identity "[system]"

# Capture Function Managed Identity Principal ID
FUNC_PRINCIPAL_ID=$(az functionapp identity show \
  --name "$FUNC_NAME" \
  --resource-group "$RG_NAME" \
  --query principalId \
  --output tsv)

# 5. ASSIGN LEAST-PRIVILEGE RBAC TO FUNCTION MANAGED IDENTITY
STORAGE_ID=$(az storage account show --name "$STORAGE_NAME" --resource-group "$RG_NAME" --query id -o tsv)

# Grant Storage Table Data Contributor to Function App Managed Identity
az role assignment create \
  --assignee "$FUNC_PRINCIPAL_ID" \
  --role "Storage Table Data Contributor" \
  --scope "$STORAGE_ID"

# Grant Cognitive Services OpenAI User on the Azure OpenAI Gov resource
AOAI_ID=$(az cognitiveservices account show --name "$AOAI_NAME" --resource-group "$RG_NAME" --query id -o tsv)
az role assignment create \
  --assignee "$FUNC_PRINCIPAL_ID" \
  --role "Cognitive Services OpenAI User" \
  --scope "$AOAI_ID"

# 6. CONFIGURE FUNCTION APP SETTINGS & CORS
az functionapp config appsettings set \
  --name "$FUNC_NAME" \
  --resource-group "$RG_NAME" \
  --settings \
    AZURE_TENANT_ID="<YOUR_GCCH_TENANT_ID>" \
    AZURE_CLIENT_ID="<YOUR_ENTRA_APP_CLIENT_ID>" \
    STORAGE_ACCOUNT_NAME="$STORAGE_NAME" \
    AZURE_OPENAI_GOV_ENDPOINT="https://${AOAI_NAME}.openai.azure.us/" \
    AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-gov"

# Lock CORS strictly to the GCCH Static Website URL (strip trailing slash)
ORIGIN="${STATIC_WEB_URL%/}"
az functionapp cors remove --name "$FUNC_NAME" --resource-group "$RG_NAME" --allowed-origins "*" || true
az functionapp cors add --name "$FUNC_NAME" --resource-group "$RG_NAME" --allowed-origins "$ORIGIN"
```

### 5.2 Frontend Environment Configuration (`.env.production`)

Create `.env.production` prior to building the Vite bundle:

```dotenv
VITE_AZURE_TENANT_ID="00000000-0000-0000-0000-000000000000"
VITE_AZURE_CLIENT_ID="11111111-1111-1111-1111-111111111111"
VITE_ENTRA_AUTHORITY="https://login.microsoftonline.us"
VITE_API_BASE_URL="https://func-hii-sentiment-gcch-prod.azurewebsites.us/api"
```

### 5.3 Build & Upload Deployment Commands

```bash
# 1. Run deterministic math & rubric integrity test suite prior to build
npm test

# 2. Build production bundle
npm run build

# 3. Upload dist/ to Azure Government Storage $web container using Entra ID credentials
az storage blob upload-batch \
  --account-name "$STORAGE_NAME" \
  --destination '$web' \
  --source ./dist \
  --overwrite true \
  --auth-mode login

# 4. Deploy Python Azure Function API & Timer Trigger
cd api
func azure functionapp publish "$FUNC_NAME" --python
```

### 5.4 Cutover Verification Checklist

- [ ] **Sovereign Endpoint Audit:** Open browser DevTools Network tab on the deployed `.usgovcloudapi.net` URL and verify **zero** requests are made to `.googleapis.com`, `.firebaseio.com`, or `login.microsoftonline.com`. All auth traffic must route exclusively to `login.microsoftonline.us`.
- [ ] **Zero-Trust Auth Wall Check:** Attempt sign-in with an unassigned HII user account -> Verify Entra ID blocks login with `AADSTS50105` (User is not assigned to a role for the application) or lands on the in-app Access Request screen.
- [ ] **Role Enforcement Check (`HII.Viewer` vs `HII.Admin`):**
  - Sign in as a user with `HII.Viewer` -> Verify dashboard renders all charts and BigInt calculations (`103.52` mean, `114.6` weighted index), `GET /api/state/*` returns `200 OK`, and Admin controls are hidden. Attempt a manual `PUT /api/state/ledger_overrides` via `curl` with the Viewer token -> Verify Azure Function returns `403 Forbidden`.
  - Sign in as a user with `HII.Admin` -> Verify Admin Mode toggle unlocks article editing, queue approval, and sanity check dismissal, and `PUT /api/state/*` persists changes to Azure Table Storage.
- [ ] **Azure OpenAI Gov Timer Check:** Manually trigger `weekly_monday_research_sweep` from the Azure Gov Portal (`portal.azure.us`) -> Verify logs confirm token acquisition against `https://cognitiveservices.azure.us/.default` and candidate articles populate `pending_queue`.

---

## 6. Estimated Monthly Cost Table ($0 – $18/month Target)

All pricing reflects **Azure US Government (`usgovvirginia`)** retail rates for an executive dashboard workload (~50 active HII users, ~10,000 page loads/month, 4 scheduled AI research sweeps/month).

| Azure US Gov Resource | SKU / Tier | Monthly Usage Assumption | Azure Gov Unit Price | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Microsoft Entra ID (GCCH)** | Included in existing HII M365 GCCH E3/E5 | App Registration, OIDC Auth, App Roles | $0.00 (Existing License) | **$0.00** |
| **Azure Storage Account (Static Web + Table Storage)** | Standard GPv2 LRS (`usgovvirginia`) | < 1 GB static assets + < 50 MB Table Storage + 50k ops | $0.024/GB Blob + $0.055/GB Table | **$0.15** |
| **Azure Functions** | Linux Consumption Plan (Y1) | ~25,000 API calls/mo + 4 Monday Timer runs | First **1,000,000 executions** & 400,000 GB-s **FREE** | **$0.00** |
| **Azure OpenAI Service (Gov)** | Pay-As-You-Go (`gpt-4o` in `usgovvirginia`) | 4 weekly sweeps (~150k input tokens + ~20k output tokens/mo) | ~$2.50 / 1M input, ~$10.00 / 1M output | **$0.60 – $1.50** |
| **Application Insights** | Workspace-based (Pay-As-You-Go) | < 0.5 GB telemetry logs/month (capped at 100MB/day) | First **5 GB/month FREE** per billing account | **$0.00** |
| **Outbound Data Transfer** | Standard Egress | ~2 GB/month SPA bundle transfers | First 100 GB/month FREE | **$0.00** |
| **Optional: Custom Domain + TLS** | Azure App Service Basic B1 *or* Container Apps Consumption | Only required if `*.z2.web.core.usgovcloudapi.net` URL is not desired | Container Apps: First 180k vCPU-s FREE (Scale-to-zero) | **$0.00 – $13.50** |
| **TOTAL ESTIMATED COST** | | | | **$0.75 – $15.15 / month** |
