

'use server';

import { createSyllabus as createSyllabusFlow, type CreateSyllabusInput as CreateSyllabusInputFlow, type CreateSyllabusOutput } from '@/ai/flows/create-syllabus';
import { generateQuestionnaire as generateQuestionnaireFlow } from '@/ai/flows/generate-questionnaire';
import type { UserRole, User, Course, CourseLevel, SyllabusSection, Question, Teacher, CourseSourceFile, AppSettings, PromptHistoryItem, Badge, Notification, CourseAnalyticsData, Role, CompletedStudent, StudentProgress, CourseCategory, AiModel, TranscriptionStatus, GenerateQuestionnaireInput, StudentEnrollment, CourseBibliographyItem, CourseLevelStatus } from '@/types';
import { query, getPool } from '@/lib/db';
import { googleAI } from '@genkit-ai/googleai';
import { ai } from '@/ai/genkit';
import { createHash } from 'crypto';
import { loginUserService, registerUserService, updateUserByAdminService, updateUserProfileService } from '@/server/services/auth.service';
import { archiveCourseService, createCourseService, duplicateCourseService, reactivateSuspendedCourseService, restoreCourseService, suspendCourseService, updateCourseTitleService } from '@/server/services/course.service';
import { generateSingleModuleSyllabusService, saveLearningPathService } from '@/server/services/learning-path.service';
import { fetchUserNotificationsService, markUserNotificationsAsReadService } from '@/server/services/notification.service';

// --- GenAI Actions ---

export async function createSyllabus(payload: CreateSyllabusInputFlow): Promise<CreateSyllabusOutput> {
    console.log('Action: createSyllabus (Phase 1 Only)');
    try {
        const settings = await fetchAppSettings();
        const result = await createSyllabusFlow({
            pdfHashes: payload.pdfHashes || [],
            fullTranscribedText: payload.fullTranscribedText || '',
            numModules: payload.numModules,
            aiModel: settings.aiModel,
            customSyllabusPrompt: settings.adminSyllabusPrompt,
        });
        return result;
    } catch (e: any) {
        console.error(e);
        if (e?.name === 'AbortError') {
            throw new Error("La generación del temario fue cancelada.");
        }
        throw new Error("No se pudo crear el temario: " + (e?.message || 'error desconocido'));
    }
}

export async function generateQuestionnaire(payload: GenerateQuestionnaireInput) {
    console.log('Action: generateQuestionnaire', payload);
     try {
        const settings = await fetchAppSettings();
        const result = await generateQuestionnaireFlow({
            ...payload,
            customPrompt: settings.adminQuestionnairePrompt,
            aiModel: settings.aiModel,
        });
        return result;
    } catch(e) {
        console.error(e);
        throw new Error("No se pudo generar el cuestionario");
    }
}

// --- Transcript Caching Actions ---

export async function transcribeAndCacheFile(dataUri: string): Promise<{ hash: string, status: 'cached' | 'transcribed' }> {
    const base64Content = dataUri.substring(dataUri.indexOf(',') + 1);
    const buffer = Buffer.from(base64Content, 'base64');
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // 1. Check for existing transcript
    const existingTranscript = await fetchTranscript(fileHash);
    if (existingTranscript) {
        console.log(`Cache HIT for file hash: ${fileHash.substring(0, 10)}...`);
        return { hash: fileHash, status: 'cached' };
    }

    console.log(`Cache MISS for file hash: ${fileHash.substring(0, 10)}... Transcribing...`);
    const settings = await fetchAppSettings();

    const response = await ai.generate({
      model: googleAI.model(settings.aiModel || 'gemini-1.5-pro-latest'),
      prompt: [{media: {url: dataUri}}],
      system: 'Extrae el texto completo y crudo del documento PDF proporcionado. No resumas, no expliques, no formatees. Solo extrae el texto.'
    });

    const newTranscript = response.text;
    if (!newTranscript) {
        throw new Error(`La IA no generó una transcripción.`);
    }
    await saveTranscript(fileHash, newTranscript);
    
    return { hash: fileHash, status: 'transcribed' };
}


