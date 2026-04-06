import { Router } from "express";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

router.get("/", (req, res) => {
  try {
    const openapiPath = path.resolve(__dirname, "../../../../packages/api-spec/openapi.yaml");
    const openapiContent = fs.readFileSync(openapiPath, "utf8");
    const spec = yaml.load(openapiContent);

    const html = `
<!doctype html>
<html>
  <head>
    <title>Synesis API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/api-docs/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Failed to load API spec");
  }
});

router.get("/openapi.json", (req, res) => {
  try {
    const openapiPath = path.resolve(__dirname, "../../../../packages/api-spec/openapi.yaml");
    const openapiContent = fs.readFileSync(openapiPath, "utf8");
    const spec = yaml.load(openapiContent);
    res.json(spec);
  } catch (err) {
    res.status(500).json({ error: "Failed to load API spec" });
  }
});

export default router;
