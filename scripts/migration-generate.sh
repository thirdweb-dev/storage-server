#!/bin/bash
ts-node ./node_modules/typeorm/cli.js migration:generate "src/migrations/${1}" --dataSource src/ormconfig.ts