export async function fetchTranscript(fileHash: string): Promise<string | null> {
    try {
        const sql = 'SELECT transcript_content FROM file_transcripts WHERE file_hash = ?';
        const [results]: any[] = await query(sql, [fileHash]);
        if (results.length > 0) {
            return results[0].transcript_content;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching transcript from DB for hash ${fileHash}:`, error);
        return null;
    }
}

export async function saveTranscript(fileHash: string, transcriptContent: string): Promise<void> {
    const sql = `
        INSERT INTO file_transcripts (file_hash, transcript_content)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE transcript_content = VALUES(transcript_content)
    `;
    await query(sql, [fileHash, transcriptContent]);
}

async function sendEnrollmentNotification(_payload: {
    studentName: string;
    studentEmail: string;
    courseTitle: string;
    teacherName: string;
}): Promise<{ id?: string; message?: string }> {
    return { message: 'Notificación por correo no configurada.' };
}

export async function fetchTranscriptionStatus(fileHash: string): Promise<{ status: TranscriptionStatus, errorMessage?: string, processingStep?: string, processedChunks?: number, totalChunks?: number }> {
    try {
        const [results]: any[] = await query('SELECT status, error_message, processing_step, processed_chunks, total_chunks FROM shared_files WHERE file_hash = ?', [fileHash]);
        if (results.length > 0) {
            return { 
                status: results[0].status, 
                errorMessage: results[0].error_message,
                processingStep: results[0].processing_step,
                processedChunks: results[0].processed_chunks,
                totalChunks: results[0].total_chunks,
             };
        }
        throw new Error('Archivo no encontrado.');
    } catch (error: any) {
        console.error(`Error fetching status for hash ${fileHash}:`, error);
        return { status: 'failed', errorMessage: error.message };
    }
}


// --- Database Actions ---

// --- User Authentication ---
export async function registerUser(payload: { name: string; email: string; password: string, role: UserRole }) {
    console.log('Action: registerUser', { name: payload.name, email: payload.email, role: payload.role });
    return registerUserService(payload);
}

export async function loginUser(payload: { email: string; password: string }): Promise<User> {
    console.log('Action: loginUser', { email: payload.email });
    return loginUserService(payload);
}

export async function updateUserByAdmin(payload: {
    userId: string;
    name?: string;
    email?: string;
    password?: string;
    roles?: UserRole[];
    status?: 'active' | 'inactive';
}) {
    console.log('Action: updateUserByAdmin', payload);
    return updateUserByAdminService(payload);
}

export async function updateUserProfile(payload: {
    userId: string;
    name?: string;
    password?: string;
}): Promise<{ success: boolean }> {
    console.log('Action: updateUserProfile', { userId: payload.userId, name: payload.name });
    return updateUserProfileService(payload);
}


// --- Course Management Actions ---

export async function createCourse(payload: { title: string; teacherId: string, categoryId?: number }): Promise<{ courseId: number }> {
    console.log('Action: createCourse', payload);
    try {
        return createCourseService(payload);
    } catch (error) {
        console.error('Error creating course:', error);
        throw new Error('No se pudo crear el curso en la base de datos.');
    }
}

export async function updateCourseTitle(payload: { courseId: number; title: string, categoryId?: number }) {
    console.log('Action: updateCourseTitle', payload);
    try {
        return updateCourseTitleService(payload);
    } catch (error) {
        console.error('Error updating course title:', error);
        throw new Error('No se pudo actualizar el título del curso.');
    }
}

export async function archiveCourse(courseId: string): Promise<{ success: boolean }> {
    console.log('Action: archiveCourse', { courseId });
    try {
        return archiveCourseService(courseId);
    } catch (error: any) {
        console.error('Error archiving course:', error);
        throw new Error('No se pudo archivar el curso.');
    }
}

export async function suspendCourse(courseId: string): Promise<{ success: boolean }> {
    console.log('Action: suspendCourse', { courseId });
    try {
        return suspendCourseService(courseId);
    } catch (error: any) {
        console.error('Error suspending course:', error);
        throw new Error('No se pudo suspender el curso.');
    }
}


export async function reactivateSuspendedCourse(courseId: string): Promise<{ success: boolean }> {
    console.log('Action: reactivateSuspendedCourse', { courseId });
    try {
        return reactivateSuspendedCourseService(courseId);
    } catch (error: any) {
        console.error('Error reactivating course:', error);
        throw new Error('No se pudo reactivar el curso.');
    }
}

export async function restoreCourse(courseId: string): Promise<{ success: boolean }> {
    console.log('Action: restoreCourse', { courseId });
    try {
        return restoreCourseService(courseId);
    } catch (error: any) {
        console.error('Error restoring course:', error);
        throw new Error('No se pudo restaurar el curso.');
    }
}


export async function saveLearningPath(payload: { courseId: number, learningPath: CourseLevel[], sourceFileHashes: string[] }): Promise<{ updatedLearningPath: CourseLevel[] }> {
    console.log('Action: saveLearningPath for courseId:', payload.courseId);
    try {
        return saveLearningPathService(payload);
    } catch (error) {
        console.error('Error saving learning path:', error);
        throw new Error('No se pudo guardar la ruta de aprendizaje.');
    }
}

export async function generateSingleModuleSyllabus(payload: {
    moduleTitle: string;
    structuredContent: unknown[];
    classificationMap: Record<string, string[]>;
}) {
    return generateSingleModuleSyllabusService(payload);
}


export async function saveQuestionnaire(payload: { moduleId: number; questionnaire: Question[]; questionsToDisplay: number; }) {
    console.log('Action: saveQuestionnaire for moduleId:', payload.moduleId);
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        
        await connection.query('DELETE FROM module_questions WHERE module_id = ?', [payload.moduleId]);

        await connection.query('UPDATE course_modules SET questions_to_display = ? WHERE id = ?', [payload.questionsToDisplay, payload.moduleId]);

        if (payload.questionnaire.length > 0) {
            const questionValues = payload.questionnaire.map(question => [
                payload.moduleId,
                question.text,
                JSON.stringify(question.options), // Store options as a JSON string
                question.correctOptionIndex
            ]);
            const sql = 'INSERT INTO module_questions (module_id, question_text, options, correct_option_index) VALUES ?';
            await connection.query(sql, [questionValues]);
        }

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error('Error saving questionnaire:', error);
        throw new Error('No se pudo guardar el cuestionario.');
    } finally {
        connection.release();
    }
}

export async function enrollStudents(payload: { courseId: number, studentEnrollments: StudentEnrollment[], notify: boolean }): Promise<{ success: boolean; message: string; emailsSent: number }> {
    console.log('Action: enrollStudents', payload);
    const connection = await getPool().getConnection();
    const { courseId, studentEnrollments, notify } = payload;
    let emailsSent = 0;
    let emailError = '';

    try {
        await connection.beginTransaction();
        
        const [courseResult]: any[] = await connection.execute('SELECT c.title, u.name as teacher_name FROM courses c JOIN users u ON c.teacher_id = u.id WHERE c.id = ?', [courseId]);
        if (courseResult.length === 0) {
            throw new Error('Course not found');
        }
        const { title: courseTitle, teacher_name: teacherName } = courseResult[0];

        const [currentEnrollmentsResult]: [any[], any] = await connection.execute('SELECT student_id FROM course_enrollments WHERE course_id = ?', [courseId]);
        const currentStudentIds = new Set(currentEnrollmentsResult.map((e: any) => e.student_id.toString()));
        
        const studentIdsToEnroll = studentEnrollments.map(e => e.studentId);
        const newStudentIds = studentIdsToEnroll.filter(id => !currentStudentIds.has(id));

        await connection.execute('DELETE FROM course_enrollments WHERE course_id = ?', [courseId]);

        if (studentIdsToEnroll.length > 0) {
            const values = studentEnrollments.map(e => {
                let localDate: Date | null = null;
                if (e.dueDate) {
                    const d = new Date(e.dueDate);
                    localDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                }
                return [Number(e.studentId), courseId, localDate];
            });
            const insertEnrollmentsSql = 'INSERT INTO course_enrollments (student_id, course_id, due_date) VALUES ?';
            await connection.query(insertEnrollmentsSql, [values]);
        }
        
        if (newStudentIds.length > 0) {
            const notificationTitle = `Inscrito en un nuevo curso`;
            const notificationDesc = `Has sido inscrito en el curso "${courseTitle}". ¡Empieza a aprender ahora!`;
            const notificationLink = `/`;
            const notificationValues = newStudentIds.map(studentId => 
                [Number(studentId), notificationTitle, notificationDesc, notificationLink]
            );
            const insertNotificationsSql = 'INSERT INTO notifications (user_id, title, description, link) VALUES ?';
            await connection.query(insertNotificationsSql, [notificationValues]);
        }

        if (notify && newStudentIds.length > 0) {
            const [newlyEnrolledUsers]: any[] = await connection.query('SELECT id, name, email FROM users WHERE id IN (?)', [newStudentIds]);
            
            for (const student of newlyEnrolledUsers) {
                try {
                    const emailResult = await sendEnrollmentNotification({
                        studentName: student.name,
                        studentEmail: student.email,
                        courseTitle,
                        teacherName,
                    });
                    if (emailResult.id) {
                        emailsSent++;
                    } else if (emailResult.message && !emailError) {
                        // Store the first warning message (e.g. API key missing)
                        emailError = emailResult.message;
                    }
                } catch (error: any) {
                    console.error(`Failed to send enrollment email to ${student.email}:`, error.message);
                    if (!emailError) {
                        emailError = `Falló el envío a ${student.email}. Razón: ${error.message}`;
                    }
                }
            }
        }
        
        await connection.commit();

        let message = 'La lista de estudiantes inscritos ha sido actualizada.';
        if (notify) {
            if (emailsSent > 0) {
                message = `¡Guardado! Se enviaron ${emailsSent} notificaciones por correo.`;
                if(emailError) message += ` Algunos envíos fallaron: ${emailError}`;
            } else if (emailError) {
                message = `Estudiantes guardados, pero el envío de correos falló: ${emailError}`;
            } else if (newStudentIds.length > 0) {
                message = 'Estudiantes guardados, pero no se pudo enviar ningún correo.';
            } else {
                 message += ' No había nuevos estudiantes que notificar.';
            }
        }

        return { success: true, message, emailsSent };

    } catch (error: any) {
        await connection.rollback();
        console.error('Error enrolling students:', error);
        if (error.code && error.code.includes('ER_NO_REFERENCED_ROW')) {
            throw new Error('No se pudo inscribir a un estudiante porque no existe en el sistema.');
        }
        throw new Error('No se pudo actualizar la lista de estudiantes inscritos. La operación fue revertida.');
    } finally {
        connection.release();
    }
}



export async function submitEvaluation(payload: { studentId: string; courseId: number; moduleId: number; score: number }): Promise<{ passed: boolean; finalScore?: number }> {
    console.log('Action: submitEvaluation', payload);
    const connection = await getPool().getConnection();
    const { studentId, courseId, moduleId, score } = payload;
    const numericStudentId = Number(studentId);

    try {
        await connection.beginTransaction();

        const [settingsResult]: any[] = await connection.query('SELECT `value` FROM app_settings WHERE `key` = "minPassingScore"');
        const passingScore = Number(settingsResult[0]?.value) || 70;
        const passed = score >= passingScore;

        const submissionSql = `
            INSERT INTO evaluation_submissions (student_id, module_id, score, passed, submitted_at) 
            VALUES (?, ?, ?, ?, NOW())
        `;
        await connection.query(submissionSql, [numericStudentId, moduleId, score, passed]);
        console.log(`Evaluation submission for student ${studentId} on module ${moduleId} saved.`);

        const [totalModulesResult]: any[] = await connection.query('SELECT COUNT(id) as totalModules FROM course_modules WHERE course_id = ?', [courseId]);
        const totalModules = totalModulesResult[0].totalModules;
        
        let isCourseCompleted = false;

        if (totalModules > 0) {
            const approvedCountQuery = `
                SELECT COUNT(DISTINCT latest_submissions.module_id) as approvedCount
                FROM (
                    SELECT 
                        es.module_id, 
                        es.passed,
                        ROW_NUMBER() OVER(PARTITION BY es.module_id ORDER BY es.submitted_at DESC) as rn
                    FROM evaluation_submissions es
                    WHERE es.student_id = ? AND es.module_id IN (SELECT id FROM course_modules WHERE course_id = ?)
                ) AS latest_submissions
                WHERE latest_submissions.rn = 1 AND latest_submissions.passed = 1;
            `;

            const [approvedResult]: any[] = await connection.query(approvedCountQuery, [numericStudentId, courseId]);
            const approvedCount = approvedResult[0].approvedCount;
            
            if (approvedCount === totalModules) {
                isCourseCompleted = true;
            }
        }
        
        if (isCourseCompleted) {
            const finalScoreQuery = `
                SELECT AVG(s.score) as finalScore
                FROM (
                    SELECT es.score
                    FROM evaluation_submissions es
                    INNER JOIN (
                        SELECT module_id, MAX(submitted_at) as max_submitted
                        FROM evaluation_submissions
                        WHERE student_id = ? AND module_id IN (SELECT id FROM course_modules WHERE course_id = ?)
                        GROUP BY module_id
                    ) latest ON es.module_id = latest.module_id AND es.submitted_at = latest.max_submitted
                    WHERE es.student_id = ?
                ) s;
            `;
            const [scoreResult]: any[] = await connection.query(finalScoreQuery, [numericStudentId, courseId, numericStudentId]);
            const finalScore = scoreResult[0]?.finalScore || 0;
             
            console.log(`Course ${courseId} marked as completed for student ${studentId} with final score ${finalScore}.`);
            await connection.query(
                'UPDATE course_enrollments SET status = "completed", final_score = ? WHERE student_id = ? AND course_id = ?',
                [finalScore, numericStudentId, courseId]
            );

            await connection.commit();

             try {
                const [badges]: any[] = await query('SELECT * FROM badges', []);
                const [earnedBadgesResult]: any[] = await query('SELECT badge_id FROM user_badges WHERE user_id = ?', [numericStudentId]);
                const earnedBadgeIds = earnedBadgesResult.map((b: { badge_id: any; }) => b.badge_id);

                for (const badge of badges) {
                    if (earnedBadgeIds.includes(badge.id)) continue;
                    let shouldAward = false;
                    switch(badge.criteria_type) {
                        case 'SCORE': if (score >= badge.criteria_value) shouldAward = true; break;
                        case 'FIRST_PASS':
                            const [passedSubs]: any[] = await query('SELECT id FROM evaluation_submissions WHERE student_id = ? AND passed = 1', [numericStudentId]);
                            if (passedSubs.length === 1) shouldAward = true;
                            break;
                        case 'COURSE_COMPLETION': if (isCourseCompleted) shouldAward = true; break;
                        case 'COURSE_COUNT':
                            const [completedCourses]: any[] = await query(`SELECT COUNT(id) as count FROM course_enrollments WHERE student_id = ? AND status = 'completed'`, [numericStudentId]);
                            if (completedCourses[0].count >= badge.criteria_value) shouldAward = true;
                            break;
                        case 'PERFECT_STREAK':
                            const [lastN]: any[] = await query('SELECT score FROM evaluation_submissions WHERE student_id = ? ORDER BY submitted_at DESC LIMIT ?', [numericStudentId, badge.criteria_value]);
                            if(lastN.length === badge.criteria_value && lastN.every((s: { score: number; }) => s.score === 100)) shouldAward = true;
                            break;
                        case 'FIRST_TRY':
                            const [moduleSubs]: any[] = await query('SELECT id FROM evaluation_submissions WHERE student_id = ? AND module_id = ?', [numericStudentId, moduleId]);
                            if (moduleSubs.length === 1 && passed) shouldAward = true;
                            break;
                    }

                    if (shouldAward) {
                        await query('INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)', [numericStudentId, badge.id]);
                        console.log(`Awarded badge "${badge.name}" to user ${numericStudentId}`);
                    }
                }
            } catch (badgeError) {
                console.error('Error processing badges (transaction already committed):', badgeError);
            }
            
            return { passed, finalScore };
        } else {
            await connection.commit();
            return { passed };
        }

    } catch (error) {
        await connection.rollback();
        console.error('Error submitting evaluation:', error);
        throw new Error('No se pudo guardar el resultado de la evaluación.');
    } finally {
        connection.release();
    }
}


export async function duplicateCourse(courseId: string): Promise<{ success: boolean, newCourseId: number }> {
    console.log('Action: duplicateCourse', { courseId });
    try {
        return duplicateCourseService(courseId);
    } catch (error) {
        console.error('Error duplicating course:', error);
        throw new Error('No se pudo duplicar el curso.');
    }
}


// --- Data Fetching Actions ---

async function fetchStudentProgressForCourse(courseId: string): Promise<StudentProgress[]> {
    const numericCourseId = Number(courseId);
    
    const progressSql = `
        SELECT
            u.id,
            u.name,
            u.email,
            u.status AS user_status,
            GROUP_CONCAT(r.name) as roles,
            ce.due_date,
            ce.status AS enrollment_status,
            ce.final_score,
            (
                SELECT COUNT(DISTINCT es.module_id)
                FROM evaluation_submissions es
                JOIN course_modules cm ON es.module_id = cm.id
                WHERE es.student_id = ce.student_id AND es.passed = 1 AND cm.course_id = ?
            ) as completedModulesCount,
            (
                SELECT COUNT(id) 
                FROM course_modules 
                WHERE course_id = ?
            ) as totalModulesCount,
            IFNULL((
                SELECT AVG(s.score)
                FROM (
                    SELECT es.score
                    FROM evaluation_submissions es
                    INNER JOIN (
                        SELECT module_id, MAX(submitted_at) as max_submitted
                        FROM evaluation_submissions
                        WHERE student_id = ? AND module_id IN (SELECT id FROM course_modules WHERE course_id = ?)
                        GROUP BY module_id
                    ) latest ON es.module_id = latest.module_id AND es.submitted_at = latest.max_submitted
                ) s
            ), 0) as averageScore
        FROM
            users u
        JOIN
            course_enrollments ce ON u.id = ce.student_id
        LEFT JOIN 
            user_roles ur ON u.id = ur.user_id
        LEFT JOIN 
            roles r ON ur.role_id = r.id
        WHERE
            ce.course_id = ? AND ce.student_id = ?
        GROUP BY
            u.id, ce.due_date, ce.status, ce.final_score;
    `;
    
    const [enrolledStudents]: any[] = await query('SELECT student_id FROM course_enrollments WHERE course_id = ?', [numericCourseId]);
    if (enrolledStudents.length === 0) return [];
    
    const allProgress: StudentProgress[] = [];

    for (const student of enrolledStudents) {
        const studentId = student.student_id;
        const [progressList]: any[] = await query(progressSql, [numericCourseId, numericCourseId, studentId, numericCourseId, studentId, numericCourseId, studentId]);
        
        if (progressList.length > 0) {
            const studentProgress = progressList[0];
            allProgress.push({
                id: studentProgress.id.toString(),
                name: studentProgress.name,
                email: studentProgress.email,
                status: studentProgress.user_status,
                roles: studentProgress.roles ? studentProgress.roles.split(',') as UserRole[] : [],
                enrollmentStatus: studentProgress.enrollment_status,
                completedModulesCount: parseInt(studentProgress.completedModulesCount, 10) || 0,
                totalModulesCount: parseInt(studentProgress.totalModulesCount, 10) || 0,
                finalScore: studentProgress.final_score ? parseFloat(studentProgress.final_score) : undefined,
                averageScore: studentProgress.averageScore ? parseFloat(studentProgress.averageScore) : 0,
                dueDate: studentProgress.due_date ? new Date(studentProgress.due_date).toISOString() : undefined,
            });
        }
    }
    
    return allProgress;
}



async function fetchCoursesByStatus(teacherId: string, status: 'active' | 'archived' | 'suspended'): Promise<Course[]> {
    const numericTeacherId = Number(teacherId);
    if (isNaN(numericTeacherId)) {
        console.error("Invalid teacherId provided for fetchCoursesByStatus:", teacherId);
        return [];
    }

    const [coursesResult]: any[] = await query(`
        SELECT c.id, c.title, c.category_id, cat.name as category_name 
        FROM courses c
        LEFT JOIN course_categories cat ON c.category_id = cat.id
        WHERE c.teacher_id = ? AND c.status = ?
    `, [numericTeacherId, status]);

    const courses: Course[] = await Promise.all(coursesResult.map(async (courseRow: any) => {
        const [modulesResult]: any[] = await query('SELECT id, title, introduction, module_order, questions_to_display FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [courseRow.id]);
        
        const levels: CourseLevel[] = await Promise.all(modulesResult.map(async (moduleRow: any) => {
            const [syllabusResult]: any[] = await query('SELECT id, title, content FROM module_syllabus WHERE module_id = ?', [moduleRow.id]);
            const [questionsResult]: any[] = await query('SELECT id, question_text, options, correct_option_index FROM module_questions WHERE module_id = ?', [moduleRow.id]);

            return {
                id: moduleRow.id.toString(),
                title: moduleRow.title,
                status: 'locked', // Default status, student-specific status is calculated in fetchCoursesForStudent
                introduction: moduleRow.introduction,
                syllabus: syllabusResult.map((s: any) => ({ id: s.id.toString(), title: s.title, content: s.content })),
                questionnaire: questionsResult.map((q: any) => ({
                    id: q.id.toString(),
                    text: q.question_text,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                    correctOptionIndex: q.correct_option_index
                })),
                questionsToDisplay: moduleRow.questions_to_display,
            };
        }));

        const [studentsResult]: any[] = await query(`
            SELECT student_id, due_date
            FROM course_enrollments
            WHERE course_id = ?`, 
            [courseRow.id]
        );
        const enrollments: StudentEnrollment[] = studentsResult.map((s: any) => ({
            studentId: s.student_id.toString(),
            dueDate: s.due_date,
        }));
        
        const [sourceFilesResult]: any[] = await query(`
            SELECT csf.id, sf.file_name, sf.uploaded_at
            FROM course_source_files csf
            JOIN shared_files sf ON csf.shared_file_id = sf.id
            WHERE csf.course_id = ?
        `, [courseRow.id]);

        const sourceFiles: CourseSourceFile[] = sourceFilesResult.map((f: any) => ({
            id: f.id.toString(),
            fileName: f.file_name,
            uploadedAt: f.uploaded_at.toISOString(),
        }));
        
        const [bibliographyResult]: any[] = await query('SELECT id, item_name, item_type, url, uploaded_at FROM course_bibliography WHERE course_id = ?', [courseRow.id]);
        const bibliography: CourseBibliographyItem[] = bibliographyResult.map((f: any) => ({
            id: f.id.toString(),
            itemName: f.item_name,
            itemType: f.item_type,
            url: f.url,
            uploadedAt: f.uploaded_at.toISOString(),
        }));


        const studentProgress = await fetchStudentProgressForCourse(courseRow.id.toString());
        const completedStudentIds = studentProgress.filter(p => p.enrollmentStatus === 'completed').map(p => p.id);


        return {
            id: courseRow.id.toString(),
            title: courseRow.title,
            status: status,
            levels: levels,
            students: enrollments,
            completedStudentIds,
            studentProgress,
            sourceFiles: sourceFiles,
            bibliography: bibliography,
            teacherId: teacherId,
            categoryId: courseRow.category_id?.toString(),
            categoryName: courseRow.category_name,
        };
    }));
    
    return courses;
}


export async function fetchCoursesForTeacher(teacherId: string): Promise<Course[]> {
    return fetchCoursesByStatus(teacherId, 'active');
}

export async function fetchArchivedCoursesForTeacher(teacherId: string): Promise<Course[]> {
    return fetchCoursesByStatus(teacherId, 'archived');
}

export async function fetchSuspendedCoursesForTeacher(teacherId: string): Promise<Course[]> {
    return fetchCoursesByStatus(teacherId, 'suspended');
}

export async function fetchCoursesForStudent(studentId: string): Promise<Course[]> {
    try {
        const numericStudentId = Number(studentId);
        if (isNaN(numericStudentId)) {
            console.error("Invalid studentId provided:", studentId);
            return [];
        }

        const [enrolledCoursesResult]: any[] = await query(`
            SELECT 
                c.id, c.title, c.teacher_id, c.category_id, cat.name as category_name, c.status as course_status,
                ce.due_date, ce.status as enrollment_status, ce.final_score
            FROM courses c
            JOIN course_enrollments ce ON c.id = ce.course_id
            LEFT JOIN course_categories cat ON c.category_id = cat.id
            WHERE ce.student_id = ? AND c.status != 'archived'`,
            [numericStudentId]
        );

        if (enrolledCoursesResult.length === 0) {
            return [];
        }

        const courses: Course[] = await Promise.all(enrolledCoursesResult.map(async (courseRow: any) => {
            const courseId = courseRow.id;
            const [modulesResult]: any[] = await query('SELECT id, title, introduction, module_order, questions_to_display FROM course_modules WHERE course_id = ? ORDER BY module_order ASC', [courseId]);
            
            const [passedSubmissionsResult]: any[] = await query(
                'SELECT DISTINCT module_id FROM evaluation_submissions WHERE student_id = ? AND passed = 1 AND module_id IN (SELECT id FROM course_modules WHERE course_id = ?)',
                [numericStudentId, courseId]
            );
            const passedModuleIds = passedSubmissionsResult.map((s: any) => s.module_id);
            
            let firstInProgressSet = false;
            const levels: CourseLevel[] = modulesResult.map((moduleRow: any) => {
                let status: CourseLevelStatus = 'locked';
                const isPassed = passedModuleIds.includes(moduleRow.id);
                
                if (courseRow.enrollment_status === 'completed') {
                    status = 'completed';
                } else if (isPassed) {
                    status = 'completed';
                } else if (!firstInProgressSet) {
                    status = 'in-progress';
                    firstInProgressSet = true;
                }

                return {
                    id: moduleRow.id.toString(),
                    title: moduleRow.title,
                    status: status,
                    introduction: moduleRow.introduction,
                    syllabus: [],
                    questionnaire: [],
                    questionsToDisplay: moduleRow.questions_to_display,
                };
            });
            
            const detailedLevels: CourseLevel[] = await Promise.all(levels.map(async (level: CourseLevel) => {
                const [syllabusResult]: any[] = await query('SELECT id, title, content FROM module_syllabus WHERE module_id = ?', [level.id]);
                const [questionsResult]: any[] = await query('SELECT id, question_text, options, correct_option_index FROM module_questions WHERE module_id = ?', [level.id]);
                return {
                    ...level,
                    syllabus: syllabusResult.map((s: any) => ({ id: s.id.toString(), title: s.title, content: s.content })),
                    questionnaire: questionsResult.map((q: any) => ({
                        id: q.id.toString(),
                        text: q.question_text,
                        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                        correctOptionIndex: q.correct_option_index
                    })),
                };
            }));
            
            const [sourceFilesResult]: any[] = await query(`
                SELECT csf.id, sf.file_name, sf.uploaded_at
                FROM course_source_files csf
                JOIN shared_files sf ON csf.shared_file_id = sf.id
                WHERE csf.course_id = ?`, [courseId]);
            const sourceFiles: CourseSourceFile[] = sourceFilesResult.map((f: any) => ({
                id: f.id.toString(),
                fileName: f.file_name,
                uploadedAt: f.uploaded_at.toISOString(),
            }));
            
            const [bibliographyResult]: any[] = await query('SELECT id, item_name, item_type, url, uploaded_at FROM course_bibliography WHERE course_id = ?', [courseId]);
            const bibliography: CourseBibliographyItem[] = bibliographyResult.map((f: any) => ({
                id: f.id.toString(),
                itemName: f.item_name,
                itemType: f.item_type,
                url: f.url,
                uploadedAt: f.uploaded_at.toISOString(),
            }));

            return {
                id: courseRow.id.toString(),
                title: courseRow.title,
                levels: detailedLevels,
                students: [], 
                completedStudentIds: [],
                status: courseRow.enrollment_status,
                sourceFiles: sourceFiles,
                bibliography: bibliography,
                teacherId: courseRow.teacher_id.toString(),
                categoryId: courseRow.category_id?.toString(),
                categoryName: courseRow.category_name,
                finalScore: courseRow.final_score ? parseFloat(courseRow.final_score) : undefined,
                dueDate: courseRow.due_date ? new Date(courseRow.due_date).toISOString() : undefined,
                globalStatus: courseRow.course_status,
            };
        }));
        
        return courses;
    } catch (error) {
        console.error("Failed to fetch courses for student:", error);
        return [];
    }
}


export async function fetchAllUsers(): Promise<User[]> {
    console.log('Action: fetchAllUsers');
    try {
        const sql = `
            SELECT u.id, u.name, u.email, u.status, GROUP_CONCAT(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.name, u.email, u.status
        `;
        const [results]: any[] = await query(sql, []);
        
        const users: User[] = results.map((user: any) => ({
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            status: user.status,
            roles: user.roles ? user.roles.split(',') as UserRole[] : [],
        }));
        
        return users;
    } catch (error) {
        console.error('Error fetching all users:', error);
        throw new Error('No se pudo obtener la lista de usuarios.');
    }
}


export async function fetchAllTeachersWithCourses(): Promise<Teacher[]> {
    try {
        const [teachersResult]: any[] = await query(`
            SELECT u.id, u.name, u.email
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'teacher' AND u.status = 'active'
        `, []);
        
        const teachers: Teacher[] = await Promise.all(teachersResult.map(async (teacherRow: any) => {
            const courses = await fetchCoursesByStatus(teacherRow.id.toString(), 'active');
            const archived = await fetchCoursesByStatus(teacherRow.id.toString(), 'archived');
            const suspended = await fetchCoursesByStatus(teacherRow.id.toString(), 'suspended');

            return {
                id: teacherRow.id.toString(),
                name: teacherRow.name,
                email: teacherRow.email,
                roles: ['teacher'], // We know this from the query
                status: 'active',
                courses: [...courses, ...archived, ...suspended]
            };
        }));
        
        return teachers;
    } catch (error) {
        console.error('Failed to fetch teachers with courses from DB:', error);
        return [];
    }
}

export async function fetchAllCourses(): Promise<Course[]> {
    try {
        const teachersWithCourses = await fetchAllTeachersWithCourses();
        const allCourses = teachersWithCourses.flatMap(teacher => teacher.courses);
        const activeCourses = allCourses.filter(c => c.status === 'active');
        const suspendedCourses = allCourses.filter(c => c.status === 'suspended');
        const archivedCourses = allCourses.filter(c => c.status === 'archived');
        return [...activeCourses, ...suspendedCourses, ...archivedCourses];
    } catch (error) {
        console.error("Failed to fetch all courses for admin:", error);
        return [];
    }
}

export async function fetchAllRoles(): Promise<Role[]> {
    try {
        const sql = 'SELECT id, name FROM roles';
        const [results]: any[] = await query(sql, []);
        return results.map((role: any) => ({
            id: role.id.toString(),
            name: role.name,
        }));
    } catch (error: any) {
        console.error('Error fetching all roles:', error);
        throw new Error('No se pudo obtener la lista de roles.');
    }
}

export async function fetchAllCategories(options?: { onlyActive: boolean }): Promise<CourseCategory[]> {
    try {
        let sql = 'SELECT id, name, status, (SELECT COUNT(*) FROM courses WHERE category_id = cat.id) as courseCount FROM course_categories cat ORDER BY name ASC';
        const params: string[] = [];
        if (options?.onlyActive) {
            sql = 'SELECT id, name, status FROM course_categories WHERE status = ? ORDER BY name ASC';
            params.push('active');
        }
        const [results]: any[] = await query(sql, params);
        return results.map((cat: any) => ({
            id: cat.id.toString(),
            name: cat.name,
            status: cat.status,
            courseCount: cat.courseCount,
        }));
    } catch (error: any) {
        console.error('Error fetching all course categories:', error);
        throw new Error('No se pudo obtener la lista de categorías de cursos.');
    }
}


export async function fetchCompletedStudents(courseId: string): Promise<CompletedStudent[]> {
    try {
        const studentProgress = await fetchStudentProgressForCourse(courseId);
        const completers = studentProgress.filter(p => p.enrollmentStatus === 'completed');
        
        return completers.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            roles: c.roles,
            status: c.status,
            finalScore: c.finalScore || 0,
        }));

    } catch (error) {
        console.error(`Failed to fetch completed students for course ${courseId}:`, error);
        return [];
    }
}


// Action to check server environment status
export async function checkAiConfigStatus(): Promise<{isApiKeySet: boolean}> {
    // For client-side checks, env variables need to be prefixed with NEXT_PUBLIC_
    return {
        isApiKeySet: !!process.env.GEMINI_API_KEY,
    };
}


// --- App Settings Actions ---
export async function fetchSyllabusPrompt(): Promise<string> {
    try {
        const settings = await fetchAppSettings();
        return settings.adminSyllabusPrompt || '';
    } catch (error) {
        console.error('Error fetching syllabus prompt:', error);
        // Return a default or empty string in case of an error
        return '';
    }
}
export async function fetchAppSettings(): Promise<AppSettings> {
    try {
        const [results]: any[] = await query('SELECT `key`, `value` FROM app_settings', []);
        const settings = results.reduce((acc: AppSettings, { key, value }: { key: string; value: string }) => {
            acc[key] = value;
            return acc;
        }, {} as AppSettings);

        // Set defaults if not in DB
        if (!settings.aiModel) {
            const [modelResults]: any[] = await query('SELECT id FROM ai_models WHERE status = "active" LIMIT 1', []);
            settings.aiModel = modelResults[0]?.id || 'gemini-1.5-pro-latest';
        }
        if (!settings.adminSyllabusPrompt) settings.adminSyllabusPrompt = `Eres un educador y diseñador de planes de estudio experto. Tu tarea es generar una ruta de aprendizaje completa y estructurada en módulos a partir de los documentos PDF proporcionados.

Divide el contenido en una serie de módulos de aprendizaje lógicos y progresivos.

Para cada módulo, crea un título descriptivo. Dentro de cada módulo, desarrolla un temario detallado con varias secciones. Cada sección del temario debe tener un título claro y un contenido completo y bien explicado que sirva como material de estudio para un estudiante.

El contenido debe ser preciso, profundo y reflejar fielmente la información de los archivos subidos. La salida final debe ser una ruta de aprendizaje (learningPath) que es un array de objetos de módulo.`;
        if (!settings.adminQuestionnairePrompt) settings.adminQuestionnairePrompt = `Eres un educador experto especializado en crear evaluaciones de alta calidad. Tu tarea es generar un cuestionario de opción múltiple basado en el contenido proporcionado.

  Cada pregunta debe:
  1. Ser clara, concisa y relevante para los conceptos clave del contenido.
  2. Tener 4 opciones de respuesta.
  3. Incluir una respuesta correcta y tres distractores plausibles pero incorrectos. Los distractores deben ser desafiantes y requerir una comprensión real del tema, no ser obviamente falsos.
  4. Cubrir una variedad de temas del contenido proporcionado.
  5. Indicar el índice de la respuesta correcta en el campo 'correctOptionIndex'.

  Formatea la salida como un array JSON de objetos, donde cada objeto representa una pregunta con los campos "text" (la pregunta), "options" (un array de 4 strings de opciones) y "correctOptionIndex" (el índice de la respuesta correcta).
  `;
        if (!settings.enableYoutubeGeneration) settings.enableYoutubeGeneration = 'false';
        if (!settings.minPassingScore) settings.minPassingScore = '70';
        if (!settings.scoreCalculationMethod) settings.scoreCalculationMethod = 'last_attempt';
        
        return settings;
    } catch (error: any) {
        console.error('Error fetching app settings:', error);
        // This might happen if the table doesn't exist yet.
        // It's safer to throw so the UI can handle it.
        throw new Error('No se pudo obtener la configuración de la aplicación desde la base de datos.');
    }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<{ success: boolean }> {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        
        const appSettingsSql = 'INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)';
        const historySql = 'INSERT INTO prompt_history (prompt_type, content) VALUES (?, ?)';

        // Iterate over the passed settings object.
        for (const [key, value] of Object.entries(settings)) {
            if (value !== undefined) {
                // Save to main settings table
                await connection.query(appSettingsSql, [key, value]);
                
                // Save to history only if it's a prompt that was explicitly passed.
                if (key === 'adminSyllabusPrompt') {
                    await connection.query(historySql, ['syllabus', value]);
                } else if (key === 'adminQuestionnairePrompt') {
                    await connection.query(historySql, ['questionnaire', value]);
                }
            }
        }

        await connection.commit();
        return { success: true };
    } catch (error: any) {
        await connection.rollback();
        console.error('Error saving app settings:', error);
        throw new Error('No se pudo guardar la configuración de la aplicación.');
    } finally {
        connection.release();
    }
}

export async function fetchPromptHistory(): Promise<PromptHistoryItem[]> {
    try {
        const sql = 'SELECT id, prompt_type, content, saved_at FROM prompt_history ORDER BY saved_at DESC';
        const [results]: any[] = await query(sql, []);
        
        const history: PromptHistoryItem[] = results.map((item: any) => ({
            id: item.id.toString(),
            promptType: item.prompt_type,
            content: item.content,
            savedAt: item.saved_at.toISOString(),
        }));
        
        return history;
    } catch (error: any) {
        console.error('Error fetching prompt history:', error);
        throw new Error('No se pudo obtener el historial de prompts.');
    }
}

export async function deletePromptFromHistory(promptId: string): Promise<{ success: boolean }> {
    try {
        const numericId = Number(promptId);
        if (isNaN(numericId)) {
            throw new Error('ID de prompt inválido.');
        }

        const sql = 'DELETE FROM prompt_history WHERE id = ?';
        const [result]: any = await query(sql, [numericId]);
        
        if (result.affectedRows > 0) {
            return { success: true };
        } else {
            throw new Error('El prompt no fue encontrado o ya fue eliminado.');
        }
    } catch (error: any) {
        console.error('Error deleting prompt from history:', error);
        throw new Error(error.message || 'No se pudo eliminar el prompt del historial.');
    }
}

export async function fetchUserBadges(userId: string): Promise<Badge[]> {
    try {
        const numericId = Number(userId);
        if (isNaN(numericId)) {
            throw new Error('ID de usuario inválido.');
        }
        
        const sql = `
            SELECT b.id, b.name, b.description, b.icon_id, b.criteria_type, b.criteria_value, ub.earned_at
            FROM badges b
            JOIN user_badges ub ON b.id = ub.badge_id
            WHERE ub.user_id = ?
            ORDER BY ub.earned_at DESC
        `;
        const [results]: any[] = await query(sql, [numericId]);

        return results.map((b: any) => ({
            id: b.id.toString(),
            name: b.name,
            description: b.description,
            iconId: b.icon_id,
            criteriaType: b.criteria_type,
            criteriaValue: b.criteria_value,
        }));
    } catch (error: any) {
        console.error('Error fetching user badges:', error);
        throw new Error('No se pudo obtener las insignias del usuario.');
    }
}

// --- Badge Management Actions ---
export async function fetchAllBadges(): Promise<Badge[]> {
    try {
        const sql = 'SELECT id, name, description, icon_id, criteria_type, criteria_value FROM badges';
        const [results]: any[] = await query(sql, []);

        return results.map((b: any) => ({
            id: b.id.toString(),
            name: b.name,
            description: b.description,
            iconId: b.icon_id,
            criteriaType: b.criteria_type,
            criteriaValue: b.criteria_value,
        }));
    } catch (error: any) {
        console.error('Error fetching all badges:', error);
        throw new Error('No se pudo obtener la lista de insignias.');
    }
}

export async function saveBadge(badge: Omit<Badge, 'id'> & { id?: string }): Promise<{ success: boolean }> {
    const { id, name, description, iconId, criteriaType, criteriaValue } = badge;
    
    const finalCriteriaValue = criteriaValue === null || criteriaValue === undefined ? null : Number(criteriaValue);


    try {
        if (id) {
            // Update
            const sql = 'UPDATE badges SET name = ?, description = ?, icon_id = ?, criteria_type = ?, criteria_value = ? WHERE id = ?';
            const params = [name, description, iconId, criteriaType, finalCriteriaValue, Number(id)];
            await query(sql, params);
        } else {
            // Insert
            const sql = 'INSERT INTO badges (name, description, icon_id, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?)';
            const params = [name, description, iconId, criteriaType, finalCriteriaValue];
            await query(sql, params);
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error saving badge:', error);
        throw new Error('No se pudo guardar la insignia en la base de datos.');
    }
}

export async function deleteBadge(badgeId: string): Promise<{ success: boolean }> {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const numericId = Number(badgeId);

        await connection.query('DELETE FROM user_badges WHERE badge_id = ?', [numericId]);
        
        await connection.query('DELETE FROM badges WHERE id = ?', [numericId]);

        await connection.commit();
        return { success: true };
    } catch (error: any) {
        await connection.rollback();
        console.error('Error deleting badge:', error);
        throw new Error('No se pudo eliminar la insignia.');
    } finally {
        connection.release();
    }
}


// --- Notification Actions ---

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  try {
    return fetchUserNotificationsService(userId);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    throw new Error('No se pudo obtener las notificaciones.');
  }
}

export async function markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<{ success: boolean }> {
    try {
        return markUserNotificationsAsReadService({ userId, notificationIds });
    } catch (error: any) {
        console.error('Error marking notifications as read:', error);
        throw new Error('No se pudo marcar las notificaciones como leídas.');
    }
}

export async function fetchCourseAnalytics(courseId: string): Promise<CourseAnalyticsData> {
    try {
        const id = Number(courseId);
        
        const [enrollmentsResult]: any[] = await query('SELECT COUNT(DISTINCT student_id) as totalEnrolled FROM course_enrollments WHERE course_id = ?', [id]);
        const totalEnrolled = enrollmentsResult?.[0]?.totalEnrolled || 0;

        const [modules]: any[] = await query('SELECT id, title FROM course_modules WHERE course_id = ?', [id]);
        
        let totalModulesCompleted = 0;
        let courseCompletions = 0;
        let activeStudents = 0;
        let totalScoreSum = 0;
        let totalSubmissionsCount = 0;

        const moduleAnalytics = await Promise.all(modules.map(async (module: any) => {
            const [submissions]: any[] = await query('SELECT student_id, score, passed FROM evaluation_submissions WHERE module_id = ?', [module.id]);

            const passedCount = submissions.filter((s: { passed: any; }) => s.passed).length;
            const completionRate = totalEnrolled > 0 ? (passedCount / totalEnrolled) * 100 : 0;
            const averageScore = submissions.length > 0 ? submissions.reduce((acc: number, s: any) => acc + parseFloat(s.score), 0) / submissions.length : 0;
            
            totalModulesCompleted += passedCount;
            totalScoreSum += submissions.reduce((acc: number, s: any) => acc + parseFloat(s.score), 0);
            totalSubmissionsCount += submissions.length;

            return {
                moduleId: module.id,
                title: module.title,
                completionRate,
                averageScore,
            };
        }));
        
        if (totalEnrolled > 0) {
             const [studentCompletionsResult]: any[] = await query("SELECT COUNT(id) as completions FROM course_enrollments WHERE course_id = ? AND status = 'completed'", [id]);
             courseCompletions = studentCompletionsResult[0]?.completions || 0;
             const [activeStudentsResult]: any[] = await query("SELECT COUNT(id) as active FROM course_enrollments WHERE course_id = ? AND status = 'in-progress'", [id]);
             activeStudents = activeStudentsResult[0]?.active || 0;
        }

        const completionRate = totalEnrolled > 0 ? (courseCompletions / totalEnrolled) * 100 : 0;
        const averageScore = totalSubmissionsCount > 0 ? totalScoreSum / totalSubmissionsCount : 0;

        return {
            totalEnrolled,
            activeStudents,
            courseCompletions,
            completionRate,
            averageScore,
            totalModulesCompleted,
            modules: moduleAnalytics,
        };

    } catch (error) {
        console.error(`Error fetching analytics for course ${courseId}:`, error);
        throw new Error('No se pudieron obtener los datos de análisis del curso.');
    }
}


// --- Category Management Actions ---
export async function createCategory(name: string): Promise<{ success: boolean; categoryId?: number }> {
    try {
        const sql = 'INSERT INTO course_categories (name) VALUES (?)';
        const [result]: any = await query(sql, [name]);
        if (result.insertId) {
            return { success: true, categoryId: result.insertId };
        }
        return { success: false };
    } catch (error: any) {
        console.error('Error creating category:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('Ya existe una categoría con este nombre.');
        }
        throw new Error('No se pudo crear la categoría.');
    }
}

export async function updateCategory(payload: { id: string; name?: string; status?: 'active' | 'inactive' }): Promise<{ success: boolean }> {
    const { id, name, status } = payload;
    let sql = 'UPDATE course_categories SET';
    const params = [];
    if (name) {
        sql += ' name = ?,';
        params.push(name);
    }
    if (status) {
        sql += ' status = ?,';
        params.push(status);
    }
    sql = sql.slice(0, -1); // remove last comma
    sql += ' WHERE id = ?';
    params.push(Number(id));

    if (params.length === 1) { // Only ID is present
        return { success: false };
    }

    try {
        await query(sql, params);
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating category ${id}:`, error);
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('Ya existe una categoría con este nombre.');
        }
        throw new Error('No se pudo actualizar la categoría.');
    }
}

