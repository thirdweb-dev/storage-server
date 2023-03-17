# storage-server
💾 Simplify storage with IPFS

## Getting Started

1. Install packages: `yarn`
2. Start local Docker containers: `yarn infra:dev`
3. Start server for local development with hot reloading: `yarn dev`

## Database Migrations

### Generate a new migrations file

1. Change any file under `src/entities`
2. Create the migration file with a name: `yarn migration:generate NameOfMigration`

### Run migrations locally

1. Run the migration locally: `yarn migration:run`
