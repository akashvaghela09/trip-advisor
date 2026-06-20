# Production architecture on Azure (500 or more users)

The app is already stateless. Working data lives in memory only for the request, and saved data goes to the database, so scaling up mostly means running more copies.

**Running it**

- The backend can run in a container on Azure Container Apps, which scales copies with load.
- The frontend can go on Azure Static Web Apps.
- Azure Front Door can handle HTTPS, routing, and a firewall. The live stream still works because each connection stays on one copy and nothing is shared, so we do not need sticky sessions.

**The real limit is the model, not the servers**

- At 500 users, model speed and rate limits are the bottleneck, not CPU.
- We could move to Azure OpenAI, add a per-user rate limit, put a queue (Azure Service Bus) in front for spikes, and cache repeated requests.

**Data and secrets**

- We could swap SQLite for Azure Database for PostgreSQL with pooling. This is a one-file change, since all data access goes through one interface.
- Keys and database details can live in Azure Key Vault instead of files.

**Login and access**

- We could use Entra ID (Azure AD) for company sign-in.
- We can map roles to access levels, so only admins see the logs view. This is the real version of the simple role idea.

**Monitoring**

- We can use Application Insights and Log Analytics for traces, errors, model latency, and cost.
- The audit table already records each agent's action, timing, and budget flags, so we can send those as metrics and alert on failures or slow runs.

**Setup**

- Infrastructure can be code (Bicep or Terraform), deployed via GitHub Actions to the container registry and Container Apps.
