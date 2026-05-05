# vibe-Monitor Rules

## Responsibility
This project is the digital sandbox consumer.

## Boundaries
- Do not import collector code.
- Do not read DCP Envelope files directly in production mode.
- Do not depend on DCP raw field names.
- Use DataHub sandbox APIs or SDK.

## Frontend
- Keep DataHub DTO mapping in api/adapter.ts.
- Keep UI-specific view models in frontend/types.
- Local JSON mode is for demo/development only.

## Backend
- If backend remains, treat it as BFF only.
- Do not duplicate DataHub storage or scheduler logic.