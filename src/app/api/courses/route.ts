import { NextResponse } from 'next/server';
import { fetchAllTeachersWithCourses, fetchArchivedCoursesForTeacher, fetchCoursesForStudent, fetchCoursesForTeacher, fetchSuspendedCoursesForTeacher } from '@/app/actions';
import { createCourseService } from '@/server/services/course.service';

type ListRole = 'teacher' | 'student' | 'admin';
type TeacherStatus = 'active' | 'archived' | 'suspended';

type CreateCoursePayload = {
  title?: string;
  teacherId?: string;
  categoryId?: number;
};

function getTeacherCoursesByStatus(teacherId: string, status: TeacherStatus) {
  if (status === 'archived') {
    return fetchArchivedCoursesForTeacher(teacherId);
  }
  if (status === 'suspended') {
    return fetchSuspendedCoursesForTeacher(teacherId);
  }
  return fetchCoursesForTeacher(teacherId);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as ListRole | null;
    const userId = searchParams.get('userId');
    const status = (searchParams.get('status') as TeacherStatus | null) || 'active';

    if (!role) {
      return NextResponse.json({ error: 'El parámetro role es requerido.' }, { status: 400 });
    }

    if (role === 'teacher') {
      if (!userId) {
        return NextResponse.json({ error: 'El parámetro userId es requerido para teacher.' }, { status: 400 });
      }
      const data = await getTeacherCoursesByStatus(userId, status);
      return NextResponse.json({ data }, { status: 200 });
    }

    if (role === 'student') {
      if (!userId) {
        return NextResponse.json({ error: 'El parámetro userId es requerido para student.' }, { status: 400 });
      }
      const data = await fetchCoursesForStudent(userId);
      return NextResponse.json({ data }, { status: 200 });
    }

    if (role === 'admin') {
      const teachersWithCourses = await fetchAllTeachersWithCourses();
      const allCourses = teachersWithCourses.flatMap((teacher) => teacher.courses);
      const data = status ? allCourses.filter((course) => course.status === status) : allCourses;
      return NextResponse.json({ data }, { status: 200 });
    }

    return NextResponse.json({ error: 'Role inválido.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudieron obtener cursos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateCoursePayload;

    if (!payload.title || !payload.teacherId) {
      return NextResponse.json({ error: 'Título y teacherId son requeridos.' }, { status: 400 });
    }

    const result = await createCourseService({
      title: payload.title,
      teacherId: payload.teacherId,
      categoryId: payload.categoryId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo crear el curso.' }, { status: 400 });
  }
}