// --- AI Model Management Actions ---
export async function fetchAllAiModels(): Promise<AiModel[]> {
    try {
        const sql = 'SELECT id, name, pricing_input, pricing_output, status FROM ai_models ORDER BY name';
        const [results]: any[] = await query(sql, []);
        return results.map((model: any) => ({
            id: model.id,
            name: model.name,
            pricingInput: model.pricing_input,
            pricingOutput: model.pricing_output,
            status: model.status,
        }));
    } catch (error: any) {
        console.error('Error fetching all AI models:', error);
        throw new Error('No se pudo obtener la lista de modelos de IA.');
    }
}

export async function saveAiModel(model: Partial<AiModel>): Promise<{ success: boolean }> {
    const { id, name, pricingInput, pricingOutput, status } = model;
    
    try {
        const [existingModelResult]: any[] = await query('SELECT id FROM ai_models WHERE id = ?', [id]);
        
        if (existingModelResult.length > 0) {
            // Update
            const sql = 'UPDATE ai_models SET name = ?, pricing_input = ?, pricing_output = ?, status = ? WHERE id = ?';
            const params = [name, pricingInput, pricingOutput, status, id];
            await query(sql, params);
        } else {
            // Insert
            const sql = 'INSERT INTO ai_models (id, name, pricing_input, pricing_output, status) VALUES (?, ?, ?, ?, ?)';
            const params = [id, name, pricingInput, pricingOutput, status];
            await query(sql, params);
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error saving AI model:', error);
         if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('Ya existe un modelo con este identificador (ID).');
        }
        throw new Error('No se pudo guardar el modelo de IA en la base de datos.');
    }
}


