# PRIMEVAULT AI VIDEO — RunningHub Consumer-Membership edition

Next.js app scaffold for RunningHub AI App API. It keeps the RunningHub API key server-side and submits AI App tasks, so a Consumer-Membership key can be used for supported AI Apps/Workflows and RH Coins are billed by RunningHub. It does not use the direct Seedance Model API, which RunningHub documents as Enterprise-Shared only.

## What is identified from public RunningHub pages

- Seedance 2.0 Image-to-Video AI App: `2037048798156951553` — https://www.runninghub.ai/ai-detail/2037048798156951553
- Seedance 2.0 All-purpose reference app: `2037365179167543298` — page categorizes it as Video-to-Video/Sparkvideo, so it is not treated as T2V by this project.
- Seedance 2.5 multimodal app: `2086023518503854082` — public page lists Video-to-Video, Text-to-Video, and Image-to-Video.
- Seedance 2.5 I2V app: `2085913918787526657`.

The user's `grp_b3e059c89771` and `grp_5676e8e95d5b` are Runow model-group IDs, not numeric `webappId` values for `/task/openapi/ai-app/run`. They cannot be inserted as webappId.

## API flow

1. Upload image: `POST /task/openapi/upload` (multipart `apiKey`, `fileType=input`, `file`).
2. Discover app inputs: `GET /api/webapp/apiCallDemo?apiKey=...&webappId=...`.
3. Submit: `POST /task/openapi/ai-app/run` with `webappId`, `apiKey`, `nodeInfoList`.
4. Poll: `POST /task/openapi/outputs` with `apiKey`, `taskId`.
5. Output response includes `consumeCoins` when available. RunningHub's docs state AI App API supports Consumer-Membership keys and task billing can show RH coins consumed.

The app discovers the prompt and image input nodes from RunningHub's API call demo at runtime; it does not guess node IDs.

## Important model limitation

RunningHub's official API docs state that direct Model API calls (including direct Seedance model endpoints) require Enterprise-Shared keys. Consumer-Membership can call AI App API and Workflow API. A public Seedance 2.0 I2V AI App is identified, and a Seedance 2.5 multimodal AI App advertises T2V + I2V. I could not verify a Seedance 2.0 T2V AI App for Consumer-Membership. That option remains intentionally disabled until a supported AI App/workflow is found. Do not label the direct Model API as RH Coins Consumer billing.

## Setup

1. Rotate the API key previously pasted into chat. Put the new key only in Vercel Environment Variables as `RUNNINGHUB_API_KEY`.
2. Copy `.env.example` to `.env.local` for local testing.
3. Keep `SEEDANCE20_T2V_WEBAPP_ID` blank until verified. The other app IDs are prefilled.
4. `npm install`, then `npm run dev`.
5. Deploy the GitHub repository to Vercel and add the same environment variables.

## Security before public launch

This starter has no end-user authentication, per-user quotas, or abuse protection. Do not publish it as an open public generator until you add login and rate limits, otherwise visitors can spend the owner's RH Coins. The API key is never sent to the browser.

## Official docs

- https://www.runninghub.ai/runninghub-api-doc-en/
- https://www.runninghub.ai/runninghub-api-doc-en/api-425761096 (AI App task)
- https://www.runninghub.ai/runninghub-api-doc-en/api-425761097 (AI App API call demo)
- https://www.runninghub.ai/runninghub-api-doc-en/api-425761034 (task outputs)
- https://www.runninghub.ai/runninghub-api-doc-en/api-425761099 (resource upload)
