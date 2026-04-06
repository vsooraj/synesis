# Azure App Service Deployment Strategy for Synesis

To deploy this monorepo to **Azure App Service**, we will follow these steps:

1.  **Integrate Frontend with Backend**: Update the Node.js server to serve the React application's static files. This simplifies the deployment by using a single App Service instance.
2.  **Containerize the Application**: Create a `Dockerfile` in the root of the project to build the entire monorepo using its `pnpm` workspaces.
3.  **Deploy to Azure**: Use a CI/CD pipeline (GitHub Actions) to build the container, push it to an Azure Container Registry (ACR), and deploy it to an Azure App Service for Containers.

## Detailed Steps

### 1. Update Server to Serve Client
Modify `server/src/app.ts` to use `express.static` for serving the built React frontend.

### 2. Create Dockerfile
A multi-stage `Dockerfile` will:
-   Install dependencies for all workspaces.
-   Build the client assets.
-   Build the server code.
-   Produce a lightweight runner image that serves both.

### 3. Azure Infrastructure
-   **Azure Container Registry (ACR)**: To store our Docker images.
-   **Azure App Service**: To run the containerized application.
-   **Azure Database for PostgreSQL (Flexible Server)**:
    *   Since your app uses **PostgreSQL** (Drizzle ORM), you should provision a "Flexible Server" instance in Azure.
    *   **Networking**: Ensure "Allow public access from any Azure service within Azure to this server" is enabled in the database networking settings.
    *   **Migrations**: You'll need to run your Drizzle migrations (or `drizzle-kit push`) once the database is live and the `DATABASE_URL` is configured.

---

## Deployment Guide - Setting Up Azure

I've updated your server code, created the `Dockerfile`, and initialized the GitHub Actions workflow. Now, you need to set up the Azure infrastructure.

### Step 1: Create Azure Resources
1.  **Azure Container Registry (ACR)**:
    *   Create a new ACR in the Azure Portal.
    *   Once created, go to **Access keys** and enable "Admin user".
    *   Copy the **Login server**, **Username**, and **password**.
2.  **Azure App Service for Containers**:
    *   Create a new Web App.
    *   **Publish**: Docker Container
    *   **Operating System**: Linux
    *   **Plan**: Pick a Linux B1 or higher.

### Step 2: Configure GitHub Secrets
In your GitHub repository settings, go to **Security > Secrets and variables > Actions** and add these secrets:

| Secret Name | Description |
| :--- | :--- |
| `REGISTRY_LOGIN_SERVER` | Your ACR Login Server (e.g., `mynregistry.azurecr.io`) |
| `REGISTRY_USERNAME` | Your ACR Username |
| `REGISTRY_PASSWORD` | Your ACR Password |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Download this from your Web App's Overview page ("Get publish profile") |

### Step 3: Configure Environment Variables & Database
In the Azure Portal, go to your **App Service > Configuration > Application settings** and add:

*   `PORT`: `5000`
*   `DATABASE_URL`: `postgresql://<user>:<password>@<server-name>.postgres.database.azure.com:5432/<db-name>?sslmode=require` (Make sure to include `sslmode=require`)
*   `JWT_SECRET`: A long random string.
*   `OPENAI_API_KEY`: Your key.

#### Important: Azure PostgreSQL Networking
1.  Navigate to your **Azure Database for PostgreSQL**.
2.  Go to **Networking**.
3.  Check **"Allow public access from any Azure service within Azure to this server"**. This allows the Web App to reach the database.
4.  If you want to run migrations from your local laptop, add your **Local IP Address** to the firewall rules temporarily.

#### Initial Database Setup
Since you don't have migrations generated yet, you can use the `push` command to sync your schema with the Azure database:
1.  Install the [Azure VPN](https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-about-vpngateway) or just add your IP to the firewall.
2.  In your terminal locally:
    ```bash
    $env:DATABASE_URL="<your_azure_connection_string>"
    pnpm -C lib/db drizzle-kit push
    ```
Alternatively, I can help you generate migration files later for a more robust "production" workflow.

### Step 4: Push to Main
Push your changes to the `main` branch. GitHub Actions will automatically:
1.  Build your Docker image using the `Dockerfile`.
2.  Push it to your Azure Container Registry.
3.  Trigger the deployment to your App Service.
