import { z } from 'zod';

export const QuestionSchema = z.object({
  text: z.string(),
  options: z.array(z.string()).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
});
export type Question = z.infer<typeof QuestionSchema> & { id?: string };

export const SyllabusSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
});
export type SyllabusSection = z.infer<typeof SyllabusSectionSchema> & { id?: string };

export type CreateSyllabusInput = {
  pdfHashes?: string[];
  fullTranscribedText?: string;
  aiModel?: string;
  customSyllabusPrompt?: string;
  numModules?: number;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  includeFundamentals?: boolean;
};

export type CreateSyllabusOutput = {
  learningPath: Array<{
    title: string;
    introduction: string;
    syllabus: SyllabusSection[];
  }>;
  promptSource?: 'admin' | 'file' | 'code';
};

export const GenerateQuestionnaireInputSchema = z.object({
  content: z.string(),
  numQuestions: z.number().int().min(1),
  customPrompt: z.string().optional(),
  aiModel: z.string().optional(),
});
export type GenerateQuestionnaireInput = z.infer<typeof GenerateQuestionnaireInputSchema>;

export const GenerateQuestionnaireOutputSchema = z.object({
  questionnaire: z.array(QuestionSchema),
});
export type GenerateQuestionnaireOutput = z.infer<typeof GenerateQuestionnaireOutputSchema>;

export type UserRole = 'teacher' | 'student' | 'admin';

export interface Role {
    id: string;
    name: UserRole;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  status: 'active' | 'inactive';
}

export type CourseStatus = 'active' | 'archived' | 'suspended';
export type EnrollmentStatus = 'in-progress' | 'completed';
export type CourseDifficulty = 'basic' | 'intermediate' | 'advanced';

export interface StudentProgress extends User {
    enrollmentStatus: EnrollmentStatus;
    completedModulesCount: number;
    totalModulesCount: number;
    finalScore?: number;
    averageScore?: number;
    dueDate?: string;
}

export interface CompletedStudent extends User {
    finalScore: number;
}

export type CourseLevelStatus = 'locked' | 'in-progress' | 'completed';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CourseLevel {
  id: string; // Will be a number from the DB, but string is safer for components
  title: string;
  status: CourseLevelStatus;
  introduction: string; // Brief summary of the level's content
  syllabus: SyllabusSection[];
  questionnaire: Question[];
  questionsToDisplay: number;
}

export interface CourseSourceFile {
    id: string;
    fileName: string;
    uploadedAt: string;
    // content is not sent to client by default for performance
    content?: Buffer;
}

export interface CourseBibliographyItem {
    id: string;
    itemName: string;
    itemType: 'file' | 'link';
    url?: string | null;
    uploadedAt: string;
    // content is not sent to client by default for performance
    content?: Buffer;
}

export interface CourseCategory {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    courseCount?: number;
}

export interface AiModel {
    id: string; // e.g. 'gpt-4o-mini'
    name: string; // e.g. 'OpenAI GPT-4o Mini'
    pricingInput: string;
    pricingOutput: string;
    status: 'active' | 'inactive';
}

export interface StudentEnrollment {
  studentId: string;
  dueDate?: Date | null;
}

export interface Course {
    id: string; // Will be a number from the DB, but string is safer for components
    title: string;
    levels: CourseLevel[]; 
    students: StudentEnrollment[]; // array of student enrollments
    completedStudentIds: string[]; // array of student IDs who completed the course
    studentProgress?: StudentProgress[]; // Progress of each enrolled student
    status: CourseStatus | EnrollmentStatus; // Course status for teacher/admin, enrollment status for student
    globalStatus?: CourseStatus; // Global status of the course ('active', 'archived', 'suspended')
    sourceFiles: CourseSourceFile[];
    bibliography: CourseBibliographyItem[];
    teacherId?: string;
    categoryId?: string;
    categoryName?: string;
    difficulty?: CourseDifficulty;
    includeFundamentals?: boolean;
    finalScore?: number; // Student's final score on this course
    dueDate?: string; // For student view, the specific due date for them
}

export interface Teacher extends User {
    courses: Course[];
}

export type SeasonalDecorationTheme = 'christmas' | 'new_year';
export interface AppSettings {
    aiModel?: string;
    adminSyllabusPrompt?: string;
    adminQuestionnairePrompt?: string;
    enableYoutubeGeneration?: string;
    minPassingScore?: string;
    scoreCalculationMethod?: 'last_attempt' | 'all_attempts';
    seasonalDecorationsEnabled?: 'true' | 'false';
    seasonalDecorationsTheme?: SeasonalDecorationTheme;
    seasonalDecorationsStartDate?: string;
    seasonalDecorationsEndDate?: string;
    [key: string]: string | undefined;
}

export interface PromptHistoryItem {
    id: string;
    promptType: 'syllabus' | 'questionnaire';
    content: string;
    savedAt: string;
}

export type BadgeCriteriaType = 'SCORE' | 'COURSE_COMPLETION' | 'FIRST_PASS' | 'COURSE_COUNT' | 'PERFECT_STREAK' | 'FIRST_TRY' | 'FIRST_COURSE';
export interface Badge {
    id: string;
    name: string;
    description: string;
    iconId: string;
    criteriaType: BadgeCriteriaType;
    criteriaValue: number | null;
}

export interface Notification {
    id: string;
    title: string;
    description: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export interface CourseAnalyticsData {
    totalEnrolled: number;
    activeStudents: number;
    courseCompletions: number;
    completionRate: number;
    averageScore: number;
    totalModulesCompleted: number;
    modules: {
        moduleId: number;
        title: string;
        completionRate: number;
        averageScore: number;
    }[];
}


// --- Deprecated ---
// These types are kept for retro-compatibility on flows but should not be used for new features.
export const ThematicChunkSchema = z.object({
  title: z.string().describe('El título propuesto para este módulo temático.'),
  chunkContent: z.string().describe('El fragmento de texto original y completo que corresponde a este módulo temático.'),
});
export type ThematicChunk = z.infer<typeof ThematicChunkSchema>;

export const GenerateSyllabusFromChunkInputSchema = z.object({
  chunkContent: z.string().describe('El contenido de texto pre-clasificado para un módulo específico.'),
  moduleTitle: z.string().describe('El título del módulo para el cual se generará el temario.'),
  aiModel: z.string().optional().describe('El modelo de IA a utilizar.'),
  customSyllabusPrompt: z.string().optional().describe('El prompt de sistema personalizado.'),
});
export type GenerateSyllabusFromChunkInput = z.infer<typeof GenerateSyllabusFromChunkInputSchema>;

export interface IncorrectAnswer {
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
}

export const CreateSyllabusClientOutputSchema = z.object({
  learningPath: z.array(
    z.object({
      title: z.string(),
      introduction: z.string(),
      syllabus: z.array(SyllabusSectionSchema),
    })
  ),
  promptSource: z.enum(['admin', 'file', 'code']).optional(),
});
export type CreateSyllabusClientOutput = z.infer<typeof CreateSyllabusClientOutputSchema>;

    
