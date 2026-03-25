import { getPool, query } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type CourseTitleRow = RowDataPacket & { title: string };
type EnrollmentRow = RowDataPacket & { student_id: number };
type CourseRow = RowDataPacket & { id: number; title: string; teacher_id: number; category_id: number | null };
type ModuleRow = RowDataPacket & {
  id: number;
  title: string;
  introduction: string;
  module_order: number;
  questions_to_display: number;
};
type SyllabusRow = RowDataPacket & { title: string; content: string };
type QuestionRow = RowDataPacket & { question_text: string; options: string; correct_option_index: number };
type SourceFileLinkRow = RowDataPacket & { shared_file_id: number };

export async function createCourseService(payload: { title: string; teacherId: string; categoryId?: number }): Promise<{ courseId: number }> {
  const sql = 'INSERT INTO courses (title, teacher_id, category_id) VALUES (?, ?, ?)';
  const params = [payload.title, Number(payload.teacherId), payload.categoryId || null];
  const [result] = await query(sql, params) as [ResultSetHeader, unknown];
  if (result.insertId) {
    return { courseId: result.insertId };
  }
  throw new Error('Failed to create course.');
}

export async function updateCourseTitleService(payload: { courseId: number; title: string; categoryId?: number }) {
  const sql = 'UPDATE courses SET title = ?, category_id = ? WHERE id = ?';
  const params = [payload.title, payload.categoryId || null, payload.courseId];
  await query(sql, params);
  return { success: true };
}

export async function archiveCourseService(courseId: string): Promise<{ success: boolean }> {
  const sql = "UPDATE courses SET status = 'archived' WHERE id = ?";
  const params = [Number(courseId)];
  const [result] = await query(sql, params) as [ResultSetHeader, unknown];

  if (result.affectedRows > 0) {
    return { success: true };
  }
  throw new Error('El curso no existe o ya fue archivado.');
}

export async function suspendCourseService(courseId: string): Promise<{ success: boolean }> {
  const sql = "UPDATE courses SET status = 'suspended' WHERE id = ?";
  const params = [Number(courseId)];
  const [result] = await query(sql, params) as [ResultSetHeader, unknown];

  if (result.affectedRows > 0) {
    return { success: true };
  }
  throw new Error('El curso no existe o no se pudo suspender.');
}

export async function reactivateSuspendedCourseService(courseId: string): Promise<{ success: boolean }> {
  const connection = await getPool().getConnection();
  const numericCourseId = Number(courseId);

  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.query<ResultSetHeader>("UPDATE courses SET status = 'active' WHERE id = ? AND status = 'suspended'", [numericCourseId]);

    if (updateResult.affectedRows === 0) {
      throw new Error('El curso no existe o no está suspendido.');
    }

    const [courseRows] = await connection.query<CourseTitleRow[]>('SELECT title FROM courses WHERE id = ?', [numericCourseId]);
    const courseTitle = courseRows[0]?.title;

    const [enrollmentRows] = await connection.query<EnrollmentRow[]>('SELECT student_id FROM course_enrollments WHERE course_id = ?', [numericCourseId]);
    const studentIds = enrollmentRows.map((row) => row.student_id);

    if (studentIds.length > 0) {
      const notificationTitle = 'Curso Reactivado';
      const notificationDesc = `El curso "${courseTitle}" ha sido reactivado y ya está disponible en tu panel.`;
      const notificationLink = '/';
      const notificationValues = studentIds.map((studentId: number) => [studentId, notificationTitle, notificationDesc, notificationLink]);
      await connection.query('INSERT INTO notifications (user_id, title, description, link) VALUES ?', [notificationValues]);
    }

    await connection.commit();
    return { success: true };
  } catch (_error) {
    await connection.rollback();
    throw new Error('No se pudo reactivar el curso.');
  } finally {
    connection.release();
  }
}

