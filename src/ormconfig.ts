import './loadEnv';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  synchronize: false,
  logging: false,
  entities: [
    './entities/**/*'
  ],
  migrations: [
    './migrations/**/*'
  ],
  subscribers: [
    './subscribers/**/*'
  ]
});

export default dataSource