export async function deleteAiModel(modelId: string): Promise<{ success: boolean }> {
    try {
        const sql = 'DELETE FROM ai_models WHERE id = ?';
        const [result]: any = await query(sql, [modelId]);
        
        if (result.affectedRows > 0) {
            return { success: true };
        } else {
            throw new Error('El modelo de IA no fue encontrado o ya fue eliminado.');
        }
    } catch (error: any) {
        console.error('Error deleting AI model:', error);
        throw new Error(error.message || 'No se pudo eliminar el modelo de IA.');
    }
}

export async function fetchSourceFile(fileId: string): Promise<{ dataUrl: string | null; fileName: string | null }> {
    try {
        const sql = `
            SELECT sf.file_name, sf.file_content 
            FROM shared_files sf
            JOIN course_source_files csf ON sf.id = csf.shared_file_id
            WHERE csf.id = ?
        `;
        const [fileResult]: any[] = await query(sql, [Number(fileId)]);
        
        if (!fileResult || fileResult.length === 0 || !fileResult[0].file_content) {
            return { dataUrl: null, fileName: null };
        }
        const file = fileResult[0];
        
        const base64Content = file.file_content.toString('base64');
        // Assuming PDF for now. A 'mime_type' column would be more robust.
        const dataUrl = `data:application/pdf;base64,${base64Content}`;
        
        return { dataUrl, fileName: file.file_name };
    } catch (error: any) {
        console.error('Error fetching source file:', error);
        throw new Error('No se pudo obtener el archivo de origen.');
    }
}

