import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@/types';
import { getPool, query } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type UserLoginRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  status: 'active' | 'inactive';
};

type RoleIdRow = RowDataPacket & { id: number };
type RoleNameRow = RowDataPacket & { name: UserRole };

export async function registerUserService(payload: { name: string; email: string; password: string; role: UserRole }) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    const userSql = 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)';
    const userParams = [payload.name, payload.email, hashedPassword];
    const [result] = await connection.query<ResultSetHeader>(userSql, userParams);
    const newUserId = result.insertId;

    if (!newUserId) {
      throw new Error('User registration failed, no user ID was generated.');
    }

    const [roleRows] = await connection.query<RoleIdRow[]>('SELECT id FROM roles WHERE name = ?', [payload.role]);
    if (roleRows.length === 0) {
      throw new Error(`The role "${payload.role}" does not exist.`);
    }
    const roleId = roleRows[0].id;

    const userRoleSql = 'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)';
    await connection.query(userRoleSql, [newUserId, roleId]);

    await connection.commit();
    return { success: true, userId: newUserId };
  } catch (error: unknown) {
    await connection.rollback();
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Este correo electrónico ya está registrado.');
    }
    throw new Error('Ocurrió un error durante el registro. Por favor, inténtalo de nuevo.');
  } finally {
    connection.release();
  }
}

export async function loginUserService(payload: { email: string; password: string }): Promise<User> {
  const sql = 'SELECT id, name, email, password_hash, status FROM users WHERE email = ?';
  const params = [payload.email];
  const [users] = await query(sql, params) as [UserLoginRow[], unknown];

  if (!users || users.length === 0) {
    throw new Error('El correo electrónico o la contraseña son incorrectos.');
  }

  const user = users[0];
  const passwordMatches = await bcrypt.compare(payload.password, user.password_hash);

  if (!passwordMatches) {
    throw new Error('El correo electrónico o la contraseña son incorrectos.');
  }

  if (user.status !== 'active') {
    throw new Error('Esta cuenta de usuario está inactiva.');
  }

  const rolesSql = 'SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?';
  const [rolesResult] = await query(rolesSql, [user.id]) as [RoleNameRow[], unknown];
  const roles = rolesResult.map((r) => r.name);

  if (roles.length === 0) {
    throw new Error('El usuario no tiene un rol asignado.');
  }

  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    status: user.status,
    roles,
  };
}

export async function updateUserByAdminService(payload: {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  roles?: UserRole[];
  status?: 'active' | 'inactive';
}) {
  const { userId, name, email, password, roles, status } = payload;
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const numericUserId = Number(userId);

    let updateSql = 'UPDATE users SET ';
    const updateParams: Array<string | number> = [];
    if (name) {
      updateSql += 'name = ?, ';
      updateParams.push(name);
    }
    if (email) {
      updateSql += 'email = ?, ';
      updateParams.push(email);
    }
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateSql += 'password_hash = ?, ';
      updateParams.push(hashedPassword);
    }
    if (status) {
      updateSql += 'status = ?, ';
      updateParams.push(status);
    }

    if (updateParams.length > 0) {
      updateSql = updateSql.slice(0, -2);
      updateSql += ' WHERE id = ?';
      updateParams.push(numericUserId);
      await connection.query(updateSql, updateParams);
    }

    if (roles) {
      await connection.query('DELETE FROM user_roles WHERE user_id = ?', [numericUserId]);

      if (roles.length > 0) {
        const rolesSql = 'SELECT id, name FROM roles WHERE name IN (?)';
        const [roleRows] = await connection.query<Array<RoleIdRow & { name: UserRole }>>(rolesSql, [roles]);

        if (roleRows.length !== roles.length) {
          throw new Error('One or more selected roles are invalid.');
        }

        const userRoleValues = roleRows.map((role: { id: number }) => [numericUserId, role.id]);
        const userRoleSql = 'INSERT INTO user_roles (user_id, role_id) VALUES ?';
        await connection.query(userRoleSql, [userRoleValues]);
      }
    }

    await connection.commit();
    return { success: true };
  } catch (error: unknown) {
    await connection.rollback();
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('El correo electrónico ya está en uso por otro usuario.');
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      throw new Error(String((error as { message?: string }).message || 'No se pudo actualizar el usuario.'));
    }
    throw new Error('No se pudo actualizar el usuario.');
  } finally {
    connection.release();
  }
}

export async function updateUserProfileService(payload: {
  userId: string;
  name?: string;
  password?: string;
}): Promise<{ success: boolean }> {
  const { userId, name, password } = payload;

  if (!name && !password) {
    throw new Error('No se proporcionó ningún dato para actualizar.');
  }

  const updateParams: Array<string | number> = [];
  let updateSql = 'UPDATE users SET ';

  if (name) {
    updateSql += 'name = ?';
    updateParams.push(name);
  }

  if (password) {
    if (name) updateSql += ', ';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    updateSql += 'password_hash = ?';
    updateParams.push(hashedPassword);
  }

  updateSql += ' WHERE id = ?';
  updateParams.push(Number(userId));

  const [result] = await query(updateSql, updateParams) as [ResultSetHeader, unknown];
  if (result.affectedRows > 0) {
    return { success: true };
  }
  throw new Error('No se encontró el usuario para actualizar.');
}
