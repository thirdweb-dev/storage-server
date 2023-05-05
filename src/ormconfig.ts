import './loadEnv';
import { DataSource } from 'typeorm';

// Based on the environment, TypeORM paths are different.
const typeOrmPathPrefix =
  process.env.NODE_ENV === 'development' ? 'src' : 'dist';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  synchronize: false,
  logging: false,
  entities: [`${typeOrmPathPrefix}/entities/**/*{.ts,.js}`],
  migrations: [`${typeOrmPathPrefix}/migrations/**/*{.ts,.js}`],
  subscribers: [`${typeOrmPathPrefix}/subscribers/**/*{.ts,.js}`],
});

export default dataSource;