export async function addBibliographyItem(payload: {
    courseId: number;
    type: 'file' | 'link';
    fileName?: string;
    dataUri?: string;
    url?: string;
}): Promise<{ bibliographyItemId: number }> {
    try {
        if (payload.type === 'file') {
            if (!payload.fileName || !payload.dataUri) {
                throw new Error('Faltan datos del archivo.');
            }
            const base64Content = payload.dataUri.substring(payload.dataUri.indexOf(',') + 1);
            const buffer = Buffer.from(base64Content, 'base64');
            const sql = `
                INSERT INTO course_bibliography (course_id, item_type, item_name, file_content)
                VALUES (?, 'file', ?, ?)
            `;
            const [result]: any[] = await query(sql, [payload.courseId, payload.fileName, buffer]);
            return { bibliographyItemId: Number(result.insertId) };
        }

        if (!payload.url?.trim()) {
            throw new Error('La URL es requerida.');
        }
        const sql = `
            INSERT INTO course_bibliography (course_id, item_type, item_name, url)
            VALUES (?, 'link', ?, ?)
        `;
        const [result]: any[] = await query(sql, [payload.courseId, payload.url.trim(), payload.url.trim()]);
        return { bibliographyItemId: Number(result.insertId) };
    } catch (error: any) {
        console.error('Error adding bibliography item:', error);
        throw new Error(error?.message || 'No se pudo agregar el ítem de bibliografía.');
    }
}

