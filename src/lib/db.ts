// src/lib/db.ts
import mysql from 'mysql2/promise';

let pool: mysql.Pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function query(sql: string, params: any[]): Promise<[any, any]> {
  const connection = await getPool().getConnection();
  try {
    const [rows, fields] = await connection.execute(sql, params);
    return [rows, fields];
  } finally {
    connection.release();
  }
}