export async function restoreCourseService(courseId: string): Promise<{ success: boolean }> {
  const connection = await getPool().getConnection();
  const numericCourseId = Number(courseId);

  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.query<ResultSetHeader>("UPDATE courses SET status = 'active' WHERE id = ?", [numericCourseId]);

    if (updateResult.affectedRows === 0) {
      throw new Error('El curso no existe o ya está activo.');
    }

    const [courseRows] = await connection.query<CourseTitleRow[]>('SELECT title FROM courses WHERE id = ?', [numericCourseId]);
    const courseTitle = courseRows[0]?.title;

    const [enrollmentRows] = await connection.query<EnrollmentRow[]>('SELECT student_id FROM course_enrollments WHERE course_id = ?', [numericCourseId]);
    const studentIds = enrollmentRows.map((row) => row.student_id);

    if (studentIds.length > 0) {
      const notificationTitle = 'Curso Reactivado';
      const notificationDesc = `El curso "${courseTitle}" ha sido reactivado y ya está disponible en tu panel.`;
      const notificationLink = '/';
      const notificationValues = studentIds.map((studentId: number) => [studentId, notificationTitle, notificationDesc, notificationLink]);
      await connection.query('INSERT INTO notifications (user_id, title, description, link) VALUES ?', [notificationValues]);
    }

    await connection.commit();
    return { success: true };
  } catch (_error) {
    await connection.rollback();
    throw new Error('No se pudo restaurar el curso.');
  } finally {
    connection.release();
  }
}

export async function duplicateCourseService(courseId: string): Promise<{ success: boolean; newCourseId: number }> {
  const connection = await getPool().getConnection();
  const numericCourseId = Number(courseId);

  try {
    await connection.beginTransaction();

    const [originalCourseRows] = await connection.query<CourseRow[]>('SELECT * FROM courses WHERE id = ?', [numericCourseId]);
    if (originalCourseRows.length === 0) {
      throw new Error('Course not found');
    }
    const originalCourse = originalCourseRows[0];

    const newCourseTitle = `(Copia) ${originalCourse.title}`;
    const [newCourseResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO courses (title, teacher_id, status, category_id) VALUES (?, ?, ?, ?)',
      [newCourseTitle, originalCourse.teacher_id, 'active', originalCourse.category_id]
    );
    const newCourseId = newCourseResult.insertId;

    const [originalModules] = await connection.query<ModuleRow[]>('SELECT * FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [numericCourseId]);

    for (const originalModule of originalModules) {
      const [newModuleResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO course_modules (course_id, title, introduction, module_order, questions_to_display) VALUES (?, ?, ?, ?, ?)',
        [newCourseId, originalModule.title, originalModule.introduction, originalModule.module_order, originalModule.questions_to_display]
      );
      const newModuleId = newModuleResult.insertId;

      const [originalSyllabus] = await connection.query<SyllabusRow[]>('SELECT * FROM module_syllabus WHERE module_id = ?', [originalModule.id]);
      if (originalSyllabus.length > 0) {
        const syllabusValues = originalSyllabus.map((s) => [newModuleId, s.title, s.content]);
        await connection.query('INSERT INTO module_syllabus (module_id, title, content) VALUES ?', [syllabusValues]);
      }

      const [originalQuestions] = await connection.query<QuestionRow[]>('SELECT * FROM module_questions WHERE module_id = ?', [originalModule.id]);
      if (originalQuestions.length > 0) {
        const questionValues = originalQuestions.map((q) => [newModuleId, q.question_text, q.options, q.correct_option_index]);
        await connection.query('INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES ?', [questionValues]);
      }
    }

    const [originalSourceFileLinks] = await connection.query<SourceFileLinkRow[]>('SELECT shared_file_id FROM course_source_files WHERE course_id = ?', [numericCourseId]);
    if (originalSourceFileLinks.length > 0) {
      const sourceFileValues = originalSourceFileLinks.map((link) => [newCourseId, link.shared_file_id]);
      await connection.query('INSERT INTO course_source_files (course_id, shared_file_id) VALUES ?', [sourceFileValues]);
    }

    await connection.commit();
    return { success: true, newCourseId };
  } catch (_error) {
    await connection.rollback();
    throw new Error('No se pudo duplicar el curso.');
  } finally {
    connection.release();
  }
}