export async function deleteBibliographyItem(itemId: string): Promise<{ success: boolean }> {
    try {
        const [result]: any[] = await query('DELETE FROM course_bibliography WHERE id = ?', [Number(itemId)]);
        if (result.affectedRows === 0) {
            throw new Error('El ítem no existe.');
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting bibliography item:', error);
        throw new Error(error?.message || 'No se pudo eliminar el ítem de bibliografía.');
    }
}

export async function fetchBibliographyItem(itemId: string): Promise<{ dataUrl: string | null; fileName: string | null }> {
    try {
        const sql = `
            SELECT item_name, file_content
            FROM course_bibliography
            WHERE id = ? AND item_type = 'file'
        `;
        const [rows]: any[] = await query(sql, [Number(itemId)]);
        if (!rows || rows.length === 0 || !rows[0].file_content) {
            return { dataUrl: null, fileName: null };
        }
        const base64Content = rows[0].file_content.toString('base64');
        return {
            dataUrl: `data:application/pdf;base64,${base64Content}`,
            fileName: rows[0].item_name,
        };
    } catch (error: any) {
        console.error('Error fetching bibliography item:', error);
        throw new Error(error?.message || 'No se pudo obtener el archivo de bibliografía.');
    }
}
    
  

    





    






    




    

    

    
